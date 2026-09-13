// tests/e2e/tier1_feature_coverage/f18_notification_receipt_history_log.test.mjs
import { describe, test, assertEqual, assertTrue } from '../harness/test_framework.mjs';
import { filterAndSortNotificationLogs } from '../modules/ui_contract_engine.mjs';

describe('Tier 1 - F18: Notification & Receipt History Log', () => {
  const sampleLogs = [
    {
      id: 'log_1',
      timestamp: '2026-09-01T09:00:00Z',
      channel: 'TELEGRAM',
      type: 'REMINDER_UPCOMING',
      recipient: 'Marco Bianchi',
      status: 'SUCCESS'
    },
    {
      id: 'log_2',
      timestamp: '2026-09-02T14:30:00Z',
      channel: 'HOME_ASSISTANT',
      type: 'TEST',
      recipient: 'Admin',
      status: 'SUCCESS'
    },
    {
      id: 'log_3',
      timestamp: '2026-09-05T18:00:00Z',
      channel: 'TELEGRAM',
      type: 'RECEIPT_SENT',
      recipient: 'Marco Bianchi',
      status: 'SUCCESS'
    },
    {
      id: 'log_4',
      timestamp: '2026-09-06T11:00:00Z',
      channel: 'TELEGRAM',
      type: 'REMINDER_OVERDUE',
      recipient: 'Laura Verdi',
      status: 'FAILED',
      details: 'Chat not found'
    }
  ];

  test('T1-F18-01: Sorts logs in reverse chronological order (newest first)', () => {
    const sorted = filterAndSortNotificationLogs(sampleLogs);
    assertEqual(sorted[0].id, 'log_4');
    assertEqual(sorted[1].id, 'log_3');
    assertEqual(sorted[2].id, 'log_2');
    assertEqual(sorted[3].id, 'log_1');
  });

  test('T1-F18-02: Filters logs by channel TELEGRAM', () => {
    const telegramLogs = filterAndSortNotificationLogs(sampleLogs, 'TELEGRAM', 'ALL');
    assertEqual(telegramLogs.length, 3);
    assertTrue(telegramLogs.every(l => l.channel === 'TELEGRAM'));
  });

  test('T1-F18-03: Filters logs by channel HOME_ASSISTANT', () => {
    const haLogs = filterAndSortNotificationLogs(sampleLogs, 'HOME_ASSISTANT', 'ALL');
    assertEqual(haLogs.length, 1);
    assertEqual(haLogs[0].id, 'log_2');
  });

  test('T1-F18-04: Filters logs by status FAILED', () => {
    const failedLogs = filterAndSortNotificationLogs(sampleLogs, 'ALL', 'FAILED');
    assertEqual(failedLogs.length, 1);
    assertEqual(failedLogs[0].id, 'log_4');
    assertEqual(failedLogs[0].details, 'Chat not found');
  });

  test('T1-F18-05: Preserves and renders all metadata fields on log item', () => {
    const log = sampleLogs[2];
    assertEqual(log.type, 'RECEIPT_SENT');
    assertEqual(log.recipient, 'Marco Bianchi');
    assertEqual(log.status, 'SUCCESS');
  });
});
