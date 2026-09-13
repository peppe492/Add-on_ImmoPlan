// tests/e2e/tier1_feature_coverage/f4_data_models_db_schema.test.mjs
import { describe, test, assertTrue, assertFalse, assertEqual } from '../harness/test_framework.mjs';
import { validateRentReceipt, validateNotificationSettings, validateNotificationLog } from '../modules/persistence_engine.mjs';
import { createRentReceipt } from '../modules/receipt_pdf_engine.mjs';
import { fixtureLandlord, fixtureTenant1, fixturePropertyCedolare, fixtureSettings } from '../harness/fixtures.mjs';

describe('Tier 1 - F4: Data Models & DB Schema', () => {
  test('T1-F4-01: Validates a fully populated RentReceipt object', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'pmt_1', year: 2026, month: 8, income: 850 }
    });
    const res = validateRentReceipt(receipt);
    assertTrue(res.valid, `Expected valid receipt, got errors: ${res.errors.join(', ')}`);
  });

  test('T1-F4-02: Rejects RentReceipt with missing required fields', () => {
    const invalidReceipt = {
      id: 'RCP-2026-0001',
      totalAmount: 850
      // missing landlord, tenant, formattedNumber, etc.
    };
    const res = validateRentReceipt(invalidReceipt);
    assertFalse(res.valid);
    assertTrue(res.errors.length > 0);
  });

  test('T1-F4-03: Validates NotificationSettings schema and constraints', () => {
    const res = validateNotificationSettings(fixtureSettings);
    assertTrue(res.valid, `Expected valid settings, got errors: ${res.errors.join(', ')}`);
  });

  test('T1-F4-04: Rejects NotificationSettings with out-of-range advance days', () => {
    const invalidSettings = {
      ...fixtureSettings,
      reminderAdvanceDays: -3
    };
    const res = validateNotificationSettings(invalidSettings);
    assertFalse(res.valid);
  });

  test('T1-F4-05: Validates NotificationLog schema and channel enum', () => {
    const log = {
      id: 'log_123',
      timestamp: new Date().toISOString(),
      channel: 'TELEGRAM',
      type: 'REMINDER_UPCOMING',
      recipient: '987654321',
      status: 'SUCCESS'
    };
    const res = validateNotificationLog(log);
    assertTrue(res.valid);
  });
});
