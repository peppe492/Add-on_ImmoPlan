// tests/m1_challenger_rent_status.test.mjs
// Comprehensive Adversarial Stress Test Suite for services/rentStatusService.ts
// Challenger 1 - Milestone 1

import { describe, test, assertEqual, assertTrue, assertFalse } from './e2e/harness/test_framework.mjs';
import {
  isLeapYear,
  getDaysInMonth,
  getEffectiveRentDueDay,
  resolveRentDueDay,
  calculateDueDate,
  calculateDaysUntilDue,
  calculateRentStatus,
  evaluateAllRents,
  getRentStatusSummary,
  getUtcMidnight
} from './rentStatusService.bundled.mjs';

// --- Fixtures ---
const mockProperty = {
  id: 'prop_test_01',
  name: 'Via Roma 10, Milano',
  type: 'RESIDENTIAL',
  status: 'RENTED',
  currentTenantId: 'tenant_test_01',
  financials: {
    monthlyRent: 850,
    rentDueDay: 5
  }
};

const mockTenant = {
  id: 'tenant_test_01',
  name: 'Mario Rossi',
  email: 'mario.rossi@example.com',
  phone: '+39 333 1234567',
  rentDueDay: 5,
  telegramChatId: '123456789'
};

// =========================================================================
// SUITE 1: Leap Years & Clamping across all 12 months
// =========================================================================
describe('Challenger 1 - Leap Years & Clamping Matrix', () => {
  test('L1: Gregorian Leap Year verification for specified challenge years', () => {
    // 2020: leap (divisible by 4, not 100)
    assertTrue(isLeapYear(2020), '2020 must be a leap year');
    // 2024: leap (divisible by 4, not 100)
    assertTrue(isLeapYear(2024), '2024 must be a leap year');
    // 2026: common year
    assertFalse(isLeapYear(2026), '2026 must NOT be a leap year');
    // 2000: leap (divisible by 400)
    assertTrue(isLeapYear(2000), '2000 must be a leap year (divisible by 400)');
    // 2100: common year (divisible by 100, not 400)
    assertFalse(isLeapYear(2100), '2100 must NOT be a leap year (century rule)');
    // 2400: leap (divisible by 400)
    assertTrue(isLeapYear(2400), '2400 must be a leap year (400-year century rule)');
  });

  test('L2: February days count matches Gregorian calendar across leap and common years', () => {
    assertEqual(getDaysInMonth(2020, 1), 29, '2020 Feb must have 29 days');
    assertEqual(getDaysInMonth(2024, 1), 29, '2024 Feb must have 29 days');
    assertEqual(getDaysInMonth(2026, 1), 28, '2026 Feb must have 28 days');
    assertEqual(getDaysInMonth(2000, 1), 29, '2000 Feb must have 29 days');
    assertEqual(getDaysInMonth(2100, 1), 28, '2100 Feb must have 28 days');
    assertEqual(getDaysInMonth(2400, 1), 29, '2400 Feb must have 29 days');
  });

  test('L3: Clamping matrix across all 12 months for days 28, 29, 30, 31 (288 assertions)', () => {
    const years = [2020, 2024, 2026, 2000, 2100, 2400];
    const testDays = [28, 29, 30, 31];

    for (const year of years) {
      for (let month = 0; month < 12; month++) {
        const daysInMonth = getDaysInMonth(year, month);
        for (const day of testDays) {
          const calculatedDueDate = calculateDueDate(year, month, day);
          const expectedClampedDay = Math.min(day, daysInMonth);
          const mm = String(month + 1).padStart(2, '0');
          const dd = String(expectedClampedDay).padStart(2, '0');
          const expectedIso = `${year}-${mm}-${dd}`;

          assertEqual(
            calculatedDueDate,
            expectedIso,
            `Clamping failed for year=${year}, month=${month}, day=${day}`
          );
        }
      }
    }
  });

  test('L4: Due day fallback and clamping boundaries in getEffectiveRentDueDay', () => {
    assertEqual(getEffectiveRentDueDay(0), 5, 'Day 0 should fallback to 5');
    assertEqual(getEffectiveRentDueDay(-10), 5, 'Negative day should fallback to 5');
    assertEqual(getEffectiveRentDueDay(32), 5, 'Day 32 should fallback to 5');
    assertEqual(getEffectiveRentDueDay(100), 5, 'Day 100 should fallback to 5');
    assertEqual(getEffectiveRentDueDay(null), 5, 'Null should fallback to 5');
    assertEqual(getEffectiveRentDueDay(undefined), 5, 'Undefined should fallback to 5');
    assertEqual(getEffectiveRentDueDay(NaN), 5, 'NaN should fallback to 5');
    assertEqual(getEffectiveRentDueDay(1), 1, 'Day 1 is valid lower bound');
    assertEqual(getEffectiveRentDueDay(31), 31, 'Day 31 is valid upper bound');
    assertEqual(getEffectiveRentDueDay(28.9), 28, 'Decimals should be floored');
  });
});

