// tests/e2e/tier1_feature_coverage/f6_telegram_connection_test.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { MockTelegramServer } from '../harness/mock_telegram.mjs';
import { testTelegramConnection } from '../modules/notification_engine.mjs';

describe('Tier 1 - F6: Telegram Connection Test', () => {
  test('T1-F6-01: Valid token returns success with bot username', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const res = await testTelegramConnection({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token'
      });
      assertTrue(res.success);
      assertEqual(res.botUsername, 'immoplan_notification_bot');
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T1-F6-02: Missing or blank bot token returns validation failure immediately', async () => {
    const res = await testTelegramConnection({ botToken: '   ' });
    assertFalse(res.success);
    assertEqual(res.message, 'Bot Token mancante');
  });

  test('T1-F6-03: Invalid token returns failure without throwing exception', async () => {
    const mockTelegram = new MockTelegramServer();
    mockTelegram.setMode('INVALID_TOKEN');
    await mockTelegram.start();
    try {
      const res = await testTelegramConnection({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: 'bad_token'
      });
      assertFalse(res.success);
      assertEqual(res.message.includes('Errore Telegram'), true);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T1-F6-04: Offline server returns network unreachable error gracefully', async () => {
    // Port that is definitely not listening
    const res = await testTelegramConnection({
      baseUrl: 'http://127.0.0.1:49999',
      botToken: 'valid_token'
    });
    assertFalse(res.success);
    assertEqual(res.message.includes('Impossibile connettersi'), true);
  });

  test('T1-F6-05: Sanitizes whitespace in token before calling getMe', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const res = await testTelegramConnection({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '  123456789:valid_token  \n'
      });
      assertTrue(res.success);
      assertEqual(res.botUsername, 'immoplan_notification_bot');
    } finally {
      await mockTelegram.stop();
    }
  });
});
