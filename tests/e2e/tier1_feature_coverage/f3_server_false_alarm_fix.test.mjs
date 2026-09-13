// tests/e2e/tier1_feature_coverage/f3_server_false_alarm_fix.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { reconcileServerRentDeadlines } from '../modules/rent_status_engine.mjs';
import { fixturePropertyCedolare } from '../harness/fixtures.mjs';

describe('Tier 1 - F3: Server False Alarm Fix', () => {
  test('T1-F3-01: Server cron marks isCompleted true when rentalRecord payment exists', () => {
    // Current date is 2026-09-10 (past due date of day 5)
    const rentalRecords = [{
      id: 'rec_paid_sept',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8, // September
      income: 850,
      transactionDate: '2026-09-02'
    }];
    const deadlines = reconcileServerRentDeadlines([fixturePropertyCedolare], rentalRecords, '2026-09-10');
    assertEqual(deadlines.length, 1);
    assertTrue(deadlines[0].isCompleted);
  });

  test('T1-F3-02: Suppresses overdue alarm trigger when rent is paid', () => {
    const rentalRecords = [{
      id: 'rec_paid_sept',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8,
      income: 850,
      transactionDate: '2026-09-04'
    }];
    const deadlines = reconcileServerRentDeadlines([fixturePropertyCedolare], rentalRecords, '2026-09-10');
    assertFalse(deadlines[0].isOverdueAlarmTriggerable);
  });

  test('T1-F3-03: Triggers overdue alarm when past due and no rentalRecord exists', () => {
    // September 10, no payment record
    const deadlines = reconcileServerRentDeadlines([fixturePropertyCedolare], [], '2026-09-10');
    assertEqual(deadlines.length, 1);
    assertFalse(deadlines[0].isCompleted);
    assertTrue(deadlines[0].isOverdueAlarmTriggerable);
  });

  test('T1-F3-04: Does not trigger overdue alarm for future dates before due date', () => {
    // September 2, due date September 5
    const deadlines = reconcileServerRentDeadlines([fixturePropertyCedolare], [], '2026-09-02');
    assertEqual(deadlines.length, 1);
    assertFalse(deadlines[0].isCompleted);
    assertFalse(deadlines[0].isOverdueAlarmTriggerable);
  });

  test('T1-F3-05: Dynamically clears overdue flag when payment is added', () => {
    // Run 1: Unpaid on Sept 10
    const run1 = reconcileServerRentDeadlines([fixturePropertyCedolare], [], '2026-09-10');
    assertTrue(run1[0].isOverdueAlarmTriggerable);

    // Run 2: Payment recorded
    const run2 = reconcileServerRentDeadlines([fixturePropertyCedolare], [{
      id: 'pmt_now',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8,
      income: 850,
      transactionDate: '2026-09-10'
    }], '2026-09-10');
    assertFalse(run2[0].isOverdueAlarmTriggerable);
    assertTrue(run2[0].isCompleted);
  });
});
