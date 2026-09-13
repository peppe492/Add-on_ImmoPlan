// tests/e2e/tier1_feature_coverage/f5_telegram_bot_api_client.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { MockTelegramServer } from '../harness/mock_telegram.mjs';
import { sendTelegramMessage, sendTelegramDocument } from '../modules/notification_engine.mjs';

describe('Tier 1 - F5: Telegram Bot API Client', () => {
  test('T1-F5-01: Dispatches sendMessage with HTML formatting and verifies payload', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        text: '<b>Promemoria Canone</b>: Il canone di locazione scade a breve.',
        parseMode: 'HTML'
      });

      assertTrue(res.success);
      assertEqual(mockTelegram.sentMessages.length, 1);
      assertEqual(mockTelegram.sentMessages[0].chat_id, '987654321');
      assertEqual(mockTelegram.sentMessages[0].parse_mode, 'HTML');
      assertEqual(mockTelegram.sentMessages[0].text.includes('Promemoria Canone'), true);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T1-F5-02: Dispatches sendDocument with PDF buffer attachment', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const dummyPdfBuffer = Buffer.from('%PDF-1.4 mock content');
      const res = await sendTelegramDocument({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        documentBuffer: dummyPdfBuffer,
        filename: 'quietanza_1_2026.pdf',
        caption: 'Quietanza di pagamento Settembre 2026'
      });

      assertTrue(res.success);
      assertEqual(mockTelegram.sentDocuments.length, 1);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T1-F5-03: Handles HTTP 401 Unauthorized token error gracefully', async () => {
    const mockTelegram = new MockTelegramServer();
    mockTelegram.setMode('INVALID_TOKEN');
    await mockTelegram.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: 'bad_token',
        chatId: '987654321',
        text: 'Hello'
      });
      assertFalse(res.success);
      assertEqual(res.status, 401);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T1-F5-04: Handles HTTP 429 rate limit with retry_after info', async () => {
    const mockTelegram = new MockTelegramServer();
    mockTelegram.setMode('RATE_LIMITED');
    await mockTelegram.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        text: 'Rapid message'
      });
      assertFalse(res.success);
      assertEqual(res.status, 429);
      assertEqual(res.parameters?.retry_after, 5);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T1-F5-05: Returns error without network request when parameters are missing', async () => {
    const res = await sendTelegramMessage({
      botToken: '',
      chatId: '12345',
      text: 'Missing token'
    });
    assertFalse(res.success);
    assertEqual(res.error, 'Bot token is missing');
  });
});
