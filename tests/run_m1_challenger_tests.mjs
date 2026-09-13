// tests/run_m1_challenger_tests.mjs
// Master Runner for Challenger 1 - Milestone 1

import { globalContext } from './e2e/harness/test_framework.mjs';
import './m1_challenger_rent_status.test.mjs';
import { spawnSync } from 'child_process';

async function runTimezoneMatrix() {
  console.log('\n\x1b[1m\x1b[35m════════════════════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m\x1b[35m         Multi-Timezone Empirical Invariance Matrix (Cross-Process)         \x1b[0m');
  console.log('\x1b[1m\x1b[35m════════════════════════════════════════════════════════════════════════════\x1b[0m\n');

  const timezones = [
    { name: 'America/New_York', offset: 'UTC-4 (EDT)' },
    { name: 'America/Los_Angeles', offset: 'UTC-7 (PDT)' },
    { name: 'UTC', offset: 'UTC+0' },
    { name: 'Europe/Rome', offset: 'UTC+2 (CEST)' },
    { name: 'Asia/Tokyo', offset: 'UTC+9 (JST)' },
    { name: 'Pacific/Auckland', offset: 'UTC+12 (NZST)' }
  ];

  let matrixPassed = 0;
  let matrixFailed = 0;

  for (const tz of timezones) {
    const testCode = `
      import { calculateDueDate, calculateDaysUntilDue, calculateRentStatus } from './tests/rentStatusService.bundled.mjs';
      const prop = { id: 'p1', name: 'Test', financials: { monthlyRent: 1000, rentDueDay: 5 } };
      
      // Test 1: calculateDueDate across leap year
      const dueFebLeap = calculateDueDate(2024, 1, 31);
      const dueFebCommon = calculateDueDate(2026, 1, 31);
      if (dueFebLeap !== '2024-02-29' || dueFebCommon !== '2026-02-28') {
        process.exit(1);
      }

      // Test 2: calculateDaysUntilDue with date strings
      const diff1 = calculateDaysUntilDue('2026-09-05', '2026-09-05');
      const diff2 = calculateDaysUntilDue('2026-09-05', '2026-08-31');
      if (diff1 !== 0 || diff2 !== 5) {
        process.exit(2);
      }

      // Test 3: calculateRentStatus with explicit year and month
      const statusRes = calculateRentStatus({
        property: prop,
        rentalRecords: [],
        year: 2026,
        month: 8,
        referenceDate: '2026-09-01',
        reminderAdvanceDays: 5
      });
      if (statusRes.status !== 'IN_SCADENZA' || statusRes.daysUntilDue !== 4 || statusRes.dueDate !== '2026-09-05') {
        process.exit(3);
      }

      process.exit(0);
    `;

    const res = spawnSync(process.execPath, ['--input-type=module', '-e', testCode], {
      env: { ...process.env, TZ: tz.name }
    });

    if (res.status === 0) {
      console.log(`  \x1b[32m✔\x1b[0m Timezone [${tz.name.padEnd(20)}] (${tz.offset}): All core invariant assertions passed`);
      matrixPassed++;
    } else {
      console.log(`  \x1b[31m✖\x1b[0m Timezone [${tz.name.padEnd(20)}] (${tz.offset}): Failed with exit code ${res.status}`);
      if (res.stderr) console.log(`    ${res.stderr.toString()}`);
      matrixFailed++;
    }
  }

  console.log(`\nTimezone Matrix Summary: ${matrixPassed} passed, ${matrixFailed} failed\n`);
  return matrixFailed === 0;
}

async function main() {
  const bundleRes = spawnSync('./node_modules/.bin/esbuild', [
    'services/rentStatusService.ts',
    '--bundle',
    '--format=esm',
    '--outfile=tests/rentStatusService.bundled.mjs'
  ]);
  if (bundleRes.status !== 0) {
    console.error('Failed to bundle rentStatusService.ts:', bundleRes.stderr?.toString());
    process.exit(1);
  }

  const results = await globalContext.runAll();
  const tzMatrixOk = await runTimezoneMatrix();

  if (results.failed > 0 || !tzMatrixOk) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
