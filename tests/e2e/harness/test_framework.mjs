// tests/e2e/harness/test_framework.mjs
// Lightweight, zero-dependency test assertion and runner framework

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class TestContext {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.failures = [];
  }

  describe(suiteName, fn) {
    const suite = {
      name: suiteName,
      tests: [],
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: []
    };
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = prevSuite;
    }
  }

  test(testName, fn) {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {
        this.test(testName, fn);
      });
      return;
    }
    this.currentSuite.tests.push({
      name: testName,
      fn
    });
  }

  async runAll() {
    const startTime = Date.now();
    console.log(`\n${colors.bold}${colors.cyan}════════════════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}         Add-on_ImmoPlan E2E Test Suite (Tiers 1 - 4)                       ${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}════════════════════════════════════════════════════════════════════════════${colors.reset}\n`);

    for (const suite of this.suites) {
      console.log(`\n${colors.bold}${colors.blue}▶ ${suite.name}${colors.reset}`);

      for (const t of suite.tests) {
        this.totalTests++;
        const testStart = Date.now();
        try {
          // Execute beforeEach hooks
          for (const hook of suite.beforeEach) await hook();

          // Execute test
          await t.fn();

          // Execute afterEach hooks
          for (const hook of suite.afterEach) await hook();

          this.passedTests++;
          const duration = Date.now() - testStart;
          console.log(`  ${colors.green}✔${colors.reset} ${t.name} ${colors.dim}(${duration}ms)${colors.reset}`);
        } catch (err) {
          this.failedTests++;
          const duration = Date.now() - testStart;
          console.log(`  ${colors.red}✖ ${t.name}${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}`);
          console.log(`    ${colors.red}${err.message}${colors.reset}`);
          this.failures.push({
            suite: suite.name,
            test: t.name,
            error: err
          });
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bold}────────────────────────────────────────────────────────────────────────────${colors.reset}`);
    console.log(`${colors.bold}Test Execution Summary:${colors.reset}`);
    console.log(`  Total Tests : ${this.totalTests}`);
    console.log(`  ${colors.green}Passed      : ${this.passedTests}${colors.reset}`);
    if (this.failedTests > 0) {
      console.log(`  ${colors.red}Failed      : ${this.failedTests}${colors.reset}`);
    } else {
      console.log(`  Failed      : 0`);
    }
    console.log(`  Duration    : ${elapsed}s`);

    if (this.failures.length > 0) {
      console.log(`\n${colors.bold}${colors.red}Failures Breakdown:${colors.reset}`);
      for (const [idx, fail] of this.failures.entries()) {
        console.log(`\n  ${idx + 1}) [${fail.suite}] ${fail.test}`);
        console.log(`     ${colors.red}${fail.error.stack || fail.error.message}${colors.reset}`);
      }
    }

    console.log(`\n${colors.bold}${this.failedTests === 0 ? colors.green + '✨ ALL TESTS PASSED SUCCESSFULLY! (100%)' : colors.red + '🚨 TEST SUITE RUN COMPLETED WITH FAILURES.'}${colors.reset}\n`);

    return {
      total: this.totalTests,
      passed: this.passedTests,
      failed: this.failedTests,
      failures: this.failures
    };
  }
}

export const globalContext = new TestContext();

export function describe(name, fn) {
  globalContext.describe(name, fn);
}

export function test(name, fn) {
  globalContext.test(name, fn);
}

export const it = test;

// Assertions
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(
      message
        ? `${message}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message
        ? `${message}: Deep equality mismatch.\nExpected: ${expectedStr}\nActual:   ${actualStr}`
        : `Deep equality mismatch.\nExpected: ${expectedStr}\nActual:   ${actualStr}`
    );
  }
}

export function assertTrue(val, message = 'Expected value to be true') {
  if (val !== true) {
    throw new Error(`${message}: Got ${val}`);
  }
}

export function assertFalse(val, message = 'Expected value to be false') {
  if (val !== false) {
    throw new Error(`${message}: Got ${val}`);
  }
}

export function assertIncludes(haystack, needle, message = '') {
  if (typeof haystack === 'string') {
    if (!haystack.includes(needle)) {
      throw new Error(message || `Expected string to include "${needle}"`);
    }
  } else if (Array.isArray(haystack)) {
    if (!haystack.includes(needle)) {
      throw new Error(message || `Expected array to include ${JSON.stringify(needle)}`);
    }
  } else {
    throw new Error(`assertIncludes target must be string or array`);
  }
}

export function assertMatch(str, regex, message = '') {
  if (!regex.test(str)) {
    throw new Error(message || `String "${str}" did not match regex ${regex}`);
  }
}

export function assertThrows(fn, expectedErrorSubstring = '') {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    if (expectedErrorSubstring && !e.message.includes(expectedErrorSubstring)) {
      throw new Error(`Expected error message to contain "${expectedErrorSubstring}", got: "${e.message}"`);
    }
  }
  if (!threw) {
    throw new Error(`Expected function to throw, but it executed without error.`);
  }
}

export async function assertRejects(fn, expectedErrorSubstring = '') {
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = true;
    if (expectedErrorSubstring && !e.message.includes(expectedErrorSubstring)) {
      throw new Error(`Expected rejected error to contain "${expectedErrorSubstring}", got: "${e.message}"`);
    }
  }
  if (!threw) {
    throw new Error(`Expected async function to reject, but it resolved successfully.`);
  }
}