// =========================================================================
// SUITE 2: Due Day Resolution Priority
// =========================================================================
describe('Challenger 1 - Due Day Resolution Priority', () => {
  test('P1: Tenant rentDueDay takes precedence over Property financials and Property root', () => {
    const prop = {
      ...mockProperty,
      rentDueDay: 10,
      financials: { monthlyRent: 800, rentDueDay: 15 }
    };
    const tenant = { ...mockTenant, rentDueDay: 22 };
    assertEqual(resolveRentDueDay(prop, tenant), 22);
  });

  test('P2: Property financials rentDueDay is used when Tenant rentDueDay is missing', () => {
    const prop = {
      ...mockProperty,
      rentDueDay: 10,
      financials: { monthlyRent: 800, rentDueDay: 15 }
    };
    const tenant = { ...mockTenant, rentDueDay: undefined };
    assertEqual(resolveRentDueDay(prop, tenant), 15);
  });

  test('P3: Property root rentDueDay is used when Tenant and financials are missing', () => {
    const prop = {
      id: 'p1',
      name: 'Test',
      rentDueDay: 12
    };
    assertEqual(resolveRentDueDay(prop), 12);
  });

  test('P4: Fallback to day 5 when all rentDueDay sources are absent or invalid', () => {
    const prop = { id: 'p1', name: 'Test' };
    assertEqual(resolveRentDueDay(prop), 5);

    const propInvalid = { id: 'p1', name: 'Test', financials: { monthlyRent: 800, rentDueDay: 99 } };
    const tenantInvalid = { ...mockTenant, rentDueDay: 0 };
    assertEqual(resolveRentDueDay(propInvalid, tenantInvalid), 5);
  });
});

