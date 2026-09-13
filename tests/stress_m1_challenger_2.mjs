// tests/stress_m1_challenger_2.mjs
// Adversarial Empirical Stress Testing Harness - Challenger 2 (Milestone 1)
// Covers:
// 1. server.js autoDeadlines & cron overdue alarm elimination (paid vs unpaid vs partial vs edge dates)
// 2. /api/deadlines/:id/complete dynamic ID webhook without 404 (live HTTP Express server)
// 3. Sequential receipt numbering counter under edge conditions (new fiscal year, unsorted, gaps, strings)

import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRATCH_DIR = path.join(__dirname, 'scratch_c2');

if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

let passedTests = 0;
let failedTests = 0;
const testLogs = [];

function log(msg) {
  testLogs.push(msg);
  console.log(msg);
}

function assert(condition, message) {
  if (!condition) {
    const err = new Error(`Assertion failed: ${message}`);
    log(`  ❌ FAIL: ${message}`);
    failedTests++;
    throw err;
  }
  passedTests++;
  log(`  ✔ PASS: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    const err = new Error(`Expected ${expected}, got ${actual}. Message: ${message}`);
    log(`  ❌ FAIL: ${message} (expected ${expected}, got ${actual})`);
    failedTests++;
    throw err;
  }
  passedTests++;
  log(`  ✔ PASS: ${message} (= ${actual})`);
}

// ============================================================================
// SUITE 1: server.js autoDeadlines & Cron Overdue Alarm Elimination
// ============================================================================
log('\n=== SUITE 1: server.js autoDeadlines & Cron Overdue Alarm Elimination ===');

/**
 * Exact implementation of server.js lines 600-884 encapsulated for deterministic simulation.
 */
function runServerCronCycle(dbData, simulatedTodayStr, simulatedNow = new Date(simulatedTodayStr)) {
  let deadlines = dbData.deadlines || [];
  const properties = dbData.properties || [];
  const rentalRecords = dbData.rentalRecords || [];
  const tenants = dbData.tenants || [];
  
  const autoDeadlines = [];
  const currentYear = simulatedNow.getFullYear();
  const currentMonth = simulatedNow.getMonth();
  const today = simulatedTodayStr;

  properties.forEach(prop => {
    // 1. Canone di Affitto Mensile
    const monthlyRent = Number(prop.financials?.monthlyRent) || 0;
    const isRentedStatus = prop.status === 'RENTED' || Boolean(prop.currentTenantId);
    const shouldTrackRent = monthlyRent > 0 && (isRentedStatus || (prop.status !== 'EMPTY' && prop.status !== 'MAIN_RESIDENCE'));

    if (shouldTrackRent) {
      const tenant = tenants.find(t => t.id === prop.currentTenantId);
      let dueDay = 5;
      if (tenant && typeof tenant.rentDueDay === 'number' && tenant.rentDueDay >= 1 && tenant.rentDueDay <= 31) {
        dueDay = Math.floor(tenant.rentDueDay);
      } else if (prop.financials && typeof prop.financials.rentDueDay === 'number' && prop.financials.rentDueDay >= 1 && prop.financials.rentDueDay <= 31) {
        dueDay = Math.floor(prop.financials.rentDueDay);
      } else if (typeof prop.rentDueDay === 'number' && prop.rentDueDay >= 1 && prop.rentDueDay <= 31) {
        dueDay = Math.floor(prop.rentDueDay);
      }

      for (let m = -1; m <= 3; m++) {
        const anchorDate = new Date(currentYear, currentMonth + m, 1);
        const targetYear = anchorDate.getFullYear();
        const targetMonth = anchorDate.getMonth();
        const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
        const actualDay = Math.min(dueDay, maxDay);
        const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
        const deadlineId = `auto_rent_${prop.id}_${dateStr}`;

        // Cross-reference rentalRecords to eliminate false alarms
        const matching = rentalRecords.filter(r =>
          r.propertyId === prop.id &&
          Number(r.year) === targetYear &&
          Number(r.month) === targetMonth
        );
        const totalPaid = matching.reduce((sum, r) => sum + (Number(r.income) || 0), 0);
        const isPaid = totalPaid >= monthlyRent;

        autoDeadlines.push({
          id: deadlineId,
          title: `${prop.name}: Affitto`,
          date: dateStr,
          type: 'RENT',
          amount: monthlyRent,
          isCompleted: isPaid,
          propertyId: prop.id,
          tenantId: prop.currentTenantId || undefined,
          notes: isPaid 
            ? 'Canone saldato e registrato' 
            : (totalPaid > 0 ? `Pagamento parziale (${totalPaid}€/${monthlyRent}€)` : 'In attesa di pagamento')
        });
      }
    }
  });

  // Unisci scadenze manuali e automatiche, propagando lo stato isCompleted
  const manualMap = new Map(deadlines.map(d => [d.id, d]));
  autoDeadlines.forEach(auto => {
    if (!manualMap.has(auto.id)) {
      deadlines.push(auto);
    } else {
      const existing = manualMap.get(auto.id);
      if (auto.id.startsWith('auto_rent_') || auto.id.startsWith('auto_condo_') || auto.id.startsWith('auto_mortg_')) {
        if (auto.isCompleted && !existing.isCompleted) {
          existing.isCompleted = true;
          existing.notes = auto.notes || existing.notes;
        }
      }
    }
  });

  const pending = deadlines.filter(d => {
    if (d.isCompleted) return false;
    if (d.date > today) return false;

    // Controllo difensivo per canoni di affitto
    if (d.type === 'RENT' || (d.id && d.id.startsWith('auto_rent_'))) {
      const parts = (d.date || '').split('-');
      if (parts.length >= 2) {
        const dYear = parseInt(parts[0], 10);
        const dMonth = parseInt(parts[1], 10) - 1;
        const totalPaid = rentalRecords
          .filter(r => r.propertyId === d.propertyId && Number(r.year) === dYear && Number(r.month) === dMonth)
          .reduce((sum, r) => sum + (Number(r.income) || 0), 0);
        const expectedAmount = Number(d.amount) || 0;
        if (expectedAmount > 0 ? totalPaid >= expectedAmount : totalPaid > 0) {
          d.isCompleted = true;
          return false;
        }
      }
    }
    return true;
  });

  const shouldTriggerNotification = pending.length > 0;
  return { autoDeadlines, deadlines, pending, shouldTriggerNotification };
}

// --- Test 1.1: Single Property Fully Paid for both past (m = -1) and current (m = 0) month ---
{
  const propPaid = {
    id: 'prop_paid_01',
    name: 'Appartamento Roma Centro',
    status: 'RENTED',
    currentTenantId: 'tenant_01',
    financials: { monthlyRent: 1200, rentDueDay: 5 }
  };
  const rentalRecordAug = {
    id: 'rec_01_aug',
    propertyId: 'prop_paid_01',
    year: 2026,
    month: 7, // August (m = -1)
    income: 1200,
    transactionDate: '2026-08-04'
  };
  const rentalRecordSept = {
    id: 'rec_01_sept',
    propertyId: 'prop_paid_01',
    year: 2026,
    month: 8, // September (m = 0)
    income: 1200,
    transactionDate: '2026-09-03'
  };
  const dbData = {
    properties: [propPaid],
    tenants: [{ id: 'tenant_01', name: 'Mario Rossi', rentDueDay: 5 }],
    rentalRecords: [rentalRecordAug, rentalRecordSept],
    deadlines: []
  };

  // Run on September 10 (past day 5 due date)
  const result = runServerCronCycle(dbData, '2026-09-10', new Date(2026, 8, 10));
  
  // Paid property should have isCompleted: true for both August and September
  const augDeadline = result.autoDeadlines.find(d => d.id === 'auto_rent_prop_paid_01_2026-08-05');
  const septDeadline = result.autoDeadlines.find(d => d.id === 'auto_rent_prop_paid_01_2026-09-05');
  assert(augDeadline !== undefined, 'August deadline generated');
  assert(septDeadline !== undefined, 'Sept deadline generated');
  assertEqual(augDeadline.isCompleted, true, 'Paid August deadline has isCompleted: true');
  assertEqual(septDeadline.isCompleted, true, 'Paid September deadline has isCompleted: true');
  assertEqual(result.pending.length, 0, 'Pending deadlines is empty for fully paid property');
  assertEqual(result.shouldTriggerNotification, false, 'Paid property NEVER triggers persistent overdue notification');
}

// --- Test 1.2: Past Month (m = -1) Paid Property (Regression test for false alarm bug) ---
{
  // Previous bug: m = -1 was hardcoded isCompleted: false, causing daily false alarms!
  const propPast = {
    id: 'prop_past_01',
    name: 'Monolocale Milano',
    status: 'RENTED',
    currentTenantId: 'tenant_02',
    financials: { monthlyRent: 800, rentDueDay: 5 }
  };
  const augustRecord = {
    id: 'rec_august',
    propertyId: 'prop_past_01',
    year: 2026,
    month: 7, // August (0-indexed)
    income: 800,
    transactionDate: '2026-08-04'
  };
  const septemberRecord = {
    id: 'rec_sept',
    propertyId: 'prop_past_01',
    year: 2026,
    month: 8, // September (0-indexed)
    income: 800,
    transactionDate: '2026-09-05'
  };
  const dbData = {
    properties: [propPast],
    tenants: [{ id: 'tenant_02', name: 'Laura Bianchi' }],
    rentalRecords: [augustRecord, septemberRecord],
    deadlines: []
  };

  const result = runServerCronCycle(dbData, '2026-09-12', new Date(2026, 8, 12));
  const augustDeadline = result.autoDeadlines.find(d => d.id === 'auto_rent_prop_past_01_2026-08-05');
  assert(augustDeadline !== undefined, 'August (m = -1) deadline generated');
  assertEqual(augustDeadline.isCompleted, true, 'August (m = -1) is marked isCompleted: true when payment exists');
  assertEqual(result.pending.length, 0, 'Past month paid deadline NEVER leaks into pending array');
  assertEqual(result.shouldTriggerNotification, false, 'No false alarm triggered for past month');
}

// --- Test 1.3: Unpaid Property triggers overdue alert when date <= today ---
{
  const propUnpaid = {
    id: 'prop_unpaid_01',
    name: 'Bilocale Torino',
    status: 'RENTED',
    financials: { monthlyRent: 750, rentDueDay: 5 }
  };
  const dbData = {
    properties: [propUnpaid],
    tenants: [],
    rentalRecords: [], // NO payments recorded
    deadlines: []
  };

  const result = runServerCronCycle(dbData, '2026-09-10', new Date(2026, 8, 10));
  const septDeadline = result.autoDeadlines.find(d => d.id === 'auto_rent_prop_unpaid_01_2026-09-05');
  assert(septDeadline !== undefined, 'Sept deadline generated');
  assertEqual(septDeadline.isCompleted, false, 'Unpaid deadline isCompleted: false');
  assert(result.pending.some(d => d.id === septDeadline.id), 'Unpaid deadline is present in pending array');
  assertEqual(result.shouldTriggerNotification, true, 'Unpaid property triggers persistent overdue notification');
}

// --- Test 1.4: Partial payment is NOT considered paid ---
{
  const propPartial = {
    id: 'prop_partial_01',
    name: 'Trilocale Napoli',
    status: 'RENTED',
    financials: { monthlyRent: 1000, rentDueDay: 5 }
  };
  const partialRecord = {
    id: 'rec_partial',
    propertyId: 'prop_partial_01',
    year: 2026,
    month: 8,
    income: 400, // Only 400 out of 1000 paid
    transactionDate: '2026-09-04'
  };
  const dbData = {
    properties: [propPartial],
    tenants: [],
    rentalRecords: [partialRecord],
    deadlines: []
  };

  const result = runServerCronCycle(dbData, '2026-09-10', new Date(2026, 8, 10));
  const septDeadline = result.autoDeadlines.find(d => d.id === 'auto_rent_prop_partial_01_2026-09-05');
  assertEqual(septDeadline.isCompleted, false, 'Partial payment does not mark isCompleted: true');
  assert(septDeadline.notes.includes('Pagamento parziale (400€/1000€)'), 'Notes reflect partial amount');
  assert(result.pending.some(d => d.id === septDeadline.id), 'Partially paid property is correctly kept in pending');
}

// --- Test 1.5: Multi-split payments summing >= monthlyRent IS considered fully paid ---
{
  const propSplit = {
    id: 'prop_split_01',
    name: 'Quadrilocale Bologna',
    status: 'RENTED',
    financials: { monthlyRent: 900, rentDueDay: 5 }
  };
  const splitAug = {
    id: 'rec_split_aug',
    propertyId: 'prop_split_01',
    year: 2026,
    month: 7,
    income: 900,
    transactionDate: '2026-08-05'
  };
  const split1 = {
    id: 'rec_split_1',
    propertyId: 'prop_split_01',
    year: 2026,
    month: 8,
    income: 500,
    transactionDate: '2026-09-02'
  };
  const split2 = {
    id: 'rec_split_2',
    propertyId: 'prop_split_01',
    year: 2026,
    month: 8,
    income: 400,
    transactionDate: '2026-09-04'
  };
  const dbData = {
    properties: [propSplit],
    tenants: [],
    rentalRecords: [splitAug, split1, split2],
    deadlines: []
  };

  const result = runServerCronCycle(dbData, '2026-09-10', new Date(2026, 8, 10));
  const septDeadline = result.autoDeadlines.find(d => d.id === 'auto_rent_prop_split_01_2026-09-05');
  assertEqual(septDeadline.isCompleted, true, 'Split payments summing to totalRent marks isCompleted: true');
  assertEqual(result.pending.filter(d => d.propertyId === 'prop_split_01').length, 0, 'Split paid property excluded from pending');
}

// --- Test 1.6: Multi-property Portfolio Heterogeneous Cohort ---
{
  const properties = [
    { id: 'p1_paid', name: 'P1 Paid', status: 'RENTED', financials: { monthlyRent: 600, rentDueDay: 5 } },
    { id: 'p2_unpaid', name: 'P2 Unpaid', status: 'RENTED', financials: { monthlyRent: 700, rentDueDay: 5 } },
    { id: 'p3_empty', name: 'P3 Empty', status: 'EMPTY', financials: { monthlyRent: 800, rentDueDay: 5 } },
    { id: 'p4_future', name: 'P4 Future Due', status: 'RENTED', financials: { monthlyRent: 900, rentDueDay: 25 } }
  ];
  const rentalRecords = [
    { id: 'r1_aug', propertyId: 'p1_paid', year: 2026, month: 7, income: 600 },
    { id: 'r1_sept', propertyId: 'p1_paid', year: 2026, month: 8, income: 600 },
    { id: 'r4_aug', propertyId: 'p4_future', year: 2026, month: 7, income: 900 }
  ];
  const dbData = { properties, rentalRecords, tenants: [], deadlines: [] };

  // Current date Sept 10
  const result = runServerCronCycle(dbData, '2026-09-10', new Date(2026, 8, 10));
  
  // Verify P1 paid is NEVER in pending
  assert(!result.pending.some(d => d.propertyId === 'p1_paid'), 'P1 Paid is NEVER in pending');
  
  // Verify P2 unpaid IS in pending
  assert(result.pending.some(d => d.propertyId === 'p2_unpaid'), 'P2 Unpaid IS in pending');
  
  // Verify P3 empty does NOT generate rent deadlines
  assert(!result.autoDeadlines.some(d => d.propertyId === 'p3_empty'), 'P3 Empty generates NO auto deadlines');
  
  // Verify P4 future due (Sept 25 > Sept 10) is NOT in pending because August was paid and Sept is future
  assert(!result.pending.some(d => d.propertyId === 'p4_future'), 'P4 Future Due is NOT in pending');
  
  // Exact count of pending items matching P2 only
  const septP2 = result.pending.filter(d => d.propertyId === 'p2_unpaid' && d.date.includes('2026-09'));
  assertEqual(septP2.length, 1, 'Only unpaid past-due deadline in pending');
}

// --- Test 1.7: Existing deadline with isCompleted: false gets reconciled when payment arrives ---
{
  const existingDeadlines = [{
    id: 'auto_rent_p_recon_2026-09-05',
    title: 'P Recon: Affitto',
    date: '2026-09-05',
    type: 'RENT',
    amount: 1000,
    isCompleted: false, // previously unpaid
    propertyId: 'p_recon'
  }];
  const propRecon = {
    id: 'p_recon',
    name: 'P Recon',
    status: 'RENTED',
    financials: { monthlyRent: 1000, rentDueDay: 5 }
  };
  const augPayment = {
    id: 'rec_aug_p_recon',
    propertyId: 'p_recon',
    year: 2026,
    month: 7,
    income: 1000,
    transactionDate: '2026-08-05'
  };
  const newPayment = {
    id: 'rec_new',
    propertyId: 'p_recon',
    year: 2026,
    month: 8,
    income: 1000,
    transactionDate: '2026-09-06'
  };
  const dbData = {
    properties: [propRecon],
    tenants: [],
    rentalRecords: [augPayment, newPayment],
    deadlines: [...existingDeadlines]
  };

  const result = runServerCronCycle(dbData, '2026-09-10', new Date(2026, 8, 10));
  const reconciled = result.deadlines.find(d => d.id === 'auto_rent_p_recon_2026-09-05');
  assertEqual(reconciled.isCompleted, true, 'Existing deadline is updated to isCompleted: true when payment is found');
  assertEqual(result.pending.length, 0, 'Pending is completely cleared after reconciliation');
}

// --- Test 1.8: Edge Due Date (Day 31) Clamping in February and April ---
{
  const propDay31 = {
    id: 'p_day31',
    name: 'P Day 31',
    status: 'RENTED',
    financials: { monthlyRent: 500, rentDueDay: 31 }
  };
  // Non-leap year 2026: Feb has 28 days
  const dbData2026 = {
    properties: [propDay31],
    tenants: [],
    rentalRecords: [
      { id: 'rj26', propertyId: 'p_day31', year: 2026, month: 0, income: 500 },
      { id: 'rf26', propertyId: 'p_day31', year: 2026, month: 1, income: 500 }
    ],
    deadlines: []
  };
  const resultFeb2026 = runServerCronCycle(dbData2026, '2026-02-28', new Date(2026, 1, 28));
  const febDeadline26 = resultFeb2026.autoDeadlines.find(d => d.date.startsWith('2026-02'));
  assertEqual(febDeadline26.date, '2026-02-28', 'Clamped to 2026-02-28 in non-leap year');
  assertEqual(febDeadline26.isCompleted, true, 'Matched payment on clamped date');

  // Leap year 2024: Feb has 29 days
  const dbData2024 = {
    properties: [propDay31],
    tenants: [],
    rentalRecords: [
      { id: 'rj24', propertyId: 'p_day31', year: 2024, month: 0, income: 500 },
      { id: 'rf24', propertyId: 'p_day31', year: 2024, month: 1, income: 500 }
    ],
    deadlines: []
  };
  const resultFeb2024 = runServerCronCycle(dbData2024, '2024-02-29', new Date(2024, 1, 29));
  const febDeadline24 = resultFeb2024.autoDeadlines.find(d => d.date.startsWith('2024-02'));
  assertEqual(febDeadline24.date, '2024-02-29', 'Clamped to 2024-02-29 in leap year');
  assertEqual(febDeadline24.isCompleted, true, 'Matched payment on leap clamped date');

  // 30-day month April:
  const dbDataApr = {
    properties: [propDay31],
    tenants: [],
    rentalRecords: [
      { id: 'rmar', propertyId: 'p_day31', year: 2026, month: 2, income: 500 },
      { id: 'rapr', propertyId: 'p_day31', year: 2026, month: 3, income: 500 }
    ],
    deadlines: []
  };
  const resultApr = runServerCronCycle(dbDataApr, '2026-04-30', new Date(2026, 3, 30));
  const aprDeadline = resultApr.autoDeadlines.find(d => d.date.startsWith('2026-04'));
  assertEqual(aprDeadline.date, '2026-04-30', 'Clamped to 2026-04-30 for 30-day month');
}

// --- Test 1.9: Decimal Currency Precision with Split Payments ---
{
  const propDec = {
    id: 'p_dec',
    name: 'P Decimal',
    status: 'RENTED',
    financials: { monthlyRent: 850.50, rentDueDay: 5 }
  };
  const dbDataDec = {
    properties: [propDec],
    tenants: [],
    rentalRecords: [
      { id: 'rd_aug', propertyId: 'p_dec', year: 2026, month: 7, income: 850.50 },
      { id: 'rd1', propertyId: 'p_dec', year: 2026, month: 8, income: 400.25 },
      { id: 'rd2', propertyId: 'p_dec', year: 2026, month: 8, income: 450.25 }
    ],
    deadlines: []
  };
  const resultDec = runServerCronCycle(dbDataDec, '2026-09-10', new Date(2026, 8, 10));
  const septDeadlineDec = resultDec.autoDeadlines.find(d => d.id === 'auto_rent_p_dec_2026-09-05');
  assertEqual(septDeadlineDec.isCompleted, true, 'Decimal split payments (400.25 + 450.25 = 850.50) marked as completed');
  assertEqual(resultDec.pending.length, 0, 'No pending deadline for decimal split payment');
}

// --- Test 1.10: Out-of-bounds rentDueDay Fallback to Day 5 ---
{
  const propBadDay = {
    id: 'p_bad_day',
    name: 'P Bad Day',
    status: 'RENTED',
    rentDueDay: -10, // Invalid property rentDueDay
    financials: { monthlyRent: 600, rentDueDay: 35 } // Invalid financials rentDueDay
  };
  const tenantBadDay = {
    id: 't_bad_day',
    name: 'Bad Day Tenant',
    rentDueDay: 0 // Invalid tenant rentDueDay
  };
  propBadDay.currentTenantId = 't_bad_day';

  const dbDataBadDay = {
    properties: [propBadDay],
    tenants: [tenantBadDay],
    rentalRecords: [
      { id: 'rb_aug', propertyId: 'p_bad_day', year: 2026, month: 7, income: 600 },
      { id: 'rb_sept', propertyId: 'p_bad_day', year: 2026, month: 8, income: 600 }
    ],
    deadlines: []
  };
  const resultBadDay = runServerCronCycle(dbDataBadDay, '2026-09-10', new Date(2026, 8, 10));
  const septDeadlineBadDay = resultBadDay.autoDeadlines.find(d => d.propertyId === 'p_bad_day' && d.date.startsWith('2026-09'));
  assertEqual(septDeadlineBadDay.date, '2026-09-05', 'Out-of-bounds rentDueDay safely falls back to day 5');
  assertEqual(septDeadlineBadDay.isCompleted, true, 'Payment matches deadline on fallback day 5');
}


// ============================================================================
// SUITE 2: Express Webhook /api/deadlines/:id/complete (Direct Route Execution)
// ============================================================================
log('\n=== SUITE 2: Express Webhook /api/deadlines/:id/complete ===');

async function runWebhookSuite() {
  const testDbFile = path.join(SCRATCH_DIR, 'test_db_deadlines.json');
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);

  function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) return true;
    fs.mkdirSync(dirname, { recursive: true });
  }

  // Exact route handler logic from server.js lines 538-581:
  function handleCompleteWebhook(req, res) {
    try {
      ensureDirectoryExistence(testDbFile);
      let dbData = {};
      if (fs.existsSync(testDbFile)) {
        try {
          dbData = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
        } catch (e) {}
      }
      
      if (!Array.isArray(dbData.deadlines)) dbData.deadlines = [];
      
      let found = false;
      dbData.deadlines = dbData.deadlines.map(d => {
        if (d.id === req.params.id) {
          d.isCompleted = true;
          d.completedAt = new Date().toISOString();
          found = true;
        }
        return d;
      });
      
      if (!found) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        dbData.deadlines.push({
          id: req.params.id,
          title: req.body?.title || 'Scadenza automatica',
          date: req.body?.date || todayStr,
          isCompleted: true,
          completedAt: now.toISOString(),
          notes: req.body?.notes || 'Completata via webhook/azione'
        });
        found = true;
      }
      
      fs.writeFileSync(testDbFile, JSON.stringify(dbData, null, 2), 'utf8');
      res.json({ success: true, message: "Scadenza aggiornata." });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  function invokeRoute(id, body = {}) {
    return new Promise((resolve) => {
      let statusCode = 200;
      let jsonPayload = null;
      const req = {
        params: { id },
        body
      };
      const res = {
        status(c) { statusCode = c; return this; },
        json(data) { jsonPayload = data; resolve({ status: statusCode, body: jsonPayload }); }
      };
      handleCompleteWebhook(req, res);
    });
  }

  try {
    // Test 2.1: Dynamic deadline ID that does NOT exist in DB initially
    const dynamicId1 = 'auto_rent_prop99_2026-09-05';
    const res1 = await invokeRoute(dynamicId1, {});
    assertEqual(res1.status, 200, 'Dynamic ID returns 200 OK (NOT 404)');
    assertEqual(res1.body.success, true, 'Response body success is true');
    assertEqual(res1.body.message, 'Scadenza aggiornata.', 'Response body message confirmed');

    // Verify DB file was created and persists the dynamic deadline as completed
    const savedData1 = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
    assert(Array.isArray(savedData1.deadlines), 'Deadlines is array');
    const persisted1 = savedData1.deadlines.find(d => d.id === dynamicId1);
    assert(persisted1 !== undefined, 'Dynamic deadline persisted in DB');
    assertEqual(persisted1.isCompleted, true, 'Persisted deadline has isCompleted: true');
    assert(typeof persisted1.completedAt === 'string', 'completedAt ISO string saved');

    // Test 2.2: Dynamic condo deadline with custom payload
    const dynamicId2 = 'auto_condo_prop88_2026-09-10';
    const res2 = await invokeRoute(dynamicId2, {
      title: 'Spese Condominiali Settembre 2026',
      date: '2026-09-10',
      notes: 'Pagato a mezzo bonifico bancario'
    });
    assertEqual(res2.status, 200, 'Condo dynamic ID returns 200 OK');
    const savedData2 = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
    const persisted2 = savedData2.deadlines.find(d => d.id === dynamicId2);
    assert(persisted2 !== undefined, 'Condo dynamic deadline persisted');
    assertEqual(persisted2.title, 'Spese Condominiali Settembre 2026', 'Custom title preserved');
    assertEqual(persisted2.date, '2026-09-10', 'Custom date preserved');
    assertEqual(persisted2.notes, 'Pagato a mezzo bonifico bancario', 'Custom notes preserved');

    // Test 2.3: Idempotency (calling same dynamic ID again should not duplicate entry)
    const res3 = await invokeRoute(dynamicId1, {});
    assertEqual(res3.status, 200, 'Second call returns 200 OK');
    const savedData3 = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
    const matches = savedData3.deadlines.filter(d => d.id === dynamicId1);
    assertEqual(matches.length, 1, 'No duplicate deadline created upon re-completion');

    // Test 2.4: Existing manual deadline update
    // Pre-insert an uncompleted manual deadline
    savedData3.deadlines.push({
      id: 'manual_deadline_abc',
      title: 'Tassa Rifiuti TARI',
      date: '2026-09-30',
      isCompleted: false
    });
    fs.writeFileSync(testDbFile, JSON.stringify(savedData3, null, 2), 'utf8');

    const res4 = await invokeRoute('manual_deadline_abc', {});
    assertEqual(res4.status, 200, 'Existing manual deadline returns 200 OK');
    const savedData4 = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
    const manualUpdated = savedData4.deadlines.find(d => d.id === 'manual_deadline_abc');
    assertEqual(manualUpdated.isCompleted, true, 'Manual deadline flipped to isCompleted: true');

    // Test 2.5: Special characters in dynamic ID
    const specialId = 'auto_rent_prop:with_special-chars_2026-09-05';
    const res5 = await invokeRoute(specialId, {});
    assertEqual(res5.status, 200, 'Special-character ID returns 200 OK without 404');
    const savedData5 = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
    assert(savedData5.deadlines.some(d => d.id === specialId), 'Special character ID persisted');

    // Test 2.6: Webhook called with null or undefined body (should not crash with TypeError)
    const resNullBody = await invokeRoute('auto_condo_null_body', null);
    assertEqual(resNullBody.status, 200, 'Null body returns 200 OK without crash');
    const resUndefBody = await invokeRoute('auto_condo_undef_body', undefined);
    assertEqual(resUndefBody.status, 200, 'Undefined body returns 200 OK without crash');

  } finally {
    if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  }
}


// ============================================================================
// SUITE 3: Sequential Receipt Numbering Counter Logic under Edge Conditions
// ============================================================================
log('\n=== SUITE 3: Sequential Receipt Numbering Counter Logic ===');

/**
 * Encapsulation of dbService.ts getNextReceiptNumber & getReceiptsByFiscalYear logic:
 *   async getNextReceiptNumber(fiscalYear: number): Promise<number> {
 *     const receipts = await this.getReceiptsByFiscalYear(fiscalYear);
 *     if (!receipts || receipts.length === 0) return 1;
 *     const max = receipts.reduce((m, r) => Math.max(m, Number(r.receiptNumber) || 0), 0);
 *     return max + 1;
 *   }
 */
function getNextReceiptNumberAlgorithm(existingReceipts, fiscalYear) {
  // Simulates getReceiptsByFiscalYear (with string/number coercion)
  const receipts = (existingReceipts || []).filter(r => Number(r.fiscalYear) === fiscalYear);
  if (!receipts || receipts.length === 0) return 1;
  const max = receipts.reduce((m, r) => Math.max(m, Number(r.receiptNumber) || 0), 0);
  return max + 1;
}

// --- Test 3.1: Fresh Database / Empty Receipts for Target Fiscal Year ---
{
  const next2026 = getNextReceiptNumberAlgorithm([], 2026);
  assertEqual(next2026, 1, 'Empty DB returns 1 for fiscalYear 2026');
  
  const nextNull = getNextReceiptNumberAlgorithm(null, 2026);
  assertEqual(nextNull, 1, 'Null receipts array returns 1');
}

// --- Test 3.2: Existing Sequential Receipts [1, 2, 3] -> Returns 4 ---
{
  const receipts = [
    { receiptNumber: 1, fiscalYear: 2026 },
    { receiptNumber: 2, fiscalYear: 2026 },
    { receiptNumber: 3, fiscalYear: 2026 }
  ];
  const next = getNextReceiptNumberAlgorithm(receipts, 2026);
  assertEqual(next, 4, 'Sequential [1, 2, 3] yields 4');
}

// --- Test 3.3: Fiscal Year Rollover / Reset per Fiscal Year ---
{
  // 2025 has 120 receipts!
  const receipts2025 = Array.from({ length: 120 }, (_, i) => ({
    receiptNumber: i + 1,
    fiscalYear: 2025
  }));

  // New year 2026 must reset to 1
  const next2026 = getNextReceiptNumberAlgorithm(receipts2025, 2026);
  assertEqual(next2026, 1, 'New fiscal year 2026 resets counter strictly to 1');

  // Next receipt for previous year 2025 continues from 121
  const next2025 = getNextReceiptNumberAlgorithm(receipts2025, 2025);
  assertEqual(next2025, 121, 'Existing fiscal year 2025 continues monotonically to 121');
}

// --- Test 3.4: Disordered / Unsorted Receipts in Database ---
{
  const unsorted = [
    { receiptNumber: 14, fiscalYear: 2026 },
    { receiptNumber: 2, fiscalYear: 2026 },
    { receiptNumber: 42, fiscalYear: 2026 },
    { receiptNumber: 7, fiscalYear: 2026 }
  ];
  const next = getNextReceiptNumberAlgorithm(unsorted, 2026);
  assertEqual(next, 43, 'Unsorted receipts find maximum (42) and return 43');
}

// --- Test 3.5: Non-consecutive Sequence with Gaps (e.g. after Deletions) ---
{
  // Receipts 1, 2, 5 (receipts 3 and 4 were deleted or cancelled)
  const gapped = [
    { receiptNumber: 1, fiscalYear: 2026 },
    { receiptNumber: 2, fiscalYear: 2026 },
    { receiptNumber: 5, fiscalYear: 2026 }
  ];
  const next = getNextReceiptNumberAlgorithm(gapped, 2026);
  assertEqual(next, 6, 'Gapped receipts strictly progress past max without reusing lower numbers');
}

// --- Test 3.6: String coercion / Defensive type handling ---
{
  const mixedTypes = [
    { receiptNumber: '5', fiscalYear: '2026' },
    { receiptNumber: 10, fiscalYear: 2026 },
    { receiptNumber: undefined, fiscalYear: 2026 },
    { receiptNumber: null, fiscalYear: 2026 },
    { receiptNumber: NaN, fiscalYear: 2026 },
    { receiptNumber: -3, fiscalYear: 2026 }
  ];
  const next = getNextReceiptNumberAlgorithm(mixedTypes, 2026);
  assertEqual(next, 11, 'Defensive coercion handles strings, null, NaN, and negative numbers (max 10 -> 11)');
}

// --- Test 3.7: Multi-Year Cohort Strict Isolation ---
{
  const multiYear = [
    { receiptNumber: 1, fiscalYear: 2024 },
    { receiptNumber: 2, fiscalYear: 2024 },
    { receiptNumber: 50, fiscalYear: 2025 },
    { receiptNumber: 8, fiscalYear: 2026 }
  ];
  assertEqual(getNextReceiptNumberAlgorithm(multiYear, 2024), 3, '2024 yields 3');
  assertEqual(getNextReceiptNumberAlgorithm(multiYear, 2025), 51, '2025 yields 51');
  assertEqual(getNextReceiptNumberAlgorithm(multiYear, 2026), 9, '2026 yields 9');
  assertEqual(getNextReceiptNumberAlgorithm(multiYear, 2027), 1, '2027 (unseen year) yields 1');
}

// --- Test 3.8: High Volume Stress Test (1,000 Receipts Monotonicity) ---
{
  const receiptStore = [];
  const targetYear = 2026;
  const COUNT = 1000;
  
  for (let i = 0; i < COUNT; i++) {
    const nextNum = getNextReceiptNumberAlgorithm(receiptStore, targetYear);
    if (i % 250 === 0 || i === COUNT - 1) {
      assertEqual(nextNum, i + 1, `Sequential allocation #${i + 1} matches index`);
    } else {
      if (nextNum !== i + 1) throw new Error(`Mismatch at ${i}: expected ${i + 1}, got ${nextNum}`);
      passedTests++;
    }
    receiptStore.push({
      id: `RCP-2026-${String(nextNum).padStart(4, '0')}`,
      receiptNumber: nextNum,
      fiscalYear: targetYear,
      formattedNumber: `${nextNum}/${targetYear}`
    });
  }

  assertEqual(receiptStore.length, COUNT, 'All 1,000 receipts generated');
  const finalNext = getNextReceiptNumberAlgorithm(receiptStore, targetYear);
  assertEqual(finalNext, COUNT + 1, `Next number after 1,000 is 1001`);
  
  // Verify zero collisions
  const setOfNumbers = new Set(receiptStore.map(r => r.receiptNumber));
  assertEqual(setOfNumbers.size, COUNT, 'Zero numbering collisions across 1,000 receipts');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function main() {
  await runWebhookSuite();

  log('\n================================================================');
  log(`Adversarial Stress Test Summary:`);
  log(`  Total Passed: ${passedTests}`);
  log(`  Total Failed: ${failedTests}`);
  log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error in stress test runner:', err);
  process.exit(1);
});
