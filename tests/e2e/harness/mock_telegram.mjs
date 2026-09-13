// tests/e2e/harness/mock_telegram.mjs
// In-process mock server for official Telegram Bot API

import { registerMockHandler, unregisterMockHandler } from './mock_http_dispatcher.mjs';

export class MockTelegramServer {
  constructor(baseUrl = null) {
    this.baseUrl = baseUrl || `https://api.telegram.org-mock-${Date.now()}`;
    this.recordedRequests = [];
    this.sentMessages = [];
    this.sentDocuments = [];
    this.mode = 'ONLINE'; // 'ONLINE' | 'INVALID_TOKEN' | 'BLOCKED_BY_USER' | 'RATE_LIMITED'
    this.expectedToken = '123456789:valid_token';
  }

  matchesUrl(url) {
    return (
      url.startsWith(this.baseUrl) ||
      url.includes('api.telegram.org') ||
      url.includes('/bot')
    );
  }

  async start() {
    registerMockHandler(this);
    return this.baseUrl;
  }

  async stop() {
    unregisterMockHandler(this);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  reset() {
    this.recordedRequests = [];
    this.sentMessages = [];
    this.sentDocuments = [];
    this.mode = 'ONLINE';
  }

  setMode(mode) {
    this.mode = mode;
  }

  async handleRequest(url, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    const headers = init.headers || {};
    let parsedBody = null;

    if (init.body) {
      if (typeof init.body === 'string') {
        try {
          parsedBody = JSON.parse(init.body);
        } catch (e) {
          parsedBody = init.body;
        }
      } else if (init.body instanceof FormData) {
        parsedBody = {};
        for (const [key, val] of init.body.entries()) {
          parsedBody[key] = val;
        }
      } else {
        parsedBody = init.body;
      }
    }

    this.recordedRequests.push({
      method,
      url,
      headers,
      body: parsedBody,
      timestamp: new Date().toISOString()
    });

    const match = url.match(/\/bot([^/]+)\/(.*)$/);
    const token = match ? match[1] : '';
    const tgMethod = match ? match[2] : '';

    if (this.mode === 'INVALID_TOKEN' || token.includes('invalid') || token === 'bad_token') {
      return new Response(
        JSON.stringify({ ok: false, error_code: 401, description: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (this.mode === 'BLOCKED_BY_USER') {
      return new Response(
        JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (this.mode === 'RATE_LIMITED') {
      return new Response(
        JSON.stringify({
          ok: false,
          error_code: 429,
          description: 'Too Many Requests: retry after 5',
          parameters: { retry_after: 5 }
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (tgMethod === 'getMe') {
      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            id: 123456789,
            is_bot: true,
            first_name: 'ImmoPlan Bot',
            username: 'immoplan_notification_bot',
            can_join_groups: true
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (tgMethod === 'sendMessage') {
      const chatId = parsedBody?.chat_id;
      const text = parsedBody?.text;
      const parseMode = parsedBody?.parse_mode;

      if (!chatId || !text) {
        return new Response(
          JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: chat_id and text required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const sentItem = {
        message_id: this.sentMessages.length + 1,
        chat_id: String(chatId),
        text,
        parse_mode: parseMode,
        date: Math.floor(Date.now() / 1000)
      };
      this.sentMessages.push(sentItem);

      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            message_id: sentItem.message_id,
            chat: { id: sentItem.chat_id, type: 'private' },
            date: sentItem.date,
            text: sentItem.text
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (tgMethod === 'sendDocument') {
      const sentDoc = {
        document_id: this.sentDocuments.length + 1,
        payload: parsedBody,
        date: Math.floor(Date.now() / 1000)
      };
      this.sentDocuments.push(sentDoc);

      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            message_id: this.sentDocuments.length + 100,
            document: {
              file_id: `file_${Date.now()}`,
              file_name: 'quietanza.pdf',
              mime_type: 'application/pdf'
            }
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error_code: 404, description: `Unsupported method: ${tgMethod}` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