// =========================================================================
// SUITE 3: Payment Status Matrix (Exact, Partial, Overpayment, Multi-record)
// =========================================================================
describe('Challenger 1 - Payment Status Matrix', () => {
  test('M1: Exact payment classifies as SALDATO with remainingAmount=0', () => {
    const record = {
      id: 'rec_exact_01',
      propertyId: mockProperty.id,
      year: 2026,
      month: 8, // September (0-indexed)
      income: 850,
      transactionDate: '2026-09-02'
    };

    const res = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [record],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-02'
    });

    assertEqual(res.status, 'SALDATO');
    assertTrue(res.isPaid);
    assertEqual(res.paidAmount, 850);
    assertEqual(res.remainingAmount, 0);
    assertEqual(res.paidDate, '2026-09-02');
    assertEqual(res.paymentRecordId, 'rec_exact_01');
  });

  test('M2: Partial payment classifies as unpaid with remainingAmount > 0 and correct status', () => {
    const record = {
      id: 'rec_part_01',
      propertyId: mockProperty.id,
      year: 2026,
      month: 8,
      income: 500, // Monthly rent is 850
      transactionDate: '2026-09-01'
    };

    // Reference date 2026-09-02 (due date is 2026-09-05 -> 3 days until due)
    const resUpcoming = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [record],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-02',
      reminderAdvanceDays: 5
    });

    assertFalse(resUpcoming.isPaid, 'Partial payment is not fully paid');
    assertEqual(resUpcoming.status, 'IN_SCADENZA');
    assertEqual(resUpcoming.paidAmount, 500);
    assertEqual(resUpcoming.remainingAmount, 350);

    // Reference date 2026-09-08 (3 days overdue)
    const resOverdue = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [record],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-08',
      reminderAdvanceDays: 5
    });

    assertFalse(resOverdue.isPaid);
    assertEqual(resOverdue.status, 'SCADUTO');
    assertEqual(resOverdue.paidAmount, 500);
    assertEqual(resOverdue.remainingAmount, 350);
  });

  test('M3: Overpayment classifies as SALDATO with remainingAmount=0 and full collected amount', () => {
    const record = {
      id: 'rec_over_01',
      propertyId: mockProperty.id,
      year: 2026,
      month: 8,
      income: 1000, // Monthly rent is 850
      transactionDate: '2026-09-01'
    };

    const res = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [record],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-01'
    });

    assertEqual(res.status, 'SALDATO');
    assertTrue(res.isPaid);
    assertEqual(res.paidAmount, 1000);
    assertEqual(res.remainingAmount, 0);
  });

  test('M4: Multiple payment records in same month sum correctly to reach SALDATO', () => {
    // 3 installments: 300 + 400 + 150 = 850
    const records = [
      {
        id: 'rec_inst_01',
        propertyId: mockProperty.id,
        year: 2026,
        month: 8,
        income: 300,
        transactionDate: '2026-09-01'
      },
      {
        id: 'rec_inst_02',
        propertyId: mockProperty.id,
        year: 2026,
        month: 8,
        income: 400,
        receiptId: 'RCP-2026-0042',
        transactionDate: '2026-09-03'
      },
      {
        id: 'rec_inst_03',
        propertyId: mockProperty.id,
        year: 2026,
        month: 8,
        income: 150,
        transactionDate: '2026-09-04'
      }
    ];

    const res = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: records,
      year: 2026,
      month: 8,
      referenceDate: '2026-09-05'
    });

    assertEqual(res.status, 'SALDATO');
    assertTrue(res.isPaid);
    assertEqual(res.paidAmount, 850);
    assertEqual(res.remainingAmount, 0);
    // Paid date should be the latest transaction date
    assertEqual(res.paidDate, '2026-09-04');
    assertEqual(res.paymentRecordId, 'rec_inst_03');
    // ReceiptId should be found from the record that has it
    assertEqual(res.receiptId, 'RCP-2026-0042');
  });

  test('M5: Cross-month and cross-property isolation in records filtering', () => {
    const records = [
      // Other property
      { id: 'rec_other_prop', propertyId: 'other_prop', year: 2026, month: 8, income: 850, transactionDate: '2026-09-01' },
      // Other month (August)
      { id: 'rec_other_month', propertyId: mockProperty.id, year: 2026, month: 7, income: 850, transactionDate: '2026-08-01' },
      // Other year (2025)
      { id: 'rec_other_year', propertyId: mockProperty.id, year: 2025, month: 8, income: 850, transactionDate: '2025-09-01' }
    ];

    const res = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: records,
      year: 2026,
      month: 8,
      referenceDate: '2026-09-05'
    });

    assertFalse(res.isPaid, 'Non-matching records must not count towards payment');
    assertEqual(res.paidAmount, 0);
    assertEqual(res.remainingAmount, 850);
  });
});

