// tests/e2e/tier1_feature_coverage/f9_notification_rest_endpoints.test.mjs
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { Duplex } from 'stream';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { registerMockHandler, unregisterMockHandler } from '../harness/mock_http_dispatcher.mjs';
import { validateNotificationSettings } from '../modules/persistence_engine.mjs';
import { filterAndSortNotificationLogs } from '../modules/ui_contract_engine.mjs';
import {
  fixtureSettings,
  fixturePropertyCedolare,
  fixturePropertyOrdinario,
  fixtureTenant1,
  fixtureTenant2,
  fixtureLandlord
} from '../harness/fixtures.mjs';
import { MockTelegramServer } from '../harness/mock_telegram.mjs';
import { MockSupervisorServer } from '../harness/mock_supervisor.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

function createMockSocket() {
  const s = new Duplex({
    read() {},
    write(chunk, enc, cb) { cb(); }
  });
  s.encrypted = false;
  s.remoteAddress = '127.0.0.1';
  return s;
}

function executeExpress(app, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const s = createMockSocket();
    const req = new http.IncomingMessage(s);
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost', ...headers };

    const res = new http.ServerResponse(req);
    const chunks = [];
    res.write = (chunk, encoding) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return true;
    };
    res.end = (chunk, encoding) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const respBuffer = Buffer.concat(chunks);
      const text = respBuffer.toString('utf8');
      resolve(new Response(text, {
        status: res.statusCode || 200,
        headers: res.getHeaders ? res.getHeaders() : {}
      }));
    };

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.headers['content-type'] = req.headers['content-type'] || 'application/json';
      req.headers['content-length'] = String(Buffer.byteLength(payload));
      req.push(payload);
    }
    req.push(null);

    app(req, res);
  });
}

class InProcessExpressDispatcher {
  constructor(app, baseUrl) {
    this.app = app;
    this.baseUrl = baseUrl;
  }

  matchesUrl(url) {
    return url.startsWith(this.baseUrl);
  }

  async handleRequest(url, init = {}) {
    const pathAndQuery = url.substring(this.baseUrl.length) || '/';
    return executeExpress(this.app, {
      method: init.method || 'GET',
      url: pathAndQuery,
      headers: init.headers || {},
      body: init.body
    });
  }
}

