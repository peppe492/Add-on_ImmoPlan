// tests/e2e/tier1_feature_coverage/f1_dynamic_rent_due_date.test.mjs
import { describe, test, assertEqual } from '../harness/test_framework.mjs';
import { calculateRentDueDate } from '../modules/rent_status_engine.mjs';
import { fixturePropertyCedolare, fixtureTenant1 } from '../harness/fixtures.mjs';

describe('Tier 1 - F1: Dynamic Rent Due Date', () => {
  test('T1-F1-01: Uses property financials.rentDueDay when tenant has no override', () => {
    const prop = { ...fixturePropertyCedolare, financials: { ...fixturePropertyCedolare.financials, rentDueDay: 15 } };
    const tenantWithoutDueDay = { id: 't1', name: 'Mario Rossi' };
    const dueDate = calculateRentDueDate(prop, tenantWithoutDueDay, 2026, 8); // Sept 2026
    assertEqual(dueDate, '2026-09-15');
  });

  test('T1-F1-02: Overrides property due day with tenant rentDueDay', () => {
    const prop = { ...fixturePropertyCedolare, financials: { ...fixturePropertyCedolare.financials, rentDueDay: 5 } };
    const tenantWithCustomDay = { id: 't2', name: 'Giulia Bianchi', rentDueDay: 12 };
    const dueDate = calculateRentDueDate(prop, tenantWithCustomDay, 2026, 4); // May 2026
    assertEqual(dueDate, '2026-05-12');
  });

  test('T1-F1-03: Falls back to standard default day 5 when unspecified', () => {
    const prop = { id: 'prop_empty', name: 'Studio', financials: { monthlyRent: 600 } };
    const tenant = { id: 't3', name: 'Luca Verdi' };
    const dueDate = calculateRentDueDate(prop, tenant, 2026, 2); // March 2026
    assertEqual(dueDate, '2026-03-05');
  });

  test('T1-F1-04: Returns strictly ISO formatted date string YYYY-MM-DD', () => {
    const dueDate = calculateRentDueDate(fixturePropertyCedolare, fixtureTenant1, 2026, 0); // Jan 2026
    assertEqual(dueDate, '2026-01-05');
    assertEqual(/^\d{4}-\d{2}-\d{2}$/.test(dueDate), true);
  });

  test('T1-F1-05: Generates consistent due dates across 12 consecutive calendar months', () => {
    const prop = { ...fixturePropertyCedolare, financials: { ...fixturePropertyCedolare.financials, rentDueDay: 8 } };
    for (let m = 0; m < 12; m++) {
      const dueDate = calculateRentDueDate(prop, null, 2026, m);
      const expectedMonth = String(m + 1).padStart(2, '0');
      assertEqual(dueDate, `2026-${expectedMonth}-08`);
    }
  });
});
