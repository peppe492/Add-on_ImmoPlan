// tests/e2e/harness/mock_http_dispatcher.mjs
// Centralized, zero-network in-process HTTP mock dispatcher for fetch

if (!globalThis.__origFetch) {
  globalThis.__origFetch = globalThis.fetch;
}

if (!globalThis.__mockHttpHandlers) {
  globalThis.__mockHttpHandlers = [];
}

export function registerMockHandler(handler) {
  globalThis.__mockHttpHandlers.push(handler);
  ensureGlobalDispatcher();
}

export function unregisterMockHandler(handler) {
  globalThis.__mockHttpHandlers = globalThis.__mockHttpHandlers.filter(h => h !== handler);
}

function ensureGlobalDispatcher() {
  if (globalThis.fetch !== globalMockFetch) {
    globalThis.fetch = globalMockFetch;
  }
}

async function globalMockFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || '';

  // Check if this is an explicitly simulated offline port
  if (url.includes('49998') || url.includes('49997') || url.includes('49999')) {
    throw new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1');
  }

  // Iterate over registered mock handlers
  for (const h of globalThis.__mockHttpHandlers) {
    if (h.matchesUrl(url)) {
      return h.handleRequest(url, init);
    }
  }

  return globalThis.__origFetch(input, init);
}