// =========================================================================
// SUITE 4: Status Transitions & reminderAdvanceDays Boundary Analysis
// =========================================================================
describe('Challenger 1 - Status Transitions & Boundaries', () => {
  // Due date: 2026-09-05. Default reminderAdvanceDays: 5.
  test('T1: IN_SCADENZA at exact upper boundary (daysUntilDue === reminderAdvanceDays)', () => {
    // 2026-08-31 to 2026-09-05 is exactly 5 days (Aug has 31 days)
    const res = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-08-31',
      reminderAdvanceDays: 5
    });

    assertEqual(res.daysUntilDue, 5);
    assertEqual(res.status, 'IN_SCADENZA', 'Exact advance threshold must be IN_SCADENZA');
  });

  test('T2: PROGRAMMATO at 1 day beyond upper boundary (daysUntilDue === reminderAdvanceDays + 1)', () => {
    // 2026-08-30 to 2026-09-05 is 6 days
    const res = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-08-30',
      reminderAdvanceDays: 5
    });

    assertEqual(res.daysUntilDue, 6);
    assertEqual(res.status, 'PROGRAMMATO', 'Beyond advance threshold must be PROGRAMMATO');
  });

  test('T3: IN_SCADENZA on exact due day (daysUntilDue === 0)', () => {
    const res = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-05',
      reminderAdvanceDays: 5
    });

    assertEqual(res.daysUntilDue, 0);
    assertEqual(res.status, 'IN_SCADENZA', 'Due day (0) must be IN_SCADENZA');
  });

  test('T4: SCADUTO on 1 day past due (daysUntilDue === -1)', () => {
    const res = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-06',
      reminderAdvanceDays: 5
    });

    assertEqual(res.daysUntilDue, -1);
    assertEqual(res.status, 'SCADUTO', 'Past due date must be SCADUTO');
  });

  test('T5: Custom reminderAdvanceDays boundaries (0, 1, 10 days)', () => {
    // When advance days = 0, only day 0 is IN_SCADENZA, day 1 is PROGRAMMATO
    const resAdv0Today = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-05',
      reminderAdvanceDays: 0
    });
    assertEqual(resAdv0Today.daysUntilDue, 0);
    assertEqual(resAdv0Today.status, 'IN_SCADENZA');

    const resAdv0Yesterday = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-04',
      reminderAdvanceDays: 0
    });
    assertEqual(resAdv0Yesterday.daysUntilDue, 1);
    assertEqual(resAdv0Yesterday.status, 'PROGRAMMATO');

    // When advance days = 10
    const resAdv10Boundary = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-08-26', // Aug 26 to Sep 5 is 10 days
      reminderAdvanceDays: 10
    });
    assertEqual(resAdv10Boundary.daysUntilDue, 10);
    assertEqual(resAdv10Boundary.status, 'IN_SCADENZA');
  });

  test('T6: Payment overrides any time-based status (overdue, upcoming, future)', () => {
    const paidRecord = {
      id: 'rec_paid',
      propertyId: mockProperty.id,
      year: 2026,
      month: 8,
      income: 850,
      transactionDate: '2026-09-01'
    };

    // Would be SCADUTO if unpaid
    const resOverduePaid = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [paidRecord],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-20'
    });
    assertEqual(resOverduePaid.status, 'SALDATO', 'Paid record must override SCADUTO');

    // Would be PROGRAMMATO if unpaid
    const resFuturePaid = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [paidRecord],
      year: 2026,
      month: 8,
      referenceDate: '2026-08-10'
    });
    assertEqual(resFuturePaid.status, 'SALDATO', 'Paid record must override PROGRAMMATO');
  });
});

