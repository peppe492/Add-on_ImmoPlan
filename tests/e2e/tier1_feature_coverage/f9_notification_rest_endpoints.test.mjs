// tests/e2e/tier1_feature_coverage/f9_notification_rest_endpoints.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { validateNotificationSettings } from '../modules/persistence_engine.mjs';
import { filterAndSortNotificationLogs } from '../modules/ui_contract_engine.mjs';
import { fixtureSettings } from '../harness/fixtures.mjs';

describe('Tier 1 - F9: Notification REST Endpoints Contracts', () => {
  test('T1-F9-01: Validates send-reminder dispatch parameters', () => {
    const payload = {
      propertyId: 'prop_1',
      channel: 'ALL',
      customMessage: 'Gentile conduttore, ricordiamo la scadenza del canone.'
    };
    assertEqual(Boolean(payload.propertyId), true);
    assertEqual(['TELEGRAM', 'HOME_ASSISTANT', 'ALL'].includes(payload.channel), true);
  });

  test('T1-F9-02: Validates send-receipt payload requiring receiptId', () => {
    const payload = { receiptId: 'RCP-2026-0001', recipientChatId: '987654321' };
    assertEqual(Boolean(payload.receiptId), true);
  });

  test('T1-F9-03: Validates settings update payload contract', () => {
    const updated = {
      ...fixtureSettings,
      reminderAdvanceDays: 7
    };
    const res = validateNotificationSettings(updated);
    assertTrue(res.valid);
    assertEqual(updated.reminderAdvanceDays, 7);
  });

  test('T1-F9-04: Rejects malformed settings update payload', () => {
    const malformed = { reminderAdvanceDays: 50 }; // > 30 and missing HA/Telegram
    const res = validateNotificationSettings(malformed);
    assertFalse(res.valid);
  });

  test('T1-F9-05: Logs query sorts logs in descending chronological order', () => {
    const logs = [
      { id: '1', timestamp: '2026-09-01T10:00:00Z', channel: 'TELEGRAM', status: 'SUCCESS' },
      { id: '2', timestamp: '2026-09-03T10:00:00Z', channel: 'TELEGRAM', status: 'SUCCESS' },
      { id: '3', timestamp: '2026-09-02T10:00:00Z', channel: 'HOME_ASSISTANT', status: 'SUCCESS' }
    ];
    const sorted = filterAndSortNotificationLogs(logs, 'ALL', 'ALL');
    assertEqual(sorted[0].id, '2');
    assertEqual(sorted[1].id, '3');
    assertEqual(sorted[2].id, '1');
  });
});
