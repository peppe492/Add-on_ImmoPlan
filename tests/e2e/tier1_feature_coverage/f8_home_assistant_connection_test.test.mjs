// tests/e2e/tier1_feature_coverage/f8_home_assistant_connection_test.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { MockSupervisorServer } from '../harness/mock_supervisor.mjs';
import { testHomeAssistantConnection } from '../modules/notification_engine.mjs';

describe('Tier 1 - F8: Home Assistant Connection Test', () => {
  test('T1-F8-01: Verifies connectivity to HA supervisor config endpoint successfully', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123'
      });
      assertTrue(res.success);
      assertEqual(res.haVersion, '2026.9.1');
      assertEqual(res.message.includes('riuscita'), true);
    } finally {
      await mockHA.stop();
    }
  });

  test('T1-F8-02: Returns failure when HA supervisor returns 401 Unauthorized', async () => {
    const mockHA = new MockSupervisorServer();
    mockHA.setMode('UNAUTHORIZED');
    await mockHA.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'invalid_ha_token'
      });
      assertFalse(res.success);
      assertEqual(res.message.includes('401'), true);
    } finally {
      await mockHA.stop();
    }
  });

  test('T1-F8-03: Returns failure when supervisor returns 500 error', async () => {
    const mockHA = new MockSupervisorServer();
    mockHA.setMode('SERVER_ERROR');
    await mockHA.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'any_token'
      });
      assertFalse(res.success);
      assertEqual(res.message.includes('500'), true);
    } finally {
      await mockHA.stop();
    }
  });

  test('T1-F8-04: Returns unreachable error when supervisor is offline', async () => {
    const res = await testHomeAssistantConnection({
      supervisorUrl: 'http://127.0.0.1:49998',
      token: 'some_token'
    });
    assertFalse(res.success);
    assertEqual(res.message.includes('non raggiungibile'), true);
  });

  test('T1-F8-05: Handles supervisorUrl with or without trailing slashes cleanly', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await testHomeAssistantConnection({
        supervisorUrl: `${mockHA.getBaseUrl()}///`,
        token: 'mock_supervisor_token_secret_123'
      });
      assertTrue(res.success);
      assertEqual(res.haVersion, '2026.9.1');
    } finally {
      await mockHA.stop();
    }
  });
});
