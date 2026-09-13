// tests/adversarial_notifications.test.mjs
// Adversarial Stress Harness for Telegram & Home Assistant Notification Subsystem (Challenger 1)

import { globalContext, describe, test, assertEqual, assertTrue, assertFalse, assertIncludes } from './e2e/harness/test_framework.mjs';
import { registerMockHandler, unregisterMockHandler } from './e2e/harness/mock_http_dispatcher.mjs';
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  sendTelegramDocument,
  testTelegramConnection,
  updateHomeAssistantSensor,
  testHomeAssistantConnection,
  createHomeAssistantNotification,
  dismissHomeAssistantNotification
} from './e2e/modules/notification_engine.mjs';

/**
 * Strict Telegram Bot API HTML Parser Simulator
 * Mirrors official Telegram API parse_mode: 'HTML' validation rules.
 * Allowed tags: <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>, <span>, <tg-spoiler>, <a>, <code>, <pre>, <blockquote>
 * Any other '<', '>', or raw '&' (not part of &lt;, &gt;, &amp;, &quot;) is an immediate entity parse failure (HTTP 400).
 */
export function validateTelegramHtml(rawHtml) {
  if (typeof rawHtml !== 'string') return { valid: false, error: 'Message must be a string' };
  if (rawHtml.length === 0) return { valid: false, error: 'Message cannot be empty' };
  if (rawHtml.length > 4096) return { valid: false, error: 'Message exceeds Telegram 4096 character limit' };

  // 1. Check for unescaped '&'
  // Only &amp;, &lt;, &gt;, &quot; are valid entities in Telegram HTML
  const entityRegex = /&(?!(amp|lt|gt|quot);)/g;
  const badAmp = rawHtml.match(entityRegex);
  if (badAmp) {
    return {
      valid: false,
      error: `Character '&' is reserved and must be escaped with the entity &amp;`
    };
  }

  // 2. Validate HTML tags & matching
  const allowedTags = new Set([
    'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del',
    'span', 'tg-spoiler', 'a', 'code', 'pre', 'blockquote'
  ]);
  const tagStack = [];
  const tagRegex = /<\/?[a-zA-Z0-9_\-]+(?:\s+[^>]*)?>|<!--.*?-->/g;

  let lastIndex = 0;
  let match;
  while ((match = tagRegex.exec(rawHtml)) !== null) {
    // Check text between tags for illegal '<' or '>'
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
      // Self closing tags not supported in Telegram HTML
      tagStack.push(tagName);
    }

    lastIndex = tagRegex.lastIndex;
  }

  // Check remaining text
  const remaining = rawHtml.substring(lastIndex);
  if (remaining.includes('<') || remaining.includes('>')) {
    return { valid: false, error: 'Unescaped < or > found at end of message' };
  }

  if (tagStack.length > 0) {
    return { valid: false, error: `Unclosed start tag '<${tagStack[tagStack.length - 1]}>'` };
  }

  return { valid: true };
}

/**
 * Configurable Mock for Adversarial Telegram Server
 */
class AdversarialTelegramServer {
  constructor() {
    this.baseUrl = `https://api.telegram.org-adv-${Date.now()}-${Math.random()}`;
    this.behavior = 'NORMAL';
    this.customResponse = null;
    this.customStatus = 200;
    this.customHeaders = { 'Content-Type': 'application/json' };
    this.simulateNetworkDelayMs = 0;
  }

  matchesUrl(url) {
    return url.startsWith(this.baseUrl) || url.includes('api.telegram.org');
  }

  async start() {
    registerMockHandler(this);
    return this.baseUrl;
  }

  async stop() {
    unregisterMockHandler(this);
  }

