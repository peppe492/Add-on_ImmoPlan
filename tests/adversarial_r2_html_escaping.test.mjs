// tests/adversarial_r2_html_escaping.test.mjs
// Empirical Adversarial Stress Test Suite for HTML Escaping in Add-on_ImmoPlan
// Authored by Challenger 1 (Round 2)

import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { Duplex } from 'stream';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import {
  globalContext,
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse
} from './e2e/harness/test_framework.mjs';
import { registerMockHandler, unregisterMockHandler } from './e2e/harness/mock_http_dispatcher.mjs';

/**
 * Strict Telegram Bot API HTML Parser Simulator
 */
function validateTelegramHtml(rawHtml) {
  if (typeof rawHtml !== 'string') return { valid: false, error: 'Message must be a string' };
  if (rawHtml.length === 0) return { valid: false, error: 'Message cannot be empty' };
  if (rawHtml.length > 4096) return { valid: false, error: 'Message exceeds Telegram 4096 character limit' };

  const entityRegex = /&(?!(amp|lt|gt|quot);)/g;
  const badAmp = rawHtml.match(entityRegex);
  if (badAmp) {
    return {
      valid: false,
      error: `Character '&' is reserved and must be escaped with the entity &amp;`
    };
  }

  const allowedTags = new Set([
    'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del',
    'span', 'tg-spoiler', 'a', 'code', 'pre', 'blockquote'
  ]);
  const tagStack = [];
  const tagRegex = /<\/?[a-zA-Z0-9_\-]+(?:\s+[^>]*)?>|<!--.*?-->/g;

  let lastIndex = 0;
  let match;
  while ((match = tagRegex.exec(rawHtml)) !== null) {
    const textBetween = rawHtml.substring(lastIndex, match.index);
    if (textBetween.includes('<') || textBetween.includes('>')) {
      return { valid: false, error: 'Unescaped < or > found in text content' };
    }

    const tagStr = match[0];
    const isClosing = tagStr.startsWith('</');
    const tagNameMatch = tagStr.match(/<\/?([a-zA-Z0-9_\-]+)/);
    const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : '';

    if (!allowedTags.has(tagName)) {
      return { valid: false, error: `Unsupported start tag '${tagName}'` };
    }

    if (isClosing) {
      if (tagStack.length === 0 || tagStack[tagStack.length - 1] !== tagName) {
        return { valid: false, error: `Unmatched closing tag '</${tagName}>'` };
      }
      tagStack.pop();
    } else {
      tagStack.push(tagName);
    }

    lastIndex = tagRegex.lastIndex;
  }

  const remaining = rawHtml.substring(lastIndex);
  if (remaining.includes('<') || remaining.includes('>')) {
    return { valid: false, error: 'Unescaped < or > found at end of message' };
  }

  if (tagStack.length > 0) {
    return { valid: false, error: `Unclosed start tag '<${tagStack[tagStack.length - 1]}>'` };
  }

  return { valid: true };
}

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Import authentic server components
const serverModule = require(path.join(projectRoot, 'server.js'));
const escapeTgHtml = serverModule.escapeTgHtml;
const sendTelegramText = serverModule.sendTelegramText;
const sendTelegramDoc = serverModule.sendTelegramDoc;
const app = serverModule.app || serverModule;

/**
 * In-process mock Telegram dispatcher that applies STRICT HTML validation
 */
class StrictMockTelegramServer {
  constructor() {
    this.recordedMessages = [];
    this.recordedDocuments = [];
    this.parseErrors = [];
  }

  matchesUrl(url) {
    return url.includes('api.telegram.org');
  }

  async start() {
    registerMockHandler(this);
  }

  async stop() {
    unregisterMockHandler(this);
  }

  reset() {
    this.recordedMessages = [];
    this.recordedDocuments = [];
    this.parseErrors = [];
  }

