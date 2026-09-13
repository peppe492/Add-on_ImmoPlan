// tests/e2e/tier1_feature_coverage/f7_home_assistant_sensor_alerts.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { MockSupervisorServer } from '../harness/mock_supervisor.mjs';
import {
  updateHomeAssistantSensor,
  createHomeAssistantNotification,
  dismissHomeAssistantNotification
} from '../modules/notification_engine.mjs';

describe('Tier 1 - F7: Home Assistant Sensor & Alerts', () => {
  test('T1-F7-01: Publishes state and attributes to sensor.immoplan_affitti_stato', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        entityId: 'sensor.immoplan_affitti_stato',
        state: 1, // 1 overdue rent
        attributes: {
          totale_canoni: 2,
          in_scadenza: 0,
          scaduti: 1,
          saldati: 1
        }
      });

      assertTrue(res.success);
      const recorded = mockHA.sensorStates.get('sensor.immoplan_affitti_stato');
      assertEqual(recorded.state, '1');
      assertEqual(recorded.attributes.totale_canoni, 2);
      assertEqual(recorded.attributes.scaduti, 1);
      assertEqual(recorded.attributes.icon, 'mdi:alert-circle');
    } finally {
      await mockHA.stop();
    }
  });

  test('T1-F7-02: Publishes state 0 with check-circle icon when all rents are settled', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        entityId: 'sensor.immoplan_affitti_stato',
        state: 0,
        attributes: {
          totale_canoni: 2,
          scaduti: 0,
          saldati: 2
        }
      });

      assertTrue(res.success);
      const recorded = mockHA.sensorStates.get('sensor.immoplan_affitti_stato');
      assertEqual(recorded.state, '0');
      assertEqual(recorded.attributes.icon, 'mdi:check-circle');
    } finally {
      await mockHA.stop();
    }
  });

  test('T1-F7-03: Creates persistent notification for overdue rent', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      const res = await createHomeAssistantNotification({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        notificationId: 'immoplan_overdue_prop_1',
        title: 'Canone di Affitto Scaduto',
        message: 'Il canone per Appartamento Centro risulta scaduto.'
      });

      assertTrue(res.success);
      const notif = mockHA.persistentNotifications.get('immoplan_overdue_prop_1');
      assertEqual(notif.title, 'Canone di Affitto Scaduto');
      assertEqual(notif.notification_id, 'immoplan_overdue_prop_1');
    } finally {
      await mockHA.stop();
    }
  });

  test('T1-F7-04: Dismisses persistent notification when rent is paid', async () => {
    const mockHA = new MockSupervisorServer();
    await mockHA.start();
    try {
      // First create
      await createHomeAssistantNotification({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        notificationId: 'immoplan_overdue_prop_1',
        title: 'Overdue',
        message: 'Overdue rent'
      });
      assertEqual(mockHA.persistentNotifications.has('immoplan_overdue_prop_1'), true);

      // Now dismiss
      const res = await dismissHomeAssistantNotification({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'mock_supervisor_token_secret_123',
        notificationId: 'immoplan_overdue_prop_1'
      });
      assertTrue(res.success);
      assertEqual(mockHA.persistentNotifications.has('immoplan_overdue_prop_1'), false);
    } finally {
      await mockHA.stop();
    }
  });

  test('T1-F7-05: Handles supervisor 500 error gracefully without unhandled exception', async () => {
    const mockHA = new MockSupervisorServer();
    mockHA.setMode('SERVER_ERROR');
    await mockHA.start();
    try {
      const res = await updateHomeAssistantSensor({
        supervisorUrl: mockHA.getBaseUrl(),
        token: 'token',
        state: 1
      });
      assertFalse(res.success);
      assertEqual(res.status, 500);
    } finally {
      await mockHA.stop();
    }
  });
});
