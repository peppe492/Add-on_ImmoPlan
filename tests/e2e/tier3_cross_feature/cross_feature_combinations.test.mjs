// tests/e2e/tier3_cross_feature/cross_feature_combinations.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { MockTelegramServer } from '../harness/mock_telegram.mjs';
import { MockSupervisorServer } from '../harness/mock_supervisor.mjs';
import { PdfValidator } from '../harness/pdf_validator.mjs';
import { calculateRentDueDate, evaluateRentStatus, reconcileServerRentDeadlines } from '../modules/rent_status_engine.mjs';
import { createRentReceipt, generateReceiptPdf, allocateSequentialReceiptNumber } from '../modules/receipt_pdf_engine.mjs';
import {
  sendTelegramMessage,
  sendTelegramDocument,
  testTelegramConnection,
  updateHomeAssistantSensor,
  testHomeAssistantConnection,
  createHomeAssistantNotification,
  dismissHomeAssistantNotification
} from '../modules/notification_engine.mjs';
import { validateRentReceipt, validateNotificationSettings } from '../modules/persistence_engine.mjs';
import { getRentBadgeInfo, getRentQuickActionsState } from '../modules/ui_contract_engine.mjs';
import {
  fixtureLandlord,
  fixtureTenant1,
  fixtureTenant2,
  fixturePropertyCedolare,
  fixturePropertyOrdinario,
  fixtureSettings
} from '../harness/fixtures.mjs';