  async handleRequest(url, init = {}) {
    if (url.includes('/sendMessage')) {
      let body = {};
      try {
        body = JSON.parse(init.body || '{}');
      } catch (e) {
        body = {};
      }

      if (body.parse_mode === 'HTML') {
        const validation = validateTelegramHtml(body.text);
        if (!validation.valid) {
          this.parseErrors.push({ url, text: body.text, error: validation.error });
          return new Response(JSON.stringify({
            ok: false,
            error_code: 400,
            description: `Bad Request: can't parse entities: ${validation.error}`
          }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      }

      const item = {
        chat_id: body.chat_id,
        text: body.text,
        parse_mode: body.parse_mode,
        id: this.recordedMessages.length + 1
      };
      this.recordedMessages.push(item);

      return new Response(JSON.stringify({
        ok: true,
        result: { message_id: item.id, text: item.text }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/sendDocument')) {
      const parsedBody = {};
      if (init.body instanceof FormData) {
        for (const [k, v] of init.body.entries()) {
          parsedBody[k] = v;
        }
      }

      const caption = parsedBody.caption || '';
      const parseMode = parsedBody.parse_mode;

      if (parseMode === 'HTML' && caption) {
        const validation = validateTelegramHtml(caption);
        if (!validation.valid) {
          this.parseErrors.push({ url, caption, error: validation.error });
          return new Response(JSON.stringify({
            ok: false,
            error_code: 400,
            description: `Bad Request: can't parse entities in caption: ${validation.error}`
          }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      }

      this.recordedDocuments.push({
        chat_id: parsedBody.chat_id,
        caption,
        parse_mode: parseMode,
        id: this.recordedDocuments.length + 1
      });

      return new Response(JSON.stringify({
        ok: true,
        result: { message_id: 999123, document: { file_id: 'doc_mock_999' } }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, result: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Mock duplex socket for calling Express in-process
 */
function createMockSocket() {
  const s = new Duplex({
    read() {},
    write(chunk, enc, cb) { cb(); }
  });
  s.encrypted = false;
  s.remoteAddress = '127.0.0.1';
  return s;
}

function executeExpress(expressApp, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve) => {
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
      resolve({
        status: res.statusCode || 200,
        headers: res.getHeaders ? res.getHeaders() : {},
        text,
        json: () => {
          try { return JSON.parse(text); } catch (e) { return null; }
        }
      });
    };

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.headers['content-type'] = req.headers['content-type'] || 'application/json';
      req.headers['content-length'] = String(Buffer.byteLength(payload));
      req.push(payload);
    }
    req.push(null);

    expressApp(req, res);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// TEST SUITE: Unit Stress on escapeTgHtml
// ────────────────────────────────────────────────────────────────────────────

describe('ADV-R2-UNIT: escapeTgHtml Direct Adversarial Stress Testing', () => {
  test('R2-U01: Script and XSS attack vectors are fully neutralized', () => {
    const vectors = [
      '<script>alert("XSS")</script>',
      '<SCRIPT SRC="http://evil.com/xss.js"></SCRIPT>',
      '<script type="text/javascript">alert(1);</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg/onload=alert(\'XSS\')>',
      '<body onload=alert(\'XSS\')>',
      '<<SCRIPT>alert("XSS");//<</SCRIPT>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<a href="javascript:alert(1)">click here</a>'
    ];

    for (const vec of vectors) {
      const escaped = escapeTgHtml(vec);
      assertFalse(escaped.includes('<'), `Unescaped < found in: ${escaped}`);
      assertFalse(escaped.includes('>'), `Unescaped > found in: ${escaped}`);
      assertTrue(escaped.includes('&lt;'), `Missing &lt; in: ${escaped}`);
      assertTrue(escaped.includes('&gt;'), `Missing &gt; in: ${escaped}`);

      // When wrapped in a Telegram message, Telegram must parse it cleanly without script execution
      const fullMsg = `Notification: ${escaped}`;
      const validation = validateTelegramHtml(fullMsg);
      assertTrue(validation.valid, `Telegram validator failed for: ${fullMsg} -> ${validation.error}`);
    }
  });

  test('R2-U02: Ampersand & variants and malformed entity lookalikes', () => {
    const vectors = [
      'Simple & raw ampersand',
      'Double && and triple &&& ampersands',
      'M&M\'s Property & Sons',
      'B&B Il Sole & Le Onde S.n.c.',
      '&amp; (pre-existing entity)',
      '&lt;tag&gt; (pre-existing tag entities)',
      '&foo=bar&baz=qux&num=123',
      '&#39; and &#x26; numeric entities',
      '&notanentity; &broken&;'
    ];

    for (const vec of vectors) {
      const escaped = escapeTgHtml(vec);
      // All raw & must be converted to &amp;
      // In Telegram HTML, any & must be followed by amp;, lt;, gt;, or quot;
      const entityRegex = /&(?!(amp|lt|gt|quot);)/g;
      const invalidAmp = escaped.match(entityRegex);
      assertEqual(invalidAmp, null, `Found unescaped raw & in output: ${escaped}`);

      const validation = validateTelegramHtml(escaped);
      assertTrue(validation.valid, `Failed Telegram validation on ampersand vector: ${validation.error}`);
    }
  });

  test('R2-U03: Unclosed tags, mismatched brackets, and arithmetic operators', () => {
    const vectors = [
      '<b',
      '<script',
      '<div class="test"',
      '<b>Unclosed bold text',
      '<i>Mixed <b>nested unclosed</i> tags',
      '<<<>>>',
      '<<>>',
      'Rent is < 500 and > 200',
      'A < B & C > D',
      '<= and >= operators in conditions',
      'Quotes with tags: "<script>alert(1)</script>" and \'<b\''
    ];

    for (const vec of vectors) {
      const escaped = escapeTgHtml(vec);
      assertFalse(escaped.includes('<'), `Unescaped < in: ${escaped}`);
      assertFalse(escaped.includes('>'), `Unescaped > in: ${escaped}`);

      const validation = validateTelegramHtml(escaped);
      assertTrue(validation.valid, `Telegram validator failed for: ${escaped} -> ${validation.error}`);
    }
  });

  test('R2-U04: Type boundaries: falsy values (null, undefined, 0, false) vs truthy (strings, objects)', () => {
    // Falsy inputs safely coerce to empty string via if (!text) guard
    assertEqual(escapeTgHtml(null), '');
    assertEqual(escapeTgHtml(undefined), '');
    assertEqual(escapeTgHtml(''), '');
    assertEqual(escapeTgHtml(0), '');
    assertEqual(escapeTgHtml(false), '');
    assertEqual(escapeTgHtml(NaN), '');

    // String representations of numbers and booleans
    assertEqual(escapeTgHtml('0'), '0');
    assertEqual(escapeTgHtml('false'), 'false');
    assertEqual(escapeTgHtml(12345), '12345');
    assertEqual(escapeTgHtml({ toString: () => 'A & B <C>' }), 'A &amp; B &lt;C&gt;');
  });

  test('R2-U05: Huge string explosion with 15,000 mixed hostile characters', () => {
    const chunk = '<script>alert("xss")</script> & M&M <unclosed ';
    const huge = chunk.repeat(300); // ~13,500 chars
    const escaped = escapeTgHtml(huge);

    assertFalse(escaped.includes('<'));
    assertFalse(escaped.includes('>'));
    // No unescaped &
    const entityRegex = /&(?!(amp|lt|gt|quot);)/g;
    assertEqual(escaped.match(entityRegex), null);
    assertTrue(escaped.length > huge.length);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TEST SUITE: Endpoint Stress on /api/notifications/send-reminder
// ────────────────────────────────────────────────────────────────────────────

describe('ADV-R2-ENDPOINT: /api/notifications/send-reminder Adversarial Attacks', () => {
  const testDbPath = path.join(os.tmpdir(), `immoplan_adv_db_${Date.now()}.json`);
  const mockTg = new StrictMockTelegramServer();

  const testProperty = {
    id: 'prop_adv_1',
    name: 'Appartamento <Vista Mare> & C.',
    currentTenantId: 'tenant_adv_1',
    financials: { monthlyRent: 850 }
  };

  const testTenant = {
    id: 'tenant_adv_1',
    name: 'Mario Rossi & Figli <mario@rossi.it>',
    telegramChatId: '123456789'
  };

  const testSettings = {
    reminderAdvanceDays: 5,
    autoCheckEnabled: true,
    telegram: {
      enabled: true,
      botToken: '123456789:test_token',
      ownerChatId: '987654321',
      notifyTenantOnDue: true,
      notifyOwnerOnDue: true
    },
    homeAssistant: {
      enabled: false,
      persistentNotifications: false
    }
  };

  function setupDb(propOverrides = {}, tenantOverrides = {}) {
    const dbData = {
      properties: [{ ...testProperty, ...propOverrides }],
      tenants: [{ ...testTenant, ...tenantOverrides }],
      rentalRecords: [],
      notificationSettings: testSettings,
      notificationLogs: []
    };
    fs.writeFileSync(testDbPath, JSON.stringify(dbData, null, 2), 'utf8');
  }

  test('R2-E01: Default template with hostile DB property name & tenant name', async () => {
    await mockTg.start();
    mockTg.reset();
    if (app.setDbPath) app.setDbPath(testDbPath);
    process.env.DB_PATH = testDbPath;

    setupDb(
      { name: 'Villa <Emerald & Diamond> & Co.' },
      { name: 'Dr. John <Hacker> & Jane Doe' }
    );

    try {
      const res = await executeExpress(app, {
        method: 'POST',
        url: '/api/notifications/send-reminder',
        body: { propertyId: 'prop_adv_1', channel: 'TELEGRAM' }
      });

      const body = res.json();
      assertTrue(body.success, `Expected success: ${JSON.stringify(body)}`);
      assertEqual(mockTg.recordedMessages.length, 1);
      assertEqual(mockTg.parseErrors.length, 0);

      const msg = mockTg.recordedMessages[0];
      assertEqual(msg.chat_id, '123456789');

      // The sent message MUST be valid Telegram HTML:
      const validation = validateTelegramHtml(msg.text);
      assertTrue(validation.valid, `Telegram entity parse failed: ${validation.error} in text: ${msg.text}`);

      // Must have properly escaped entities:
      assertTrue(msg.text.includes('Villa &lt;Emerald &amp; Diamond&gt; &amp; Co.'));
      assertTrue(msg.text.includes('Dr. John &lt;Hacker&gt; &amp; Jane Doe'));

      // Legitimate bold tags must still exist in the template
      assertTrue(msg.text.includes('<b>€ 850.00</b>'));
      assertTrue(msg.text.includes('<b>ImmoPlan · Promemoria Canone</b>'));
    } finally {
      await mockTg.stop();
    }
  });

  test('R2-E02: customMessage containing <script> XSS payload', async () => {
    await mockTg.start();
    mockTg.reset();
    setupDb();

    try {
      const maliciousScript = '<script>alert("PWNED!"); document.location="http://evil.com";</script>';
      const res = await executeExpress(app, {
        method: 'POST',
        url: '/api/notifications/send-reminder',
        body: {
          propertyId: 'prop_adv_1',
          channel: 'TELEGRAM',
          customMessage: maliciousScript
        }
      });

      const body = res.json();
      assertTrue(body.success);
      assertEqual(mockTg.parseErrors.length, 0);
      assertEqual(mockTg.recordedMessages.length, 1);

      const msg = mockTg.recordedMessages[0];
      const validation = validateTelegramHtml(msg.text);
      assertTrue(validation.valid, `Telegram entity parse failed: ${validation.error}`);

      // Script tags must be safely rendered as text entities:
      assertTrue(msg.text.includes('&lt;script&gt;alert('));
      assertFalse(msg.text.includes('<script>'));
    } finally {
      await mockTg.stop();
    }
  });

  test('R2-E03: customMessage containing unclosed tags and nested brackets', async () => {
    await mockTg.start();
    mockTg.reset();
    setupDb();

    try {
      const hostileMessage = 'Attenzione: <b canone <non pagato> & <unclosed tag con <<< e >>> caratteri speciali!';
      const res = await executeExpress(app, {
        method: 'POST',
        url: '/api/notifications/send-reminder',
        body: {
          propertyId: 'prop_adv_1',
          channel: 'TELEGRAM',
          customMessage: hostileMessage
        }
      });

      const body = res.json();
      assertTrue(body.success);
      assertEqual(mockTg.parseErrors.length, 0);
      assertEqual(mockTg.recordedMessages.length, 1);

      const msg = mockTg.recordedMessages[0];
      const validation = validateTelegramHtml(msg.text);
      assertTrue(validation.valid, `Telegram entity parse failed on unclosed tag: ${validation.error}`);
    } finally {
      await mockTg.stop();
    }
  });

  test('R2-E04: customMessage with raw & and pre-existing HTML entity mix', async () => {
    await mockTg.start();
    mockTg.reset();
    setupDb();

    try {
      const mixedMessage = 'B&B &amp; Hotel: Saldo di € 500 & spese extra &lt;bollette&gt;';
      const res = await executeExpress(app, {
        method: 'POST',
        url: '/api/notifications/send-reminder',
        body: {
          propertyId: 'prop_adv_1',
          channel: 'TELEGRAM',
          customMessage: mixedMessage
        }
      });

      const body = res.json();
      assertTrue(body.success);
      assertEqual(mockTg.parseErrors.length, 0);

      const msg = mockTg.recordedMessages[0];
      const validation = validateTelegramHtml(msg.text);
      assertTrue(validation.valid, `Telegram entity parse failed on mixed ampersands: ${validation.error}`);
    } finally {
      await mockTg.stop();
    }
  });

  test('R2-E05: send-receipt caption with hostile property name and receipt number', async () => {
    await mockTg.start();
    mockTg.reset();
    setupDb();

    try {
      const hostileReceipt = {
        id: 'rec_adv_1',
        formattedNumber: '2026/001 & <hack>',
        propertyName: 'Chalet <Mont Blanc> & Spa S.r.l.',
        propertyId: 'prop_adv_1',
        tenantName: 'Mario Rossi & Figli',
        totalAmount: 1250.00,
        paymentDate: '2026-09-01'
      };

      const res = await executeExpress(app, {
        method: 'POST',
        url: '/api/notifications/send-receipt',
        body: {
          receipt: hostileReceipt,
          recipientChatId: '123456789'
        }
      });

      const body = res.json();
      assertTrue(body.success, `send-receipt failed: ${JSON.stringify(body)}`);
      assertEqual(mockTg.parseErrors.length, 0);
      assertEqual(mockTg.recordedDocuments.length, 1);

      const doc = mockTg.recordedDocuments[0];
      assertEqual(doc.parse_mode, 'HTML');

      const validation = validateTelegramHtml(doc.caption);
      assertTrue(validation.valid, `Receipt caption parse failed: ${validation.error}`);
      assertTrue(doc.caption.includes('Chalet &lt;Mont Blanc&gt; &amp; Spa S.r.l.'));
      assertTrue(doc.caption.includes('2026/001 &amp; &lt;hack&gt;'));
      assertTrue(doc.caption.includes('<b>Quietanza di Pagamento N. 2026/001 &amp; &lt;hack&gt;</b>'));
    } finally {
      await mockTg.stop();
    }
  });

  test('R2-E06: customMessage with multi-line, URLs with query ampersands & emojis', async () => {
    await mockTg.start();
    mockTg.reset();
    setupDb();

    try {
      const complexMsg = 'Gentile Inquilino 🏠🔑,\nLink pagamento: https://pay.bank.it/checkout?id=123&client=456&fee=0\nImporto: € 850,00 💶.\nGrazie & saluti!';
      const res = await executeExpress(app, {
        method: 'POST',
        url: '/api/notifications/send-reminder',
        body: {
          propertyId: 'prop_adv_1',
          channel: 'TELEGRAM',
          customMessage: complexMsg
        }
      });

      const body = res.json();
      assertTrue(body.success);
      assertEqual(mockTg.parseErrors.length, 0);
      assertEqual(mockTg.recordedMessages.length, 1);

      const msg = mockTg.recordedMessages[0];
      const validation = validateTelegramHtml(msg.text);
      assertTrue(validation.valid, `Complex message validation failed: ${validation.error}`);
      assertTrue(msg.text.includes('id=123&amp;client=456&amp;fee=0'));
      assertTrue(msg.text.includes('🏠🔑'));
      assertTrue(msg.text.includes('💶'));
    } finally {
      await mockTg.stop();
    }
  });

  test('R2-E07: Missing propertyId and unknown propertyId return standard 400 and 404', async () => {
    setupDb();

    const resMissing = await executeExpress(app, {
      method: 'POST',
      url: '/api/notifications/send-reminder',
      body: {}
    });
    assertEqual(resMissing.status, 400);
    assertFalse(resMissing.json().success);

    const resNotFound = await executeExpress(app, {
      method: 'POST',
      url: '/api/notifications/send-reminder',
      body: { propertyId: 'non_existent_property_id' }
    });
    assertEqual(resNotFound.status, 404);
    assertFalse(resNotFound.json().success);
  });

  test('R2-E08: Telegram API error resilience (HTTP 403 Forbidden does not crash server)', async () => {
    await mockTg.start();
    mockTg.reset();
    setupDb();

    // Force mock Telegram to return 403 Forbidden
    const origHandle = mockTg.handleRequest;
    mockTg.handleRequest = async () => {
      return new Response(JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden: bot blocked by user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    try {
      const res = await executeExpress(app, {
        method: 'POST',
        url: '/api/notifications/send-reminder',
        body: { propertyId: 'prop_adv_1', channel: 'TELEGRAM' }
      });

      assertEqual(res.status, 200);
      const body = res.json();
      assertFalse(body.success, 'Expected failure flag when Telegram blocks message');
      assertEqual(body.sentTo.length, 0);
    } finally {
      mockTg.handleRequest = origHandle;
      await mockTg.stop();
    }
  });

  test('R2-E09: sendTelegramDoc with empty caption still sets parse_mode HTML safely', async () => {
    await mockTg.start();
    mockTg.reset();

    try {
      const dummyPdf = Buffer.from('%PDF-1.4 test', 'utf8');
      const res = await sendTelegramDoc('123:token', '123456789', dummyPdf, 'test.pdf', '');
      assertTrue(res.success);
      assertEqual(mockTg.recordedDocuments.length, 1);
      assertEqual(mockTg.recordedDocuments[0].parse_mode, 'HTML');
      assertEqual(mockTg.recordedDocuments[0].caption, '');
    } finally {
      await mockTg.stop();
    }
  });

  test('R2-E10: sendTelegramText handles null or missing parameters gracefully without throwing', async () => {
    const resNoToken = await sendTelegramText('', '123456', 'hello');
    assertFalse(resNoToken.success);
    assertEqual(resNoToken.error, 'Token o Chat ID mancante');

    const resNoChat = await sendTelegramText('123:token', '', 'hello');
    assertFalse(resNoChat.success);
    assertEqual(resNoChat.error, 'Token o Chat ID mancante');
  });
});

async function main() {
  try {
    const res = await globalContext.runAll();
    process.exit(res.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal execution error:', err);
    process.exit(1);
  }
}

main();
