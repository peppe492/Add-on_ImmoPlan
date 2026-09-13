// tests/e2e/tier4_real_world/real_world_lease_lifecycle.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { MockTelegramServer } from '../harness/mock_telegram.mjs';
import { MockSupervisorServer } from '../harness/mock_supervisor.mjs';
import { PdfValidator } from '../harness/pdf_validator.mjs';
import {
  evaluateRentStatus,
  reconcileServerRentDeadlines,
  calculateRentDueDate
} from '../modules/rent_status_engine.mjs';
import {
  createRentReceipt,
  generateReceiptPdf,
  allocateSequentialReceiptNumber,
  evaluateStampDuty
} from '../modules/receipt_pdf_engine.mjs';
import {
  sendTelegramMessage,
  sendTelegramDocument,
  updateHomeAssistantSensor,
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

describe('Tier 4 - Real-World Application Scenarios (Lease Lifecycles)', () => {
  test('T4-RW-01: Standard On-Time Lease Lifecycle', async () => {
    const mockTG = new MockTelegramServer();
    const mockHA = new MockSupervisorServer();
    await mockTG.start();
    await mockHA.start();
    try {
      const records = [];
      const receipts = [];

      // Step 1: August 20 - Far in advance -> PROGRAMMATO
      const step1 = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, records, '2026-08-20', 5, 2026, 8);
      assertEqual(step1.status, 'PROGRAMMATO');

      // Step 2: September 1 - 4 days before due date -> IN_SCADENZA
      const step2 = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, records, '2026-09-01', 5, 2026, 8);
      assertEqual(step2.status, 'IN_SCADENZA');
      assertEqual(step2.daysUntilDue, 4);

      // Step 3: Trigger automated friendly reminder via Telegram
      const remRes = await sendTelegramMessage({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: fixtureTenant1.telegramChatId,
        text: `Gentile ${fixtureTenant1.name}, promemoria: il canone scade il 05/09/2026.`
      });
      assertTrue(remRes.success);
      assertEqual(mockTG.sentMessages.length, 1);

      // Step 4: September 5 - Tenant pays on due day
      records.push({
        id: 'pmt_sept_ontime',
        propertyId: fixturePropertyCedolare.id,
        year: 2026,
        month: 8,
        income: 850,
        transactionDate: '2026-09-05'
      });

      // Step 5: Status switches to SALDATO
      const step5 = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, records, '2026-09-05', 5, 2026, 8);
      assertEqual(step5.status, 'SALDATO');
      assertTrue(step5.isPaid);

      // Step 6: Generate official receipt 1/2026
      const receipt = createRentReceipt({
        existingReceipts: receipts,
        landlord: fixtureLandlord,
        tenant: fixtureTenant1,
        property: fixturePropertyCedolare,
        paymentRecord: records[0]
      });
      receipts.push(receipt);
      assertEqual(receipt.formattedNumber, '1/2026');
      assertTrue(validateRentReceipt(receipt).valid);

      // Step 7: Dispatch receipt PDF to tenant
      const pdfBuf = generateReceiptPdf(receipt);
      const docRes = await sendTelegramDocument({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: fixtureTenant1.telegramChatId,
        documentBuffer: pdfBuf,
        filename: 'quietanza_1_2026.pdf'
      });
      assertTrue(docRes.success);
      assertEqual(mockTG.sentDocuments.length, 1);

      // Step 8: HA sensor reflects 0 overdue, 1 saldato
      const haRes = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        state: 0,
        attributes: { scaduti: 0, saldati: 1 }
      });
      assertTrue(haRes.success);
    } finally {
      await mockTG.stop();
      await mockHA.stop();
    }
  });

  test('T4-RW-02: Overdue Rent Escalation & Settlement', async () => {
    const mockTG = new MockTelegramServer();
    const mockHA = new MockSupervisorServer();
    await mockTG.start();
    await mockHA.start();
    try {
      const records = [];
      const notifId = `overdue_${fixturePropertyCedolare.id}_2026_09`;

      // Step 1: September 7 - 2 days past due -> SCADUTO
      const step1 = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, records, '2026-09-07', 5);
      assertEqual(step1.status, 'SCADUTO');
      assertEqual(step1.daysUntilDue, -2);

      // Step 2: Post persistent notification to Home Assistant
      const haNotif = await createHomeAssistantNotification({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        notificationId: notifId,
        title: 'Attenzione: Canone Scaduto',
        message: `Il canone di ${fixturePropertyCedolare.name} è scaduto da 2 giorni.`
      });
      assertTrue(haNotif.success);
      assertEqual(mockHA.persistentNotifications.size, 1);

      // Step 3: Send alert to owner via Telegram
      const ownerAlert = await sendTelegramMessage({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: fixtureSettings.telegram.ownerChatId,
        text: `⚠️ <b>Allerta Canone</b>: Inquilino ${fixtureTenant1.name} in ritardo di 2 giorni.`
      });
      assertTrue(ownerAlert.success);

      // Step 4: September 12 - Tenant settles overdue payment
      records.push({
        id: 'pmt_sept_late',
        propertyId: fixturePropertyCedolare.id,
        year: 2026,
        month: 8,
        income: 850,
        transactionDate: '2026-09-12'
      });

      // Step 5: Rent status becomes SALDATO
      const step5 = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, records, '2026-09-12', 5);
      assertEqual(step5.status, 'SALDATO');

      // Step 6: Dismiss persistent notification in HA
      const dismissRes = await dismissHomeAssistantNotification({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        notificationId: notifId
      });
      assertTrue(dismissRes.success);
      assertEqual(mockHA.persistentNotifications.size, 0);

      // Step 7: Update HA sensor state to 0 overdue
      await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        state: 0,
        attributes: { scaduti: 0 }
      });
      assertEqual(mockHA.sensorStates.get('sensor.immoplan_affitti_stato').state, '0');
    } finally {
      await mockTG.stop();
      await mockHA.stop();
    }
  });

  test('T4-RW-03: Multi-Property Portfolio with Mixed Tax Regimes', () => {
    // Property A: Cedolare Secca, rent 850
    const receiptA = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p_a', year: 2026, month: 8, income: 850 },
      taxRegime: 'CEDOLARE_SECCA'
    });
    assertFalse(receiptA.stampDutyApplied);
    assertEqual(receiptA.stampDutyAmount, 0);

    const pdfBufA = generateReceiptPdf(receiptA);
    const textA = PdfValidator.validate(pdfBufA).fullTextContent;
    assertTrue(textA.includes('CEDOLARE_SECCA'));
    assertTrue(textA.includes('art. 3 D.Lgs. 23/2011'));

    // Property B: Regime Ordinario, rent 1100
    const receiptB = createRentReceipt({
      existingReceipts: [receiptA],
      landlord: fixtureLandlord,
      tenant: fixtureTenant2,
      property: fixturePropertyOrdinario,
      paymentRecord: { id: 'p_b', year: 2026, month: 8, income: 1100 },
      taxRegime: 'ORDINARIO'
    });
    assertTrue(receiptB.stampDutyApplied);
    assertEqual(receiptB.stampDutyAmount, 2.00);

    const pdfBufB = generateReceiptPdf(receiptB);
    const textB = PdfValidator.validate(pdfBufB).fullTextContent;
    assertTrue(textB.includes('ORDINARIO'));
    assertTrue(textB.includes('Euro 2,00'));
  });

  test('T4-RW-04: Year-End Fiscal Counter Rollover', () => {
    // 2026: End of year receipts
    const receipts2026 = [
      { receiptNumber: 47, fiscalYear: 2026 },
      { receiptNumber: 48, fiscalYear: 2026 }
    ];

    // January 2027: New fiscal year payment
    const newReceipt = createRentReceipt({
      existingReceipts: receipts2026,
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p_jan_2027', year: 2027, month: 0, income: 850 }
    });

    assertEqual(newReceipt.fiscalYear, 2027);
    assertEqual(newReceipt.receiptNumber, 1);
    assertEqual(newReceipt.formattedNumber, '1/2027');
    assertEqual(newReceipt.id, 'RCP-2027-0001');

    // Subsequent receipt in 2027
    const secondReceipt2027 = createRentReceipt({
      existingReceipts: [...receipts2026, newReceipt],
      landlord: fixtureLandlord,
      tenant: fixtureTenant2,
      property: fixturePropertyOrdinario,
      paymentRecord: { id: 'p_jan_2027_2', year: 2027, month: 0, income: 1100 }
    });
    assertEqual(secondReceipt2027.receiptNumber, 2);
    assertEqual(secondReceipt2027.formattedNumber, '2/2027');
  });

  test('T4-RW-05: Home Assistant Offline Graceful Degradation', async () => {
    const mockTG = new MockTelegramServer();
    await mockTG.start();
    try {
      // Offline HA port
      const haRes = await updateHomeAssistantSensor({
        supervisorUrl: 'http://127.0.0.1:49997',
        token: 'token',
        state: 1
      });
      // Should not throw, returns success: false
      assertFalse(haRes.success);

      // Telegram proceeds independently
      const tgRes = await sendTelegramMessage({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: fixtureTenant1.telegramChatId,
        text: 'Avviso inviato anche con Home Assistant offline.'
      });
      assertTrue(tgRes.success);
      assertEqual(mockTG.sentMessages.length, 1);
    } finally {
      await mockTG.stop();
    }
  });

  test('T4-RW-06: Telegram Bot Throttling & Rate Limit Recovery', async () => {
    const mockTG = new MockTelegramServer();
    mockTG.setMode('RATE_LIMITED');
    await mockTG.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        text: 'Throttled message'
      });
      assertFalse(res.success);
      assertEqual(res.status, 429);
      assertEqual(res.parameters?.retry_after, 5);

      // Simulating recovery
      mockTG.setMode('ONLINE');
      const retryRes = await sendTelegramMessage({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        text: 'Recovered message'
      });
      assertTrue(retryRes.success);
    } finally {
      await mockTG.stop();
    }
  });

  test('T4-RW-07: Lease Changeover (Tenant Move-Out & Move-In)', () => {
    // Old tenant moves out on June 30
    const oldTenant = { ...fixtureTenant1, id: 'tenant_old', rentDueDay: 5 };
    const newTenant = { ...fixtureTenant2, id: 'tenant_new', rentDueDay: 15, telegramChatId: '776655443' };

    // Property now leased to new tenant
    const propertyTransition = { ...fixturePropertyCedolare, currentTenantId: 'tenant_new' };

    // Due date calculated for new tenant in July
    const dueDate = calculateRentDueDate(propertyTransition, newTenant, 2026, 6); // July 2026
    assertEqual(dueDate, '2026-07-15');

    // Status evaluation on July 10 (5 days before due date 15) -> IN_SCADENZA
    const status = evaluateRentStatus(propertyTransition, newTenant, [], '2026-07-10', 5);
    assertEqual(status.status, 'IN_SCADENZA');
    assertEqual(status.tenantTelegramChatId, '776655443');
  });

  test('T4-RW-08: Split Partial Payments & Arrears Resolution', () => {
    const records = [];

    // Monthly rent: 850
    // Payment 1: 400 on Sept 2
    records.push({
      id: 'p_part_1',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8,
      income: 400,
      transactionDate: '2026-09-02'
    });

    // On Sept 6 (past due date Sept 5) -> SCADUTO because 400 < 850
    const check1 = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, records, '2026-09-06', 5);
    assertEqual(check1.status, 'SCADUTO');
    assertEqual(check1.paidAmount, 400);

    // Payment 2: Remaining 450 paid on Sept 10
    records.push({
      id: 'p_part_2',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8,
      income: 450,
      transactionDate: '2026-09-10'
    });

    // Check again on Sept 10 -> SALDATO (total 850)
    const check2 = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, records, '2026-09-10', 5);
    assertEqual(check2.status, 'SALDATO');
    assertEqual(check2.paidAmount, 850);
    assertTrue(check2.isPaid);
  });

  test('T4-RW-09: End-to-End Quietanza PDF Integrity & Print Structure', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'pmt_print', year: 2026, month: 8, income: 850 }
    });

    const pdfBuf = generateReceiptPdf(receipt);
    const val = PdfValidator.validate(pdfBuf);
    assertTrue(val.isValid);
    assertEqual(val.version, '1.4');

    // Check all essential keywords are present
    PdfValidator.assertContainsKeywords(pdfBuf, [
      'QUIETANZA DI PAGAMENTO',
      receipt.formattedNumber,
      fixtureLandlord.name,
      fixtureTenant1.name,
      fixturePropertyCedolare.name,
      'TOTALE CORRISPOSTO E SALDATO'
    ]);
  });

  test('T4-RW-10: Complete Settings Lifecycle & Persistence', () => {
    // Initial settings
    let currentSettings = { ...fixtureSettings };
    assertTrue(validateNotificationSettings(currentSettings).valid);

    // User modifies advance days to 7 and updates token
    currentSettings = {
      ...currentSettings,
      reminderAdvanceDays: 7,
      telegram: {
        ...currentSettings.telegram,
        botToken: '987654321:NEW_BOT_TOKEN_ABC'
      }
    };
    assertTrue(validateNotificationSettings(currentSettings).valid);

    // Status engine uses new 7-day threshold:
    // Due date Sept 5. Today is Aug 29 (7 days away) -> IN_SCADENZA with 7 days threshold!
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-08-29', currentSettings.reminderAdvanceDays, 2026, 8);
    assertEqual(res.status, 'IN_SCADENZA');
    assertEqual(res.daysUntilDue, 7);
  });
});