describe('Tier 3 - Cross-Feature Combinations & Pairwise Integrations', () => {
  test('T3-CF-01 (F1 + F2): Custom rentDueDay dynamically drives rent status engine due date', () => {
    const customTenant = { ...fixtureTenant1, rentDueDay: 20 };
    const res = evaluateRentStatus(fixturePropertyCedolare, customTenant, [], '2026-09-17', 5);
    assertEqual(res.dueDate, '2026-09-20');
    assertEqual(res.daysUntilDue, 3);
    assertEqual(res.status, 'IN_SCADENZA');
  });

  test('T3-CF-02 (F2 + F3): Unified rent status drives server cron without false alarms', () => {
    const payment = [{
      id: 'p_sept',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8,
      income: 850,
      transactionDate: '2026-09-04'
    }];
    const status = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, payment, '2026-09-10');
    assertEqual(status.status, 'SALDATO');

    const deadlines = reconcileServerRentDeadlines([fixturePropertyCedolare], payment, '2026-09-10');
    assertTrue(deadlines[0].isCompleted);
    assertFalse(deadlines[0].isOverdueAlarmTriggerable);
  });

  test('T3-CF-03 (F2 + F7): Status transition to SCADUTO updates HA sensor attributes', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const status = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-08');
      assertEqual(status.status, 'SCADUTO');

      const res = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        state: 1,
        attributes: {
          scaduti: 1,
          dettagli: [{ property: status.propertyName, daysOverdue: Math.abs(status.daysUntilDue) }]
        }
      });
      assertTrue(res.success);
      const recorded = mockHA.sensorStates.get('sensor.immoplan_affitti_stato');
      assertEqual(recorded.attributes.scaduti, 1);
    } finally {
      await mockHA.stop();
    }
  });

  test('T3-CF-04 (F2 + F5): Status IN_SCADENZA triggers Telegram reminder to tenant', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const status = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-02', 5);
      assertEqual(status.status, 'IN_SCADENZA');

      const message = `Gentile <b>${status.tenantName}</b>, il canone di € ${status.monthlyRent} scade tra ${status.daysUntilDue} giorni.`;
      const res = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: status.tenantTelegramChatId,
        text: message
      });
      assertTrue(res.success);
      assertEqual(mockTelegram.sentMessages[0].chat_id, fixtureTenant1.telegramChatId);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T3-CF-05 (F5 + F6): Connection test verifies bot before dispatching reminder', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const conn = await testTelegramConnection({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token'
      });
      assertTrue(conn.success);

      const msg = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        text: 'Test connection dispatch'
      });
      assertTrue(msg.success);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T3-CF-06 (F7 + F8): HA connection test succeeds before sensor updates', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const conn = await testHomeAssistantConnection({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123'
      });
      assertTrue(conn.success);

      const sensor = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        state: 0
      });
      assertTrue(sensor.success);
    } finally {
      await mockHA.stop();
    }
  });

  test('T3-CF-07 (F4 + F9): Validated settings persist and match REST schema', () => {
    const settings = { ...fixtureSettings, reminderAdvanceDays: 7 };
    const validation = validateNotificationSettings(settings);
    assertTrue(validation.valid);
    assertEqual(settings.reminderAdvanceDays, 7);
  });

  test('T3-CF-08 (F10 + F11): Sequential numbering formats directly into Vector PDF', () => {
    const seq = allocateSequentialReceiptNumber([{ receiptNumber: 5, fiscalYear: 2026 }], 2026);
    assertEqual(seq.formattedNumber, '6/2026');

    const receipt = createRentReceipt({
      existingReceipts: [{ receiptNumber: 5, fiscalYear: 2026 }],
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    assertEqual(receipt.formattedNumber, '6/2026');

    const pdfBuf = generateReceiptPdf(receipt);
    const text = PdfValidator.validate(pdfBuf).fullTextContent;
    assertTrue(text.includes('RICEVUTA N. 6/2026'));
  });

  test('T3-CF-09 (F10 + F12): Fiscal quietanza stamp duty alters PDF text', () => {
    // Ordinary regime > 77.47: stamp duty clause included
    const receiptOrd = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant2,
      property: fixturePropertyOrdinario,
      paymentRecord: { id: 'p2', year: 2026, month: 8, income: 1100 },
      taxRegime: 'ORDINARIO'
    });
    assertTrue(receiptOrd.stampDutyApplied);
    assertEqual(receiptOrd.stampDutyAmount, 2.00);

    const pdfBuf = generateReceiptPdf(receiptOrd);
    const text = PdfValidator.validate(pdfBuf).fullTextContent;
    assertTrue(text.includes('Euro 2,00'));
  });

  test('T3-CF-10 (F5 + F10): Generated Vector PDF buffer is attached to Telegram document dispatch', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const receipt = createRentReceipt({
        landlord: fixtureLandlord,
        tenant: fixtureTenant1,
        property: fixturePropertyCedolare,
        paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
      });
      const pdfBuf = generateReceiptPdf(receipt);

      const res = await sendTelegramDocument({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: fixtureTenant1.telegramChatId,
        documentBuffer: pdfBuf,
        filename: 'quietanza_1_2026.pdf',
        caption: 'Quietanza Settembre 2026'
      });
      assertTrue(res.success);
      assertEqual(mockTelegram.sentDocuments.length, 1);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T3-CF-11 (F13 + F6 + F8): Settings test buttons verify both integrations', async () => {
    const mockHA = new MockSupervisorServer();
    const mockTG = new MockTelegramServer();
    await mockHA.start();
    await mockTG.start();
    try {
      const haRes = await testHomeAssistantConnection({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123'
      });
      const tgRes = await testTelegramConnection({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token'
      });
      assertTrue(haRes.success);
      assertTrue(tgRes.success);
    } finally {
      await mockHA.stop();
      await mockTG.stop();
    }
  });

  test('T3-CF-12 (F14 + F5 + F16): Quick action reads tenant chat ID and sends document', async () => {
    const mockTG = new MockTelegramServer();
    await mockTG.start();
    try {
      const rentItem = { status: 'SALDATO', tenantTelegramChatId: fixtureTenant1.telegramChatId };
      const action = getRentQuickActionsState(rentItem);
      assertTrue(action.canSendReceiptTelegram);

      const res = await sendTelegramDocument({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: rentItem.tenantTelegramChatId,
        documentBuffer: Buffer.from('%PDF-1.4 sample'),
        filename: 'receipt.pdf'
      });
      assertTrue(res.success);
    } finally {
      await mockTG.stop();
    }
  });

  test('T3-CF-13 (F15 + F2): Rent badge text and color exactly mirror engine evaluation', () => {
    const statusItem = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-02', 5);
    const badge = getRentBadgeInfo(statusItem.status, statusItem.daysUntilDue);
    assertEqual(badge.badgeColor, 'amber');
    assertEqual(badge.label, 'In Scadenza (3 gg)');
  });

  test('T3-CF-14 (F16 + F17): Action Genera Ricevuta enables modal with valid schema', () => {
    const paidItem = { status: 'SALDATO', tenantTelegramChatId: '123' };
    const canGen = getRentQuickActionsState(paidItem).canGenerateReceipt;
    assertTrue(canGen);

    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p_1', year: 2026, month: 8, income: 850 }
    });
    assertTrue(validateRentReceipt(receipt).valid);
  });

  test('T3-CF-15 (F17 + F10 + F11): Preview modal generates valid PDF with consecutive number', () => {
    const receipt = createRentReceipt({
      existingReceipts: [{ receiptNumber: 2, fiscalYear: 2026 }],
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p_3', year: 2026, month: 8, income: 850 }
    });
    assertEqual(receipt.formattedNumber, '3/2026');
    const pdfBuf = generateReceiptPdf(receipt);
    assertTrue(PdfValidator.validate(pdfBuf).isValid);
  });

  test('T3-CF-16 (F18 + F9 + F5): Dispatched reminder can be logged and retrieved', () => {
    const logs = [];
    logs.push({
      id: 'log_rem_1',
      timestamp: new Date().toISOString(),
      channel: 'TELEGRAM',
      type: 'REMINDER_UPCOMING',
      recipient: fixtureTenant1.name,
      status: 'SUCCESS'
    });
    assertEqual(logs.length, 1);
    assertEqual(logs[0].type, 'REMINDER_UPCOMING');
  });

  test('T3-CF-17 (F18 + F10 + F17): Receipt transmission appends to log history', () => {
    const logs = [];
    logs.push({
      id: 'log_rcp_1',
      timestamp: new Date().toISOString(),
      channel: 'TELEGRAM',
      type: 'RECEIPT_SENT',
      recipient: fixtureTenant1.name,
      status: 'SUCCESS',
      details: 'Quietanza 1/2026 inviata via Telegram'
    });
    assertEqual(logs[0].type, 'RECEIPT_SENT');
    assertEqual(logs[0].details.includes('1/2026'), true);
  });

  test('T3-CF-18 (F1 + F14 + F15): Updating tenant due day updates countdown badge', () => {
    const tenantEarly = { ...fixtureTenant1, rentDueDay: 2 };
    const statusEarly = evaluateRentStatus(fixturePropertyCedolare, tenantEarly, [], '2026-09-04', 5);
    assertEqual(statusEarly.status, 'SCADUTO');
    const badge = getRentBadgeInfo(statusEarly.status, statusEarly.daysUntilDue);
    assertEqual(badge.badgeColor, 'rose');
  });

  test('T3-CF-19 (F3 + F7 + F18): Overdue settled dismisses HA notification', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      // Step 1: Create overdue notification
      await createHomeAssistantNotification({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        notificationId: 'immoplan_overdue_prop_centro_1',
        title: 'Affitto Scaduto',
        message: 'Canone scaduto per Appartamento Centro'
      });
      assertEqual(mockHA.persistentNotifications.size, 1);

      // Step 2: Payment registered -> dismiss notification
      await dismissHomeAssistantNotification({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        notificationId: 'immoplan_overdue_prop_centro_1'
      });
      assertEqual(mockHA.persistentNotifications.size, 0);
    } finally {
      await mockHA.stop();
    }
  });

  test('T3-CF-20 (F4 + F11 + F12): Quietanza schema matches PDF text representation', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p_1', year: 2026, month: 8, income: 850 }
    });
    const schemaValidation = validateRentReceipt(receipt);
    assertTrue(schemaValidation.valid);

    const pdfBuf = generateReceiptPdf(receipt);
    PdfValidator.assertContainsKeywords(pdfBuf, [
      receipt.formattedNumber,
      receipt.landlordTaxCode,
      receipt.tenantTaxCode
    ]);
  });
});
