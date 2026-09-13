// tests/e2e/tier1_feature_coverage/f15_rent_monitoring_view_badges.test.mjs
import { describe, test, assertEqual, assertTrue } from '../harness/test_framework.mjs';
import { getRentBadgeInfo } from '../modules/ui_contract_engine.mjs';

describe('Tier 1 - F15: Rent Monitoring View & Badges', () => {
  test('T1-F15-01: Maps SALDATO status to Emerald badge styling and label "Saldato"', () => {
    const badge = getRentBadgeInfo('SALDATO', 0);
    assertEqual(badge.label, 'Saldato');
    assertEqual(badge.badgeColor, 'emerald');
    assertTrue(badge.bgClass.includes('emerald'));
    assertEqual(badge.icon, 'check-circle');
  });

  test('T1-F15-02: Maps IN_SCADENZA with days countdown to Amber badge styling', () => {
    const badge = getRentBadgeInfo('IN_SCADENZA', 4);
    assertEqual(badge.label, 'In Scadenza (4 gg)');
    assertEqual(badge.badgeColor, 'amber');
    assertTrue(badge.bgClass.includes('amber'));
  });

  test('T1-F15-03: Maps IN_SCADENZA on due day to "Scade Oggi"', () => {
    const badge = getRentBadgeInfo('IN_SCADENZA', 0);
    assertEqual(badge.label, 'Scade Oggi');
  });

  test('T1-F15-04: Maps SCADUTO to Rose badge with overdue day count', () => {
    const badge = getRentBadgeInfo('SCADUTO', -3);
    assertEqual(badge.label, 'Scaduto (3 gg fa)');
    assertEqual(badge.badgeColor, 'rose');
    assertTrue(badge.bgClass.includes('rose'));
    assertEqual(badge.icon, 'alert-triangle');
  });

  test('T1-F15-05: Maps PROGRAMMATO to Slate badge with label "Programmato"', () => {
    const badge = getRentBadgeInfo('PROGRAMMATO', 20);
    assertEqual(badge.label, 'Programmato');
    assertEqual(badge.badgeColor, 'slate');
    assertTrue(badge.bgClass.includes('slate'));
    assertEqual(badge.icon, 'calendar');
  });
});