  async handleRequest(url, init = {}) {
    if (this.simulateNetworkDelayMs > 0) {
      await new Promise(r => setTimeout(r, this.simulateNetworkDelayMs));
    }

    if (this.behavior === 'SOCKET_HANGUP') {
      throw new TypeError('fetch failed: socket hang up');
    }
    if (this.behavior === 'CONN_REFUSED') {
      throw new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1:443');
    }
    if (this.behavior === 'TIMEOUT') {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'AbortError';
      throw err;
    }
    if (this.behavior === 'EMPTY_BODY') {
      return new Response('', { status: this.customStatus, headers: this.customHeaders });
    }
    if (this.behavior === 'RAW_HTML_ERROR') {
      return new Response('<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1><p>Cloudflare</p></body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (this.behavior === 'TRUNCATED_JSON') {
      return new Response('{"ok": true, "result": { "message_id": ', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (this.behavior === 'NON_OBJECT_JSON') {
      return new Response('12345', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (this.behavior === 'CUSTOM') {
      return new Response(JSON.stringify(this.customResponse), {
        status: this.customStatus,
        headers: this.customHeaders
      });
    }

    // Default: Validate Telegram HTML formatting if sendMessage in HTML mode
    if (url.includes('/sendMessage')) {
      let body = {};
      try {
        body = JSON.parse(init.body || '{}');
      } catch (e) {}

      if (body.parse_mode === 'HTML') {
        const validation = validateTelegramHtml(body.text);
        if (!validation.valid) {
          return new Response(JSON.stringify({
            ok: false,
            error_code: 400,
            description: `Bad Request: can't parse entities: ${validation.error}`
          }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        result: {
          message_id: 888123,
          date: Math.floor(Date.now() / 1000),
          text: body.text
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/sendDocument')) {
      return new Response(JSON.stringify({
        ok: true,
        result: {
          message_id: 888124,
          document: { file_id: 'doc_123', file_name: 'quietanza.pdf' }
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/getMe')) {
      return new Response(JSON.stringify({
        ok: true,
        result: { id: 123456, is_bot: true, username: 'test_adv_bot' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: false, description: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Configurable Mock for Adversarial Home Assistant Supervisor Server
 */
class AdversarialSupervisorServer {
  constructor() {
    this.baseUrl = `http://supervisor-adv-${Date.now()}-${Math.random()}`;
    this.behavior = 'NORMAL';
    this.customStatus = 200;
    this.customResponse = null;
  }

  matchesUrl(url) {
    return url.startsWith(this.baseUrl) || url.includes('http://supervisor/core/api') || url.includes('/core/api/');
  }

  async start() {
    registerMockHandler(this);
    return this.baseUrl;
  }

  async stop() {
    unregisterMockHandler(this);
  }

  async handleRequest(url, init = {}) {
    if (this.behavior === 'OFFLINE') {
      throw new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1:80');
    }
    if (this.behavior === 'SOCKET_HANGUP') {
      throw new TypeError('fetch failed: socket hang up');
    }
    if (this.behavior === 'RAW_HTML_ERROR') {
      return new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (this.behavior === 'TRUNCATED_JSON') {
      return new Response('{"state": "unclosed', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (this.behavior === 'CUSTOM') {
      return new Response(
        typeof this.customResponse === 'string' ? this.customResponse : JSON.stringify(this.customResponse),
        { status: this.customStatus, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/core/api/config')) {
      return new Response(JSON.stringify({ version: '2026.9.1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ==============================================================================
// TEST SUITES
// ==============================================================================

describe('ADV-1: Telegram HTML Escaping Under Hostile Inputs', () => {
  test('ADV-1.01: <script> and XSS vectors are completely neutralized', () => {
    const maliciousInputs = [
      '<script>alert("XSS")</script>',
      '<IMG SRC="javascript:alert(\'XSS\');">',
      '<iframe src="https://evil.com"></iframe>',
      '"><script>alert(document.cookie)</script>',
      '<<SCRIPT>alert("XSS");//<</SCRIPT>'
    ];

    for (const input of maliciousInputs) {
      const escaped = escapeTelegramHtml(input);
      assertFalse(escaped.includes('<script>'), `Failed to escape <script> in: ${input}`);
      assertFalse(escaped.includes('<IMG'), `Failed to escape <IMG in: ${input}`);
      assertFalse(escaped.includes('<iframe'), `Failed to escape <iframe in: ${input}`);
      const validation = validateTelegramHtml(escaped);
      assertTrue(validation.valid, `Telegram validator rejected escaped string: ${escaped} (Error: ${validation.error})`);
    }
  });

  test('ADV-1.02: Unclosed opening tags and brackets do not break Telegram parser', () => {
    const unclosedInputs = [
      '<b',
      '<div class="tenant-alert"',
      '<span style="color:red"',
      '<<<nested<<<unclosed',
      '<a href="https://example.com" Rent details',
      'Canone < 500€ e spese > 100€'
    ];

    for (const input of unclosedInputs) {
      const escaped = escapeTelegramHtml(input);
      const validation = validateTelegramHtml(escaped);
      assertTrue(validation.valid, `Validation failed for: ${escaped} (Error: ${validation.error})`);
    }
  });

  test('ADV-1.03: Raw ampersands in company/property names are escaped safely', () => {
    const ampersandInputs = [
      "M&M's Property S.r.l.",
      "Studio Associato Rossi & Bianchi & Partners",
      "Villetta A&B Vista Mare",
      "Contratto n. 45 & allegati",
      "&&& Triple Ampersand &&&"
    ];

    for (const input of ampersandInputs) {
      const escaped = escapeTelegramHtml(input);
      const validation = validateTelegramHtml(escaped);
      assertTrue(validation.valid, `Ampersand validation failed for: ${escaped} (Error: ${validation.error})`);
      assertEqual(escaped.includes('&amp;'), true);
    }
  });

  test('ADV-1.04: Double escaping behavior with pre-existing HTML entities', () => {
    const preEscaped = 'Locazione &amp; Spese &lt;Concordato&gt;';
    const escaped = escapeTelegramHtml(preEscaped);
    // &amp; becomes &amp;amp;
    // &lt; becomes &amp;lt;
    assertEqual(escaped.includes('&amp;amp;'), true);
    assertEqual(escaped.includes('&amp;lt;'), true);
    const validation = validateTelegramHtml(escaped);
    assertTrue(validation.valid, `Validator rejected double escaped: ${escaped}`);
  });

  test('ADV-1.05: Multi-byte Unicode Emojis & complex ZWJ sequences remain intact', async () => {
    const mock = new AdversarialTelegramServer();
    await mock.start();
    try {
      const emojiPayload = '🏠 <b>ImmoPlan</b>: Canone € 850,00 💶 per 👨‍👩‍👧‍👦 Famiglia Rossi 🇮🇹 🔑';
      const res = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '987',
        text: emojiPayload
      });
      assertTrue(res.success);
      assertEqual(res.messageId, 888123);
    } finally {
      await mock.stop();
    }
  });

  test('ADV-1.06: Bidirectional text (Arabic, Hebrew) and Unicode direction markers', async () => {
    const mock = new AdversarialTelegramServer();
    await mock.start();
    try {
      const bidiInputs = [
        'عقد الإيجار لشهر سبتمبر 2026 بمبلغ 850 يورو',
        'חוזה שכירות לספטמבר 2026 סך 850 אירו',
        '\u202Ereversed\u202C text with direction markers',
        '<b>مرحبا</b>: Canone registrato'
      ];

      for (const text of bidiInputs) {
        const res = await sendTelegramMessage({
          baseUrl: mock.baseUrl,
          botToken: '123:token',
          chatId: '987',
          text
        });
        assertTrue(res.success, `Failed to dispatch bidi text: ${text}`);
      }
    } finally {
      await mock.stop();
    }
  });

  test('ADV-1.07: Control characters and whitespace boundaries', () => {
    const controlInputs = [
      'Null\x00Byte\x01Control',
      'Zero\u200BWidth\u200CSpace',
      'Carriage\r\nReturn\tTab\fFormFeed\vVerticalTab',
      'Non\u00A0Breaking\u2028Line\u2029Paragraph'
    ];

    for (const input of controlInputs) {
      const escaped = escapeTelegramHtml(input);
      const validation = validateTelegramHtml(escaped);
      assertTrue(validation.valid, `Failed control char validation: ${validation.error}`);
    }
  });

  test('ADV-1.08: Huge text explosion test (10,000 chars with 2,000 < and > characters)', () => {
    const hugeRaw = 'A<B>C&'.repeat(2000); // 12,000 chars
    const escaped = escapeTelegramHtml(hugeRaw);
    assertEqual(escaped.includes('<'), false);
    assertEqual(escaped.includes('>'), false);
    // Escaped string expanded safely in memory
    assertEqual(escaped.length > hugeRaw.length, true);
  });

  test('ADV-1.09: Empirical demonstration of server.js unescaped template vulnerability', () => {
    // In server.js line 1117:
    // const msgText = customMessage || `Gentile ${tenant?.name || 'Conduttore'}, ti ricordiamo la scadenza del canone di locazione di <b>€ ${rentAmount.toFixed(2)}</b> per l'immobile <b>${prop.name}</b>.`;
    // const fullText = `🏠 <b>ImmoPlan · Promemoria Canone</b>\n\n${msgText}`;

    // Hostile tenant name and property name:
    const tenantName = 'Mario Rossi & Figli <mario@rossi.it>';
    const propName = 'Attico <Vista Mare> & C.';
    const rentAmount = 850;

    const unescapedMsgText = `Gentile ${tenantName}, ti ricordiamo la scadenza del canone di locazione di <b>€ ${rentAmount.toFixed(2)}</b> per l'immobile <b>${propName}</b>.`;
    const unescapedFullText = `🏠 <b>ImmoPlan · Promemoria Canone</b>\n\n${unescapedMsgText}`;

    // Test against strict Telegram parser
    const unescapedValidation = validateTelegramHtml(unescapedFullText);
    assertFalse(unescapedValidation.valid, 'Unescaped template MUST fail Telegram validator');
    assertTrue(
      unescapedValidation.error.includes('&') || unescapedValidation.error.includes('<') || unescapedValidation.error.includes('Unsupported start tag'),
      `Expected parse error, got: ${unescapedValidation.error}`
    );

    // Now test WITH proper escaping applied to parameters:
    const escapedTenant = escapeTelegramHtml(tenantName);
    const escapedProp = escapeTelegramHtml(propName);
    const safeMsgText = `Gentile ${escapedTenant}, ti ricordiamo la scadenza del canone di locazione di <b>€ ${rentAmount.toFixed(2)}</b> per l'immobile <b>${escapedProp}</b>.`;
    const safeFullText = `🏠 <b>ImmoPlan · Promemoria Canone</b>\n\n${safeMsgText}`;

    const safeValidation = validateTelegramHtml(safeFullText);
    assertTrue(safeValidation.valid, `Safely escaped template should pass: ${safeValidation.error}`);
  });
});

describe('ADV-2: Telegram Bot API Error & Rate Limit Handling', () => {
  test('ADV-2.01: HTTP 400 Bad Request (Chat Not Found)', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 400;
    mock.customResponse = { ok: false, error_code: 400, description: 'Bad Request: chat not found' };
    await mock.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '999999999',
        text: 'Hello'
      });
      assertFalse(res.success);
      assertEqual(res.status, 400);
      assertIncludes(res.error, 'chat not found');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.02: HTTP 401 Unauthorized (Malformed Bot Token)', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 401;
    mock.customResponse = { ok: false, error_code: 401, description: 'Unauthorized' };
    await mock.start();
    try {
      const res = await testTelegramConnection({
        baseUrl: mock.baseUrl,
        botToken: '999999999:invalid_token_hash'
      });
      assertFalse(res.success);
      assertTrue(res.message.includes('401') || res.message.includes('Unauthorized'));
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.03: HTTP 403 Forbidden (Bot Kicked From Channel/Group)', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 403;
    mock.customResponse = { ok: false, error_code: 403, description: 'Forbidden: bot was kicked from the supergroup chat' };
    await mock.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '-100987654321',
        text: 'Group notification'
      });
      assertFalse(res.success);
      assertEqual(res.status, 403);
      assertIncludes(res.error, 'kicked');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.04: HTTP 429 Rate Limit with parameters.retry_after', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 429;
    mock.customResponse = {
      ok: false,
      error_code: 429,
      description: 'Too Many Requests: retry after 25',
      parameters: { retry_after: 25 }
    };
    await mock.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Flood'
      });
      assertFalse(res.success);
      assertEqual(res.status, 429);
      assertEqual(res.parameters?.retry_after, 25);
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.05: HTTP 429 Rate Limit without parameters object', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 429;
    mock.customResponse = {
      ok: false,
      error_code: 429,
      description: 'Too Many Requests: flood limit reached'
    };
    await mock.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Flood'
      });
      assertFalse(res.success);
      assertEqual(res.status, 429);
      assertEqual(res.parameters, undefined);
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.06: HTTP 500 Internal Server Error (JSON body)', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 500;
    mock.customResponse = { ok: false, error_code: 500, description: 'Internal server error' };
    await mock.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Test 500'
      });
      assertFalse(res.success);
      assertEqual(res.status, 500);
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.07: HTTP 502 Bad Gateway with raw Cloudflare HTML page', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'RAW_HTML_ERROR';
    await mock.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Test 502'
      });
      assertFalse(res.success);
      assertEqual(res.status, 502);
      // Ensures res.json() parse failure was safely caught and did not crash process
      assertIncludes(res.error, '502');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.08: Empty response body (HTTP 503 Service Unavailable)', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'EMPTY_BODY';
    mock.customStatus = 503;
    await mock.start();
    try {
      const res = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Test 503'
      });
      assertFalse(res.success);
      assertEqual(res.status, 503);
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.09: Network Socket Hang Up & Connection Refused', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'SOCKET_HANGUP';
    await mock.start();
    try {
      const resHangup = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Test Hangup'
      });
      assertFalse(resHangup.success);
      assertIncludes(resHangup.error, 'hang up');

      mock.behavior = 'CONN_REFUSED';
      const resRefused = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Test Refused'
      });
      assertFalse(resRefused.success);
      assertIncludes(resRefused.error, 'ECONNREFUSED');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-2.10: Truncated JSON / Non-object JSON responses', async () => {
    const mock = new AdversarialTelegramServer();
    mock.behavior = 'TRUNCATED_JSON';
    await mock.start();
    try {
      const resTruncated = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Test Truncated'
      });
      // Handled cleanly via catch(() => ({}))
      assertFalse(resTruncated.success);

      mock.behavior = 'NON_OBJECT_JSON';
      const resNonObj = await sendTelegramMessage({
        baseUrl: mock.baseUrl,
        botToken: '123:token',
        chatId: '12345',
        text: 'Test Non Object'
      });
      assertFalse(resNonObj.success);
    } finally {
      await mock.stop();
    }
  });
});

describe('ADV-3: Home Assistant Supervisor Error & Transport Boundaries', () => {
  test('ADV-3.01: Supervisor HTTP 401 Unauthorized', async () => {
    const mock = new AdversarialSupervisorServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 401;
    mock.customResponse = { message: '401: Unauthorized' };
    await mock.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mock.baseUrl,
        token: 'expired_or_invalid_token'
      });
      assertFalse(res.success);
      assertIncludes(res.message, '401');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-3.02: Supervisor HTTP 403 Forbidden', async () => {
    const mock = new AdversarialSupervisorServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 403;
    mock.customResponse = { message: '403: Forbidden' };
    await mock.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mock.baseUrl,
        token: 'insufficient_perms_token'
      });
      assertFalse(res.success);
      assertIncludes(res.message, '403');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-3.03: Supervisor HTTP 500 Internal Error', async () => {
    const mock = new AdversarialSupervisorServer();
    mock.behavior = 'CUSTOM';
    mock.customStatus = 500;
    mock.customResponse = { message: '500: Server Error' };
    await mock.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mock.baseUrl,
        token: 'any_token'
      });
      assertFalse(res.success);
      assertIncludes(res.message, '500');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-3.04: Supervisor Raw HTML 502 Bad Gateway Error', async () => {
    const mock = new AdversarialSupervisorServer();
    mock.behavior = 'RAW_HTML_ERROR';
    await mock.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mock.baseUrl,
        token: 'token'
      });
      assertFalse(res.success);
      assertIncludes(res.message, '502');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-3.05: Supervisor Offline / ECONNREFUSED', async () => {
    const mock = new AdversarialSupervisorServer();
    mock.behavior = 'OFFLINE';
    await mock.start();
    try {
      const res = await updateHomeAssistantSensor({
        supervisorUrl: mock.baseUrl,
        token: 'token',
        state: 1
      });
      assertFalse(res.success);
      assertIncludes(res.error, 'ECONNREFUSED');
    } finally {
      await mock.stop();
    }
  });

  test('ADV-3.06: Persistent Notification Creation & Dismissal under network failure', async () => {
    const mock = new AdversarialSupervisorServer();
    mock.behavior = 'SOCKET_HANGUP';
    await mock.start();
    try {
      const createRes = await createHomeAssistantNotification({
        supervisorUrl: mock.baseUrl,
        token: 'token',
        notificationId: 'notif_1',
        title: 'Test',
        message: 'Message'
      });
      assertFalse(createRes.success);
      assertIncludes(createRes.error, 'hang up');

      const dismissRes = await dismissHomeAssistantNotification({
        supervisorUrl: mock.baseUrl,
        token: 'token',
        notificationId: 'notif_1'
      });
      assertFalse(dismissRes.success);
      assertIncludes(dismissRes.error, 'hang up');
    } finally {
      await mock.stop();
    }
  });
});

describe('ADV-4: Process Immunity & Unhandled Promise Rejection Defense', () => {
  test('ADV-4.01: Zero unhandled promise rejections under high concurrent error volume', async () => {
    let unhandledRejectionsCount = 0;
    const rejectionHandler = (reason) => {
      unhandledRejectionsCount++;
      console.error('[UNHANDLED REJECTION TRAPPED]:', reason);
    };
    process.on('unhandledRejection', rejectionHandler);

    const mockTg = new AdversarialTelegramServer();
    mockTg.behavior = 'SOCKET_HANGUP';
    await mockTg.start();

    const mockHa = new AdversarialSupervisorServer();
    mockHa.behavior = 'OFFLINE';
    await mockHa.start();

    try {
      // Launch 50 concurrent failed dispatches across Telegram and HA
      const tgPromises = Array.from({ length: 25 }).map(() =>
        sendTelegramMessage({
          baseUrl: mockTg.baseUrl,
          botToken: '123:token',
          chatId: '456',
          text: 'Failing call'
        })
      );

      const haPromises = Array.from({ length: 25 }).map(() =>
        updateHomeAssistantSensor({
          supervisorUrl: mockHa.baseUrl,
          token: 'token',
          state: 5
        })
      );

      const results = await Promise.all([...tgPromises, ...haPromises]);
      assertEqual(results.length, 50);
      results.forEach(r => assertFalse(r.success));

      // Assert zero unhandled rejections escaped to process
      assertEqual(unhandledRejectionsCount, 0, 'Unhandled promise rejections leaked to process!');
    } finally {
      await mockTg.stop();
      await mockHa.stop();
      process.off('unhandledRejection', rejectionHandler);
    }
  });

  test('ADV-4.02: Syntax and Structural Integrity of server.js (Empirical Defect Detection)', async () => {
    // In node.js, checkSyntax / compilation of server.js can be tested dynamically via child_process
    const { execSync } = await import('child_process');
    let syntaxPassed = false;
    let syntaxErrorOutput = '';

    try {
      execSync('node -c server.js', { encoding: 'utf8', stdio: 'pipe' });
      syntaxPassed = true;
    } catch (err) {
      syntaxPassed = false;
      syntaxErrorOutput = (err.stderr || err.stdout || err.message).toString();
    }

    // VERIFICATION:
    // server.js syntax check must pass with code 0 (clean compilation)
    if (!syntaxPassed) {
      console.error('Syntax error output:', syntaxErrorOutput);
    }
    assertEqual(syntaxPassed, true, 'server.js must pass node -c syntax check');
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

