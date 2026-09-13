// tests/e2e/tier1_feature_coverage/f2_unified_rent_status_engine.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { evaluateRentStatus } from '../modules/rent_status_engine.mjs';
import { fixturePropertyCedolare, fixtureTenant1 } from '../harness/fixtures.mjs';

describe('Tier 1 - F2: Unified Rent Status Engine', () => {
  test('T1-F2-01: Classifies status as SALDATO when payment is recorded in rentalRecords', () => {
    // Due date 2026-09-05. Today is 2026-09-04.
    const rentalRecords = [{
      id: 'rec_1',
      propertyId: fixturePropertyCedolare.id,
      year: 2026,
      month: 8, // September (0-indexed)
      income: 850,
      transactionDate: '2026-09-03'
    }];
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, rentalRecords, '2026-09-04');
    assertEqual(res.status, 'SALDATO');
    assertTrue(res.isPaid);
    assertEqual(res.paidAmount, 850);
  });

  test('T1-F2-02: Classifies status as IN_SCADENZA within reminderAdvanceDays', () => {
    // Due date 2026-09-05. Today is 2026-09-02 (3 days before due). Advance threshold: 5 days.
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-02', 5);
    assertEqual(res.status, 'IN_SCADENZA');
    assertFalse(res.isPaid);
    assertEqual(res.daysUntilDue, 3);
  });

  test('T1-F2-03: Classifies status as SCADUTO when past due and unpaid', () => {
    // Due date 2026-09-05. Today is 2026-09-07 (2 days overdue).
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-07', 5);
    assertEqual(res.status, 'SCADUTO');
    assertFalse(res.isPaid);
    assertEqual(res.daysUntilDue, -2);
  });

  test('T1-F2-04: Classifies status as PROGRAMMATO when beyond advance warning threshold', () => {
    // Due date 2026-09-05. Today is 2026-08-20 (16 days before due). Target month: September (8).
    const res = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-08-20', 5, 2026, 8);
    assertEqual(res.status, 'PROGRAMMATO');
    assertFalse(res.isPaid);
    assertEqual(res.daysUntilDue, 16);
  });

  test('T1-F2-05: Returns exact signed integer daysUntilDue across dates', () => {
    // Exactly on due day: 2026-09-05 vs 2026-09-05 -> daysUntilDue = 0
    const resToday = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-05', 5);
    assertEqual(resToday.daysUntilDue, 0);
    assertEqual(resToday.status, 'IN_SCADENZA');
  });
});
