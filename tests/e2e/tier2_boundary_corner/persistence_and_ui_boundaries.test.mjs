// tests/e2e/tier2_boundary_corner/persistence_and_ui_boundaries.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { validateNotificationSettings, validateRentReceipt } from '../modules/persistence_engine.mjs';
import {
  getRentBadgeInfo,
  validateTelegramChatId,
  getRentQuickActionsState,
  filterAndSortNotificationLogs
} from '../modules/ui_contract_engine.mjs';
import { createRentReceipt, generateReceiptPdf } from '../modules/receipt_pdf_engine.mjs';
import { PdfValidator } from '../harness/pdf_validator.mjs';
import { fixtureLandlord, fixtureTenant1, fixturePropertyCedolare, fixtureSettings } from '../harness/fixtures.mjs';

describe('Tier 2 - Persistence & UI Contracts Boundaries', () => {
  // F4 Data Models Boundaries
  test('T2-F4-01: reminderAdvanceDays = 0 is valid (alert on due day only)', () => {
    const s0 = { ...fixtureSettings, reminderAdvanceDays: 0 };
    assertTrue(validateNotificationSettings(s0).valid);
  });

  test('T2-F4-02: reminderAdvanceDays = 30 is the maximum allowed valid threshold', () => {
    const s30 = { ...fixtureSettings, reminderAdvanceDays: 30 };
    assertTrue(validateNotificationSettings(s30).valid);
  });

  test('T2-F4-03: Rejects receipt validation with negative totalAmount', () => {
    const invalidReceipt = {
      id: 'RCP-2026-0001',
      receiptNumber: 1,
      fiscalYear: 2026,
      formattedNumber: '1/2026',
      issueDate: '2026-09-01',
      propertyId: 'p1',
      propertyName: 'Prop',
      tenantId: 't1',
      tenantName: 'Tenant',
      landlordName: 'Landlord',
      totalAmount: -100,
      taxRegime: 'CEDOLARE_SECCA',
      stampDutyApplied: false,
      stampDutyAmount: 0
    };
    assertFalse(validateRentReceipt(invalidReceipt).valid);
  });

  test('T2-F4-04: Rejects receipt validation with missing landlordName', () => {
    const invalidReceipt = {
      id: 'RCP-2026-0001',
      receiptNumber: 1,
      fiscalYear: 2026,
      formattedNumber: '1/2026',
      issueDate: '2026-09-01',
      propertyId: 'p1',
      propertyName: 'Prop',
      tenantId: 't1',
      tenantName: 'Tenant',
      landlordName: '', // Missing
      totalAmount: 850,
      taxRegime: 'CEDOLARE_SECCA',
      stampDutyApplied: false,
      stampDutyAmount: 0
    };
    assertFalse(validateRentReceipt(invalidReceipt).valid);
  });

  test('T2-F4-05: Rejects receipt with unknown tax regime', () => {
    const invalidReceipt = {
      id: 'RCP-2026-0001',
      receiptNumber: 1,
      fiscalYear: 2026,
      formattedNumber: '1/2026',
      issueDate: '2026-09-01',
      propertyId: 'p1',
      propertyName: 'Prop',
      tenantId: 't1',
      tenantName: 'Tenant',
      landlordName: 'Landlord',
      totalAmount: 850,
      taxRegime: 'UNKNOWN_REGIME',
      stampDutyApplied: false,
      stampDutyAmount: 0
    };
    assertFalse(validateRentReceipt(invalidReceipt).valid);
  });

  // F13 Settings UI Panel Boundaries
  test('T2-F13-01: Rejects negative reminderAdvanceDays (-1)', () => {
    assertFalse(validateNotificationSettings({ ...fixtureSettings, reminderAdvanceDays: -1 }).valid);
  });

  test('T2-F13-02: Rejects reminderAdvanceDays > 30 (31)', () => {
    assertFalse(validateNotificationSettings({ ...fixtureSettings, reminderAdvanceDays: 31 }).valid);
  });

  test('T2-F13-03: Allows disabling both notification channels simultaneously', () => {
    const disabledBoth = {
      ...fixtureSettings,
      homeAssistant: { ...fixtureSettings.homeAssistant, enabled: false },
      telegram: { ...fixtureSettings.telegram, enabled: false }
    };
    assertTrue(validateNotificationSettings(disabledBoth).valid);
  });

  test('T2-F13-04: Rejects non-boolean autoCheckEnabled', () => {
    assertFalse(validateNotificationSettings({ ...fixtureSettings, autoCheckEnabled: 'true' }).valid);
  });

  test('T2-F13-05: Rejects missing homeAssistant configuration object', () => {
    assertFalse(validateNotificationSettings({ ...fixtureSettings, homeAssistant: null }).valid);
  });

  // F14 Tenant Telegram Contact Boundaries
  test('T2-F14-01: Chat ID with leading and trailing spaces is trimmed cleanly', () => {
    const res = validateTelegramChatId('   987654321   ');
    assertTrue(res.valid);
    assertEqual(res.sanitized, '987654321');
  });

  test('T2-F14-02: Empty or null Chat ID returns valid null without error (optional field)', () => {
    assertEqual(validateTelegramChatId('').valid, true);
    assertEqual(validateTelegramChatId(null).valid, true);
  });

  test('T2-F14-03: Non-numeric telegram handle (@username) is rejected', () => {
    const res = validateTelegramChatId('@test_user');
    assertFalse(res.valid);
    assertTrue(res.error.includes('numerico'));
  });

  test('T2-F14-04: Supergroup negative Chat ID is accepted', () => {
    const res = validateTelegramChatId('-1001234567890');
    assertTrue(res.valid);
    assertEqual(res.sanitized, '-1001234567890');
  });

  test('T2-F14-05: Chat ID containing alphabetic characters is rejected', () => {
    assertFalse(validateTelegramChatId('chat_12345').valid);
  });

  // F15 Rent Monitoring View & Badges Boundaries
  test('T2-F15-01: Extreme overdue (180 days) formats rose badge with correct day count', () => {
    const badge = getRentBadgeInfo('SCADUTO', -180);
    assertEqual(badge.label, 'Scaduto (180 gg fa)');
    assertEqual(badge.badgeColor, 'rose');
  });

  test('T2-F15-02: SALDATO badge always returns check-circle icon', () => {
    const badge = getRentBadgeInfo('SALDATO', 0);
    assertEqual(badge.icon, 'check-circle');
    assertEqual(badge.badgeColor, 'emerald');
  });

  test('T2-F15-03: IN_SCADENZA on due day (0 days) displays "Scade Oggi"', () => {
    const badge = getRentBadgeInfo('IN_SCADENZA', 0);
    assertEqual(badge.label, 'Scade Oggi');
  });

  test('T2-F15-04: PROGRAMMATO badge returns calendar icon and slate color', () => {
    const badge = getRentBadgeInfo('PROGRAMMATO', 14);
    assertEqual(badge.icon, 'calendar');
    assertEqual(badge.badgeColor, 'slate');
  });

  test('T2-F15-05: SCADUTO 1 day overdue displays "Scaduto (1 gg fa)"', () => {
    const badge = getRentBadgeInfo('SCADUTO', -1);
    assertEqual(badge.label, 'Scaduto (1 gg fa)');
  });

  // F16 Quick Action Buttons Boundaries
  test('T2-F16-01: Disabled reasons explain exactly why buttons are inactive', () => {
    const overdueNoChat = { status: 'SCADUTO', tenantTelegramChatId: null };
    const actions = getRentQuickActionsState(overdueNoChat);
    assertTrue(actions.canSendReminder);
    assertFalse(actions.canGenerateReceipt);
    assertEqual(actions.disabledReasons.generateReceipt, 'Canone non ancora saldato');
  });

  test('T2-F16-02: Cannot send receipt via Telegram when rent is unpaid', () => {
    const unpaidWithTelegram = { status: 'IN_SCADENZA', tenantTelegramChatId: '123' };
    const actions = getRentQuickActionsState(unpaidWithTelegram);
    assertFalse(actions.canSendReceiptTelegram);
  });

  test('T2-F16-03: Cannot send receipt via Telegram when tenant Chat ID is missing', () => {
    const paidNoChat = { status: 'SALDATO', tenantTelegramChatId: '' };
    const actions = getRentQuickActionsState(paidNoChat);
    assertFalse(actions.canSendReceiptTelegram);
    assertTrue(actions.disabledReasons.sendReceiptTelegram.includes('sprovvisto'));
  });

  test('T2-F16-04: Cannot send reminder when rent is already paid', () => {
    const paid = { status: 'SALDATO', tenantTelegramChatId: '123' };
    const actions = getRentQuickActionsState(paid);
    assertFalse(actions.canSendReminder);
    assertEqual(actions.disabledReasons.sendReminder, 'Canone già saldato');
  });

  test('T2-F16-05: Can generate receipt when rent is SALDATO', () => {
    const paid = { status: 'SALDATO', tenantTelegramChatId: '123' };
    const actions = getRentQuickActionsState(paid);
    assertTrue(actions.canGenerateReceipt);
  });

  // F17 Receipt Preview & Export Modal Boundaries
  test('T2-F17-01: Modal receipt generation produces valid PDF buffer', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfBuf = generateReceiptPdf(receipt);
    assertTrue(PdfValidator.validate(pdfBuf).isValid);
  });

  test('T2-F17-02: Sanitizes slash in receipt number for file download name', () => {
    const receipt = createRentReceipt({
      existingReceipts: [{ receiptNumber: 12, fiscalYear: 2026 }],
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    assertEqual(receipt.formattedNumber, '13/2026');
    const filename = `quietanza_${receipt.formattedNumber.replace('/', '_')}.pdf`;
    assertEqual(filename, 'quietanza_13_2026.pdf');
  });

  test('T2-F17-03: Preserves empty notes in receipt without error', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 },
      notes: ''
    });
    assertEqual(receipt.notes, '');
  });

  test('T2-F17-04: Receipt handles zero expenses amount', () => {
    const propNoExpenses = { ...fixturePropertyCedolare, financials: { ...fixturePropertyCedolare.financials, condoFees: 0 } };
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: propNoExpenses,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    assertEqual(receipt.expensesAmount, 0);
  });

  test('T2-F17-05: Receipt PDF contains all required preview sections', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfBuf = generateReceiptPdf(receipt);
    const content = PdfValidator.validate(pdfBuf).fullTextContent;
    assertTrue(content.includes('QUIETANZA DI PAGAMENTO'));
    assertTrue(content.includes('DATI DEL LOCATORE'));
    assertTrue(content.includes('DATI DEL CONDUTTORE'));
    assertTrue(content.includes('VOCE CONTABILE'));
  });

  // F18 Notification History Log Boundaries
  test('T2-F18-01: Log filtering returns empty array when no logs match channel filter', () => {
    const logs = [{ id: '1', channel: 'TELEGRAM', status: 'SUCCESS', timestamp: '2026-09-01T00:00:00Z' }];
    const res = filterAndSortNotificationLogs(logs, 'HOME_ASSISTANT', 'ALL');
    assertEqual(res.length, 0);
  });

  test('T2-F18-02: Log filtering handles empty or null input array safely', () => {
    assertEqual(filterAndSortNotificationLogs([]).length, 0);
    assertEqual(filterAndSortNotificationLogs(null).length, 0);
  });

  test('T2-F18-03: Log filtering by SUCCESS status returns only successful dispatches', () => {
    const logs = [
      { id: '1', channel: 'TELEGRAM', status: 'SUCCESS', timestamp: '2026-09-01T00:00:00Z' },
      { id: '2', channel: 'TELEGRAM', status: 'FAILED', timestamp: '2026-09-02T00:00:00Z' }
    ];
    const res = filterAndSortNotificationLogs(logs, 'ALL', 'SUCCESS');
    assertEqual(res.length, 1);
    assertEqual(res[0].id, '1');
  });

  test('T2-F18-04: Log sorting orders three logs with identical date by time correctly', () => {
    const logs = [
      { id: '1', channel: 'TELEGRAM', status: 'SUCCESS', timestamp: '2026-09-01T08:00:00Z' },
      { id: '2', channel: 'TELEGRAM', status: 'SUCCESS', timestamp: '2026-09-01T12:00:00Z' },
      { id: '3', channel: 'TELEGRAM', status: 'SUCCESS', timestamp: '2026-09-01T10:00:00Z' }
    ];
    const sorted = filterAndSortNotificationLogs(logs, 'ALL', 'ALL');
    assertEqual(sorted[0].id, '2');
    assertEqual(sorted[1].id, '3');
    assertEqual(sorted[2].id, '1');
  });

  test('T2-F18-05: Preserves error details string in failed log entry', () => {
    const log = {
      id: 'err_1',
      timestamp: '2026-09-01T00:00:00Z',
      channel: 'TELEGRAM',
      status: 'FAILED',
      details: 'HTTP 403: Bot was blocked by the user'
    };
    const res = filterAndSortNotificationLogs([log], 'ALL', 'ALL');
    assertEqual(res[0].details, 'HTTP 403: Bot was blocked by the user');
  });
});