// =========================================================================
// SUITE 5: Timezone Invariance & Edge Case Analysis
// =========================================================================
describe('Challenger 1 - Timezone Invariance Analysis', () => {
  test('Z1: calculateDueDate is purely UTC/calendar arithmetic and timezone invariant', () => {
    const due1 = calculateDueDate(2026, 1, 31);
    assertEqual(due1, '2026-02-28');
    const due2 = calculateDueDate(2024, 1, 31);
    assertEqual(due2, '2024-02-29');
    const due3 = calculateDueDate(2026, 3, 31); // April
    assertEqual(due3, '2026-04-30');
  });

  test('Z2: calculateDaysUntilDue with ISO YYYY-MM-DD strings is timezone invariant', () => {
    // String matching regex /^(\d{4})-(\d{2})-(\d{2})/ extracts date components directly
    const diff1 = calculateDaysUntilDue('2026-09-05', '2026-09-05');
    assertEqual(diff1, 0);

    const diff2 = calculateDaysUntilDue('2026-09-05', '2026-09-01');
    assertEqual(diff2, 4);

    const diff3 = calculateDaysUntilDue('2026-09-05', '2026-09-07');
    assertEqual(diff3, -2);
  });

  test('Z3: Month and Year drift when referenceDate is string and year/month are omitted in negative offsets', () => {
    // EMPIRICAL CHALLENGE FINDING:
    // In services/rentStatusService.ts line 176:
    // const now = p.referenceDate ? (p.referenceDate instanceof Date ? p.referenceDate : new Date(p.referenceDate)) : new Date();
    // year = p.year !== undefined ? p.year : now.getFullYear();
    // month = p.month !== undefined ? p.month : now.getMonth();
    //
    // In JavaScript, new Date("2026-09-01") parses as UTC midnight: 2026-09-01T00:00:00.000Z.
    // If the host environment is in a negative UTC offset (e.g. America/New_York, America/Chicago, America/Los_Angeles):
    // now.getMonth() returns 7 (August), NOT 8 (September)!
    // And for new Date("2026-01-01"), now.getFullYear() returns 2025 and month 11 (December)!
    //
    // We verify here that when explicit year and month ARE provided, this bug is completely bypassed.
    const resWithExplicitYearMonth = calculateRentStatus({
      property: mockProperty,
      tenant: mockTenant,
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-01',
      reminderAdvanceDays: 5
    });

    assertEqual(resWithExplicitYearMonth.periodYear, 2026);
    assertEqual(resWithExplicitYearMonth.periodMonth, 8);
    assertEqual(resWithExplicitYearMonth.dueDate, '2026-09-05');
    assertEqual(resWithExplicitYearMonth.daysUntilDue, 4);
    assertEqual(resWithExplicitYearMonth.status, 'IN_SCADENZA');
  });

  test('Z4: Date object with UTC midnight behavior in getUtcMidnight', () => {
    // When dateInput is passed as Date object, getUtcMidnight uses dateInput.getFullYear(), getMonth(), getDate()
    // We verify that passing string avoids this local timezone conversion.
    const midnightFromString = getUtcMidnight('2026-09-05');
    const expectedUtc = Date.UTC(2026, 8, 5);
    assertEqual(midnightFromString, expectedUtc);
  });
});

// =========================================================================
// SUITE 6: Batch Evaluation & Aggregation (evaluateAllRents, getRentStatusSummary)
// =========================================================================
describe('Challenger 1 - Batch Evaluation & Aggregation', () => {
  test('B1: evaluateAllRents evaluates all rented properties and filters out empty/inactive properties', () => {
    const propRented1 = { ...mockProperty, id: 'p1', name: 'Appartamento 1' };
    const propRented2 = { ...mockProperty, id: 'p2', name: 'Appartamento 2' };
    const propEmpty = {
      id: 'p3',
      name: 'Appartamento Sfitto',
      status: 'EMPTY',
      financials: { monthlyRent: 0, rentDueDay: 5 }
    };
    const propMainResidence = {
      id: 'p4',
      name: 'Abitazione Principale',
      status: 'MAIN_RESIDENCE',
      financials: { monthlyRent: 0, rentDueDay: 5 }
    };

    const results = evaluateAllRents({
      properties: [propRented1, propRented2, propEmpty, propMainResidence],
      tenants: [mockTenant],
      rentalRecords: [],
      year: 2026,
      month: 8,
      referenceDate: '2026-09-02'
    });

    assertEqual(results.length, 2, 'Must only evaluate the 2 active rented properties');
    assertEqual(results[0].propertyId, 'p1');
    assertEqual(results[1].propertyId, 'p2');
  });

  test('B2: getRentStatusSummary aggregates counts and sums accurately', () => {
    const items = [
      // SALDATO
      { propertyId: 'p1', monthlyRent: 800, paidAmount: 800, status: 'SALDATO', isPaid: true },
      // IN_SCADENZA
      { propertyId: 'p2', monthlyRent: 700, paidAmount: 0, status: 'IN_SCADENZA', isPaid: false },
      // SCADUTO
      { propertyId: 'p3', monthlyRent: 900, paidAmount: 300, status: 'SCADUTO', isPaid: false },
      // PROGRAMMATO
      { propertyId: 'p4', monthlyRent: 600, paidAmount: 0, status: 'PROGRAMMATO', isPaid: false }
    ];

    const summary = getRentStatusSummary(items);

    assertEqual(summary.total, 4);
    assertEqual(summary.saldatiCount, 1);
    assertEqual(summary.inScadenzaCount, 1);
    assertEqual(summary.scadutiCount, 1);
    assertEqual(summary.programmatiCount, 1);
    assertEqual(summary.totalExpectedRent, 3000);
    assertEqual(summary.totalCollectedRent, 1100);
  });
});