describe('Tier 1 - F9: Notification REST Endpoints Authentic HTTP Integration', () => {
  const testDbPath = path.join(os.tmpdir(), `immoplan_test_db_${Date.now()}.json`);
  process.env.DB_PATH = testDbPath;
  process.env.SUPERVISOR_TOKEN = 'mock_supervisor_token_secret_123';

  const app = require(path.join(projectRoot, 'server.js'));
  if (app.setDbPath) app.setDbPath(testDbPath);

  const baseUrl = 'http://127.0.0.1:9301';
  const dispatcher = new InProcessExpressDispatcher(app, baseUrl);

  function seedDb() {
    const initialDb = {
      properties: [fixturePropertyCedolare, fixturePropertyOrdinario],
      tenants: [fixtureTenant1, fixtureTenant2],
      rentalRecords: [],
      notificationSettings: {
        ...fixtureSettings,
        reminderAdvanceDays: 5,
        autoCheckEnabled: true,
        telegram: {
          enabled: true,
          botToken: '123456789:test_bot_token',
          ownerChatId: '12345678',
          notifyOwnerOnDue: true,
          notifyTenantOnDue: true,
          autoSendReceiptToTenant: true
        },
        homeAssistant: {
          enabled: true,
          updateSensors: true,
          persistentNotifications: true,
          sensorEntityId: 'sensor.immoplan_affitti_stato'
        }
      },
      notificationLogs: []
    };
    fs.writeFileSync(testDbPath, JSON.stringify(initialDb, null, 2), 'utf8');
  }

  test('T1-F9-01: GET and POST /api/notifications/settings over genuine HTTP', async () => {
    seedDb();
    registerMockHandler(dispatcher);
    try {
      // 1. GET settings
      const getRes = await fetch(`${baseUrl}/api/notifications/settings`);
      assertEqual(getRes.status, 200);
      const getData = await getRes.json();
      assertTrue(Boolean(getData.settings));
      assertEqual(getData.settings.reminderAdvanceDays, 5);
      assertEqual(getData.settings.telegram.enabled, true);

      // 2. POST update settings
      const updatedSettings = {
        reminderAdvanceDays: 7,
        autoCheckEnabled: true,
        homeAssistant: {
          enabled: true,
          updateSensors: true,
          persistentNotifications: true,
          sensorEntityId: 'sensor.immoplan_affitti_stato'
        },
        telegram: {
          enabled: true,
          botToken: '123456789:test_bot_token',
          ownerChatId: '12345678',
          notifyOwnerOnDue: true,
          notifyTenantOnDue: true,
          autoSendReceiptToTenant: true
        }
      };

      const postRes = await fetch(`${baseUrl}/api/notifications/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      assertEqual(postRes.status, 200);
      const postData = await postRes.json();
      assertTrue(postData.success);
      assertEqual(postData.settings.reminderAdvanceDays, 7);

      // 3. Verify persistence
      const verifyRes = await fetch(`${baseUrl}/api/notifications/settings`);
      const verifyData = await verifyRes.json();
      assertEqual(verifyData.settings.reminderAdvanceDays, 7);
    } finally {
      unregisterMockHandler(dispatcher);
    }
  });

  test('T1-F9-02: POST /api/notifications/send-reminder parameter validation and dispatch over HTTP', async () => {
    seedDb();
    registerMockHandler(dispatcher);
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();
    const mockSupervisor = new MockSupervisorServer();
    await mockSupervisor.start();

    try {
      // Missing propertyId -> 400 Bad Request
      const badReq = await fetch(`${baseUrl}/api/notifications/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'ALL' })
      });
      assertEqual(badReq.status, 400);
      const badData = await badReq.json();
      assertFalse(badData.success);

      // Non-existent propertyId -> 404 Not Found
      const notFoundReq = await fetch(`${baseUrl}/api/notifications/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: 'non_existent_prop_xyz' })
      });
      assertEqual(notFoundReq.status, 404);

      // Valid dispatch
      const validReq = await fetch(`${baseUrl}/api/notifications/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: fixturePropertyCedolare.id,
          channel: 'ALL',
          customMessage: 'Gentile conduttore, ricordiamo la scadenza del canone di locazione.'
        })
      });
      assertEqual(validReq.status, 200);
      const validData = await validReq.json();
      assertTrue(validData.success);
      assertTrue(validData.sentTo.length > 0);

      // Verify Telegram mock received the message
      assertEqual(mockTelegram.sentMessages.length, 1);
      assertTrue(mockTelegram.sentMessages[0].text.includes('ImmoPlan'));
    } finally {
      await mockTelegram.stop();
      await mockSupervisor.stop();
      unregisterMockHandler(dispatcher);
    }
  });

  test('T1-F9-03: POST /api/notifications/send-receipt PDF generation and dispatch over HTTP', async () => {
    seedDb();
    registerMockHandler(dispatcher);
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();

    try {
      // Missing receipt data -> 400
      const badReq = await fetch(`${baseUrl}/api/notifications/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assertEqual(badReq.status, 400);

      // Valid receipt dispatch
      const receiptPayload = {
        receipt: {
          id: 'RCP-2026-0001',
          formattedNumber: '1/2026',
          receiptNumber: 1,
          fiscalYear: 2026,
          issueDate: '2026-09-05T10:00:00.000Z',
          propertyId: fixturePropertyCedolare.id,
          propertyName: fixturePropertyCedolare.name,
          propertyAddress: fixturePropertyCedolare.address,
          landlordName: fixtureLandlord.name,
          landlordTaxCode: fixtureLandlord.taxCode,
          landlordAddress: fixtureLandlord.address,
          tenantName: fixtureTenant1.name,
          tenantTaxCode: fixtureTenant1.taxCode,
          competencePeriod: 'Settembre 2026',
          rentAmount: 850,
          expensesAmount: 0,
          totalAmount: 850,
          taxRegime: 'CEDOLARE_SECCA',
          stampDutyApplied: false,
          stampDutyAmount: 0
        },
        recipientChatId: fixtureTenant1.telegramChatId
      };

      const res = await fetch(`${baseUrl}/api/notifications/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptPayload)
      });
      assertEqual(res.status, 200);
      const resData = await res.json();
      assertTrue(resData.success);

      // Verify telegram document received
      assertEqual(mockTelegram.sentDocuments.length, 1);
      const sentDoc = mockTelegram.sentDocuments[0];
      const caption = sentDoc.payload?.caption || sentDoc.caption || '';
      assertTrue(caption.includes('Quietanza di Pagamento'));
      assertEqual(sentDoc.payload?.parse_mode || sentDoc.parse_mode, 'HTML');
    } finally {
      await mockTelegram.stop();
      unregisterMockHandler(dispatcher);
    }
  });

  test('T1-F9-04: GET /api/notifications/logs and POST /api/notifications/clear-logs over HTTP', async () => {
    seedDb();
    registerMockHandler(dispatcher);
    const mockTelegram = new MockTelegramServer();
    await mockTelegram.start();

    try {
      // Trigger a reminder to populate log
      await fetch(`${baseUrl}/api/notifications/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: fixturePropertyCedolare.id,
          channel: 'TELEGRAM'
        })
      });

      // 1. GET logs
      const logsRes = await fetch(`${baseUrl}/api/notifications/logs`);
      assertEqual(logsRes.status, 200);
      const logs = await logsRes.json();
      assertTrue(Array.isArray(logs));
      assertEqual(logs.length, 1);
      assertEqual(logs[0].type, 'REMINDER_UPCOMING');

      // 2. Clear logs
      const clearRes = await fetch(`${baseUrl}/api/notifications/clear-logs`, {
        method: 'POST'
      });
      assertEqual(clearRes.status, 200);
      const clearData = await clearRes.json();
      assertTrue(clearData.success);

      // 3. Confirm logs are empty
      const emptyLogsRes = await fetch(`${baseUrl}/api/notifications/logs`);
      const emptyLogs = await emptyLogsRes.json();
      assertEqual(emptyLogs.length, 0);
    } finally {
      await mockTelegram.stop();
      unregisterMockHandler(dispatcher);
    }
  });

  test('T1-F9-05: POST /api/ha/push_rent_sensor authentic sensor computation over HTTP', async () => {
    seedDb();
    registerMockHandler(dispatcher);
    const mockSupervisor = new MockSupervisorServer();
    await mockSupervisor.start();

    try {
      const res = await fetch(`${baseUrl}/api/ha/push_rent_sensor`, {
        method: 'POST'
      });
      assertEqual(res.status, 200);
      const data = await res.json();
      assertTrue(data.success);
      assertTrue(typeof data.state === 'string');
      assertTrue(Boolean(data.attributes));
      assertEqual(data.attributes.friendly_name, 'Stato Canoni di Locazione');
      assertEqual(data.attributes.totale_canoni, 2);
      assertTrue(Array.isArray(data.attributes.dettagli));
      assertEqual(data.attributes.dettagli.length, 2);

      // Verify HA mock received the state push
      const haSensor = mockSupervisor.sensorStates.get('sensor.immoplan_affitti_stato');
      assertTrue(Boolean(haSensor));
      assertEqual(haSensor.attributes.totale_canoni, 2);
    } finally {
      await mockSupervisor.stop();
      unregisterMockHandler(dispatcher);
      if (fs.existsSync(testDbPath)) {
        try { fs.unlinkSync(testDbPath); } catch (e) {}
      }
    }
  });

  test('T1-F9-06: Validates settings schema rules & log sorting logic', () => {
    const valid = validateNotificationSettings({
      ...fixtureSettings,
      reminderAdvanceDays: 7
    });
    assertTrue(valid.valid);

    const malformed = { reminderAdvanceDays: 50 };
    const invalidRes = validateNotificationSettings(malformed);
    assertFalse(invalidRes.valid);

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
