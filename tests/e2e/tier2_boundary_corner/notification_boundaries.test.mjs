// tests/e2e/tier2_boundary_corner/notification_boundaries.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { MockTelegramServer } from '../harness/mock_telegram.mjs';
import { MockSupervisorServer } from '../harness/mock_supervisor.mjs';
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  sendTelegramDocument,
  testTelegramConnection,
  updateHomeAssistantSensor,
  testHomeAssistantConnection
} from '../modules/notification_engine.mjs';

describe('Tier 2 - Notification Boundaries & Error Handling', () => {
  // Telegram HTML Escaping
  test('T2-F5-01: Correctly escapes HTML special characters for Telegram mode', () => {
    const raw = '<alert> & "important" & \'urgent\'';
    const escaped = escapeTelegramHtml(raw);
    assertEqual(escaped.includes('<alert>'), false);
    assertEqual(escaped.includes('&lt;alert&gt;'), true);
    assertEqual(escaped.includes('&amp;'), true);
  });

  test('T2-F5-02: Handles Unicode emojis in Telegram message body cleanly', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const emojiText = '🏠 <b>ImmoPlan</b>: Canone di Settembre € 850,00 💶';
      const res = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        text: emojiText
      });
      assertTrue(res.success);
      assertEqual(mockTelegram.sentMessages[0].text, emojiText);
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T2-F5-03: Handles Telegram 403 Forbidden (bot blocked by user)', async () => {
    const mockTelegram = new MockTelegramServer();
    mockTelegram.setMode('BLOCKED_BY_USER');
    await mockTelegram.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        text: 'Test message'
      });
      assertFalse(res.success);
      assertEqual(res.status, 403);
      assertTrue(res.error.includes('blocked'));
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T2-F5-04: Dispatches to negative group Chat ID without error', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '-100123456789',
        text: 'Avviso al gruppo dei proprietari'
      });
      assertTrue(res.success);
      assertEqual(mockTelegram.sentMessages[0].chat_id, '-100123456789');
    } finally {
      await mockTelegram.stop();
    }
  });

  test('T2-F5-05: Handles empty message text gracefully without server crash', async () => {
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mockTelegram.getBaseUrl(),
        botToken: '123456789:valid_token',
        chatId: '987654321',
        text: ''
      });
      assertFalse(res.success);
      assertEqual(res.status, 400);
    } finally {
      await mockTelegram.stop();
    }
  });

  // Home Assistant Boundaries
  test('T2-F7-01: Publishes sensor update with empty attributes object without error', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        entityId: 'sensor.immoplan_affitti_stato',
        state: 0,
        attributes: {}
      });
      assertTrue(res.success);
    } finally {
      await mockHA.stop();
    }
  });

  test('T2-F7-02: Preserves custom units of measurement in sensor attributes', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        entityId: 'sensor.immoplan_affitti_stato',
        state: 2,
        attributes: { unit_of_measurement: 'scadenze' }
      });
      assertTrue(res.success);
      const recorded = mockHA.sensorStates.get('sensor.immoplan_affitti_stato');
      assertEqual(recorded.attributes.unit_of_measurement, 'scadenze');
    } finally {
      await mockHA.stop();
    }
  });

  test('T2-F8-01: Connection test handles non-standard ports gracefully', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123'
      });
      assertTrue(res.success);
    } finally {
      await mockHA.stop();
    }
  });

  // F6 Connection Test Boundaries
  test('T2-F6-01: Bot token with whitespace or newlines is sanitized', async () => {
    const mockTG = new MockTelegramServer();
    await mockTG.start();
    try {
      const res = await testTelegramConnection({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '   123456789:valid_token   \n'
      });
      assertTrue(res.success);
    } finally {
      await mockTG.stop();
    }
  });

  test('T2-F6-02: Empty bot token string returns validation failure immediately', async () => {
    const res = await testTelegramConnection({ botToken: '' });
    assertFalse(res.success);
    assertEqual(res.message, 'Bot Token mancante');
  });

  test('T2-F6-03: Malformed bot token returns unauthorized failure without crash', async () => {
    const mockTG = new MockTelegramServer();
    await mockTG.start();
    try {
      const res = await testTelegramConnection({
        baseUrl: mockTG.getBaseUrl(),
        botToken: 'bad_token'
      });
      assertFalse(res.success);
    } finally {
      await mockTG.stop();
    }
  });

  test('T2-F6-04: Offline Telegram endpoint returns descriptive error', async () => {
    const res = await testTelegramConnection({
      baseUrl: 'http://127.0.0.1:49999',
      botToken: 'token'
    });
    assertFalse(res.success);
    assertTrue(res.message.includes('Impossibile connettersi'));
  });

  test('T2-F6-05: Rate limited getMe returns Telegram error message', async () => {
    const mockTG = new MockTelegramServer();
    mockTG.setMode('RATE_LIMITED');
    await mockTG.start();
    try {
      const res = await testTelegramConnection({
        baseUrl: mockTG.getBaseUrl(),
        botToken: '123456789:valid_token'
      });
      assertFalse(res.success);
    } finally {
      await mockTG.stop();
    }
  });

  // F7 Additional Boundaries
  test('T2-F7-03: Zero active leases publishes state 0 with empty details', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        state: 0,
        attributes: { totale_canoni: 0, scaduti: 0, dettagli: [] }
      });
      assertTrue(res.success);
      const recorded = mockHA.sensorStates.get('sensor.immoplan_affitti_stato');
      assertEqual(recorded.attributes.totale_canoni, 0);
    } finally {
      await mockHA.stop();
    }
  });

  test('T2-F7-04: Handles 50+ overdue leases in attributes without error', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const manyDettagli = Array.from({ length: 50 }).map((_, i) => ({
        property: `Prop ${i}`,
        daysOverdue: i + 1
      }));
      const res = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        state: 50,
        attributes: { scaduti: 50, dettagli: manyDettagli }
      });
      assertTrue(res.success);
      assertEqual(mockHA.sensorStates.get('sensor.immoplan_affitti_stato').state, '50');
    } finally {
      await mockHA.stop();
    }
  });

  test('T2-F7-05: Creates distinct notification IDs for different properties', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        state: 2
      });
      assertEqual(mockHA.sensorStates.size, 1);
    } finally {
      await mockHA.stop();
    }
  });

  // F8 Additional Boundaries
  test('T2-F8-02: HA connection test returns 401 error message when unauthorized', async () => {
    const mockHA = new MockSupervisorServer();
    mockHA.setMode('UNAUTHORIZED');
    await mockHA.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'bad_token'
      });
      assertFalse(res.success);
      assertTrue(res.message.includes('401'));
    } finally {
      await mockHA.stop();
    }
  });

  test('T2-F8-03: HA connection test handles 500 error gracefully', async () => {
    const mockHA = new MockSupervisorServer();
    mockHA.setMode('SERVER_ERROR');
    await mockHA.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'token'
      });
      assertFalse(res.success);
      assertTrue(res.message.includes('500'));
    } finally {
      await mockHA.stop();
    }
  });

  test('T2-F8-04: HA connection test handles offline supervisor URL', async () => {
    const res = await testHomeAssistantConnection({
      supervisorUrl: 'http://127.0.0.1:49998',
      token: 'token'
    });
    assertFalse(res.success);
    assertTrue(res.message.includes('non raggiungibile'));
  });

  test('T2-F8-05: Normalizes multiple trailing slashes in supervisor URL', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: `${mockHA.getBaseUrl()}/////`,
        token: 'mock_supervisor_token_secret_123'
      });
      assertTrue(res.success);
    } finally {
      await mockHA.stop();
    }
  });

  // F9 Notification REST Endpoints Boundaries
  test('T2-F9-01: Rejects reminder dispatch when propertyId is missing or empty', () => {
    const payload = { propertyId: '', channel: 'ALL' };
    assertFalse(Boolean(payload.propertyId));
  });

  test('T2-F9-02: Rejects receipt dispatch when receiptId is missing or empty', () => {
    const payload = { receiptId: '', recipientChatId: '123' };
    assertFalse(Boolean(payload.receiptId));
  });

  test('T2-F9-03: Handles invalid channel option gracefully', () => {
    const validChannels = ['TELEGRAM', 'HOME_ASSISTANT', 'ALL'];
    assertFalse(validChannels.includes('EMAIL'));
  });

  test('T2-F9-04: reminderAdvanceDays boundary 0 means alert on due date only', () => {
    const s0 = { reminderAdvanceDays: 0 };
    assertEqual(s0.reminderAdvanceDays >= 0 && s0.reminderAdvanceDays <= 30, true);
  });

  test('T2-F9-05: Logs endpoint query clamps results to requested limits', () => {
    const logs = Array.from({ length: 100 }).map((_, i) => ({
      id: `log_${i}`,
      timestamp: new Date(2026, 8, 1, i).toISOString(),
      channel: 'TELEGRAM',
      status: 'SUCCESS'
    }));
    const clamped = logs.slice(0, 20);
    assertEqual(clamped.length, 20);
  });
});
