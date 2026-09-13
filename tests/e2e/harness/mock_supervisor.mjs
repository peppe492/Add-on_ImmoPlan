// tests/e2e/harness/mock_supervisor.mjs
// In-process mock server for Home Assistant Supervisor REST API

import { registerMockHandler, unregisterMockHandler } from './mock_http_dispatcher.mjs';

export class MockSupervisorServer {
  constructor(baseUrl = null) {
    this.baseUrl = baseUrl || `http://supervisor-mock-${Date.now()}`;
    this.recordedRequests = [];
    this.sensorStates = new Map();
    this.persistentNotifications = new Map();
    this.events = [];
    this.mode = 'ONLINE'; // 'ONLINE' | 'UNAUTHORIZED' | 'SERVER_ERROR' | 'OFFLINE'
    this.expectedToken = 'mock_supervisor_token_secret_123';
  }

  matchesUrl(url) {
    return (
      url.startsWith(this.baseUrl) ||
      url.includes('http://supervisor/core/api') ||
      url.includes('/core/api/')
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
    this.sensorStates.clear();
    this.persistentNotifications.clear();
    this.events = [];
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

    if (this.mode === 'OFFLINE' || url.includes('49998') || url.includes('49997')) {
      throw new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1');
    }

    if (this.mode === 'UNAUTHORIZED') {
      return new Response(JSON.stringify({ message: '401: Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (this.mode === 'SERVER_ERROR') {
      return new Response(JSON.stringify({ message: '500: Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /core/api/config
    if (url.includes('/core/api/config')) {
      return new Response(
        JSON.stringify({
          version: '2026.9.1',
          location_name: 'Test Casa ImmoPlan',
          time_zone: 'Europe/Rome',
          components: ['sensor', 'persistent_notification']
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // POST /core/api/states/:entityId
    if (url.includes('/core/api/states/')) {
      const match = url.match(/\/core\/api\/states\/([^/?#]+)/);
      const entityId = match ? match[1] : 'unknown_entity';
      this.sensorStates.set(entityId, parsedBody || {});
      return new Response(
        JSON.stringify({
          entity_id: entityId,
          state: parsedBody?.state,
          attributes: parsedBody?.attributes || {},
          last_updated: new Date().toISOString()
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // POST /core/api/services/persistent_notification/create
    if (url.includes('/core/api/services/persistent_notification/create')) {
      const notificationId = parsedBody?.notification_id || `notif_${Date.now()}`;
      this.persistentNotifications.set(notificationId, parsedBody);
      return new Response(
        JSON.stringify({ success: true, notification_id: notificationId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // POST /core/api/services/persistent_notification/dismiss
    if (url.includes('/core/api/services/persistent_notification/dismiss')) {
      const notificationId = parsedBody?.notification_id;
      this.persistentNotifications.delete(notificationId);
      return new Response(
        JSON.stringify({ success: true, dismissed: notificationId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // POST /core/api/events/:eventType
    if (url.includes('/core/api/events/')) {
      const match = url.match(/\/core\/api\/events\/([^/?#]+)/);
      const eventType = match ? match[1] : 'unknown_event';
      this.events.push({ eventType, payload: parsedBody, timestamp: new Date().toISOString() });
      return new Response(
        JSON.stringify({ message: `Event ${eventType} fired.` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
