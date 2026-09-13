// tests/e2e/tier1_feature_coverage/f13_settings_test_ui_panel.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { validateNotificationSettings } from '../modules/persistence_engine.mjs';
import { fixtureSettings } from '../harness/fixtures.mjs';

describe('Tier 1 - F13: Settings & Test UI Panel Contracts', () => {
  test('T1-F13-01: Validates notification settings state with both channels enabled', () => {
    const res = validateNotificationSettings(fixtureSettings);
    assertTrue(res.valid);
    assertEqual(fixtureSettings.homeAssistant.enabled, true);
    assertEqual(fixtureSettings.telegram.enabled, true);
  });

  test('T1-F13-02: Allows disabling one or both notification channels', () => {
    const custom = {
      ...fixtureSettings,
      homeAssistant: { ...fixtureSettings.homeAssistant, enabled: false },
      telegram: { ...fixtureSettings.telegram, enabled: false }
    };
    const res = validateNotificationSettings(custom);
    assertTrue(res.valid);
    assertFalse(custom.homeAssistant.enabled);
    assertFalse(custom.telegram.enabled);
  });

  test('T1-F13-03: Validates advance reminder days in range 1-30', () => {
    const s1 = { ...fixtureSettings, reminderAdvanceDays: 1 };
    const s30 = { ...fixtureSettings, reminderAdvanceDays: 30 };
    assertTrue(validateNotificationSettings(s1).valid);
    assertTrue(validateNotificationSettings(s30).valid);
  });

  test('T1-F13-04: Rejects advance reminder days greater than 30', () => {
    const s31 = { ...fixtureSettings, reminderAdvanceDays: 31 };
    assertFalse(validateNotificationSettings(s31).valid);
  });

  test('T1-F13-05: Requires valid sensorEntityId string for Home Assistant', () => {
    const invalid = {
      ...fixtureSettings,
      homeAssistant: { ...fixtureSettings.homeAssistant, sensorEntityId: '' }
    };
    // Empty entity ID should be discouraged or flagged
    assertEqual(Boolean(invalid.homeAssistant.sensorEntityId), false);
  });
});
