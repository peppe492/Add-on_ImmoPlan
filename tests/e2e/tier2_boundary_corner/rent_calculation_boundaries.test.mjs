// tests/e2e/tier2_boundary_corner/rent_calculation_boundaries.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { calculateRentDueDate, evaluateRentStatus, reconcileServerRentDeadlines } from '../modules/rent_status_engine.mjs';
import { fixturePropertyCedolare, fixtureTenant1 } from '../harness/fixtures.mjs';

describe('Tier 2 - Rent Calculation Boundaries & Corner Cases', () => {
  // F1 Due Date Boundaries
  test('T2-F1-01: February in non-leap year (2026) clamps day 31 to Feb 28', () => {
    const prop = { financials: { rentDueDay: 31 } };
    const date = calculateRentDueDate(prop, null, 2026, 1); // Feb 2026
    assertEqual(date, '2026-02-28');
  });

  test('T2-F1-02: February in leap year (2028) clamps day 31 to Feb 29', () => {
    const prop = { financials: { rentDueDay: 31 } };
    const date = calculateRentDueDate(prop, null, 2028, 1); // Feb 2028
    assertEqual(date, '2028-02-29');
  });

  test('T2-F1-03: 30-day month (April) clamps day 31 to April 30', () => {
    const prop = { financials: { rentDueDay: 31 } };
    const date = calculateRentDueDate(prop, null, 2026, 3); // April 2026
    assertEqual(date, '2026-04-30');
  });

  test('T2-F1-04: Minimum boundary due day 1 works on January 1', () => {
    const prop = { financials: { rentDueDay: 1 } };
    const date = calculateRentDueDate(prop, null, 2026, 0); // Jan 2026
    assertEqual(date, '2026-01-01');
  });

  test('T2-F1-05: Invalid due day (0, negative, >31, NaN) falls back to default 5', () => {
    assertEqual(calculateRentDueDate({ financials: { rentDueDay: 0 } }, null, 2026, 5), '2026-06-05');
    assertEqual(calculateRentDueDate({ financials: { rentDueDay: -5 } }, null, 2026, 5), '2026-06-05');
    assertEqual(calculateRentDueDate({ financials: { rentDueDay: 50 } }, null, 2026, 5), '2026-06-05');
    assertEqual(calculateRentDueDate({ financials: { rentDueDay: NaN } }, null, 2026, 5), '2026-06-05');
  });

  // F2 Unified Status Engine Boundaries
  test('T2-F2-01: Exactly on due date (daysUntilDue = 0) is IN_SCADENZA', () => {
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-05', 5);
    assertEqual(res.daysUntilDue, 0);
    assertEqual(res.status, 'IN_SCADENZA');
  });

  test('T2-F2-02: Exactly 1 day overdue (daysUntilDue = -1) is SCADUTO', () => {
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-06', 5);
    assertEqual(res.daysUntilDue, -1);
    assertEqual(res.status, 'SCADUTO');
  });

  test('T2-F2-03: Exactly on advance warning threshold (daysUntilDue = 5) is IN_SCADENZA', () => {
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-08-31', 5, 2026, 8);
    assertEqual(res.daysUntilDue, 5);
    assertEqual(res.status, 'IN_SCADENZA');
  });

  test('T2-F2-04: Exactly one day beyond advance warning threshold (daysUntilDue = 6) is PROGRAMMATO', () => {
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-08-30', 5, 2026, 8);
    assertEqual(res.daysUntilDue, 6);
    assertEqual(res.status, 'PROGRAMMATO');
  });

  test('T2-F2-05: Partial payment (amount < monthlyRent) remains unpaid', () => {
    const partialRecords = [{
      id: 'p_part',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8,
      income: 400 // Monthly rent is 850
    }];
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, partialRecords, '2026-09-06', 5);
    assertFalse(res.isPaid);
    assertEqual(res.status, 'SCADUTO');
    assertEqual(res.paidAmount, 400);
  });

  test('T2-F2-06: Multiple partial payments summing >= monthlyRent qualifies as SALDATO', () => {
    const splitRecords = [
      { id: 'p1', propertyId: fixturePropertyCedolare.id, year: 2026, month: 8, income: 400 },
      { id: 'p2', propertyId: fixturePropertyCedolare.id, year: 2026, month: 8, income: 450 }
    ];
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, splitRecords, '2026-09-06', 5);
    assertTrue(res.isPaid);
    assertEqual(res.status, 'SALDATO');
    assertEqual(res.paidAmount, 850);
  });

  test('T2-F2-07: Overpayment (paid > monthlyRent) qualifies as SALDATO', () => {
    const overpayment = [{
      id: 'p_over',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8,
      income: 1000
    }];
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, overpayment, '2026-09-06', 5);
    assertTrue(res.isPaid);
    assertEqual(res.status, 'SALDATO');
  });

  test('T2-F2-08: Zero amount payment (income = 0) does not qualify as paid', () => {
    const zeroPayment = [{
      id: 'p_zero',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8,
      income: 0
    }];
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, zeroPayment, '2026-09-06', 5);
    assertFalse(res.isPaid);
  });

  test('T2-F2-09: Payment for different property does not mark current property paid', () => {
    const otherPropPayment = [{
      id: 'p_other',
      propertyId: 'some_other_property_id',
      year: 2026,
      month: 8,
      income: 850
    }];
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, otherPropPayment, '2026-09-06', 5);
    assertFalse(res.isPaid);
  });

  test('T2-F2-10: Payment for different month does not mark current month paid', () => {
    const lastMonthPayment = [{
      id: 'p_last',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 7, // August
      income: 850
    }];
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, lastMonthPayment, '2026-09-06', 5);
    assertFalse(res.isPaid);
  });

  // F3 False Alarm Server Boundaries
  test('T2-F3-01: Server cron marks overdue only when date is strictly past due and unpaid', () => {
    const deadlines = reconcileServerRentDeadlines([fixturePropertyCedolare], [], '2026-09-06');
    assertEqual(deadlines[0].isOverdueAlarmTriggerable, true);
  });

  test('T2-F3-02: Server cron does not trigger alarm on due date itself when not completed', () => {
    // Sept 5 is due date
    const deadlines = reconcileServerRentDeadlines([fixturePropertyCedolare], [], '2026-09-05');
    assertEqual(deadlines[0].isOverdueAlarmTriggerable, true);
  });

  test('T2-F3-03: Server cron handles empty properties array gracefully', () => {
    const deadlines = reconcileServerRentDeadlines([], [], '2026-09-10');
    assertEqual(deadlines.length, 0);
  });

  test('T2-F3-04: Server cron ignores properties with monthlyRent = 0', () => {
    const freeProp = { id: 'p_free', name: 'Free', financials: { monthlyRent: 0 } };
    const deadlines = reconcileServerRentDeadlines([freeProp], [], '2026-09-10');
    assertEqual(deadlines.length, 0);
  });

  test('T2-F3-05: Server cron handles undefined or null rentalRecords without crashing', () => {
    const deadlines = reconcileServerRentDeadlines([fixturePropertyCedolare], null, '2026-09-10');
    assertEqual(deadlines.length, 1);
    assertFalse(deadlines[0].isCompleted);
  });
});
