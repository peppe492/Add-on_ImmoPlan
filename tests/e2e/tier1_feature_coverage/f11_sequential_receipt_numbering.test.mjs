// tests/e2e/tier1_feature_coverage/f11_sequential_receipt_numbering.test.mjs
import { describe, test, assertEqual } from '../harness/test_framework.mjs';
import { allocateSequentialReceiptNumber } from '../modules/receipt_pdf_engine.mjs';

describe('Tier 1 - F11: Sequential Receipt Numbering', () => {
  test('T1-F11-01: Allocates number 1 for the first receipt of a fiscal year', () => {
    const seq = allocateSequentialReceiptNumber([], 2026);
    assertEqual(seq.receiptNumber, 1);
    assertEqual(seq.formattedNumber, '1/2026');
    assertEqual(seq.id, 'RCP-2026-0001');
  });

  test('T1-F11-02: Increments number sequentially within the same fiscal year', () => {
    const existing = [
      { receiptNumber: 1, fiscalYear: 2026 },
      { receiptNumber: 2, fiscalYear: 2026 },
      { receiptNumber: 3, fiscalYear: 2026 }
    ];
    const seq = allocateSequentialReceiptNumber(existing, 2026);
    assertEqual(seq.receiptNumber, 4);
    assertEqual(seq.formattedNumber, '4/2026');
    assertEqual(seq.id, 'RCP-2026-0004');
  });

  test('T1-F11-03: Resets counter to 1 when fiscal year changes', () => {
    const existing = [
      { receiptNumber: 1, fiscalYear: 2025 },
      { receiptNumber: 2, fiscalYear: 2025 },
      { receiptNumber: 42, fiscalYear: 2025 }
    ];
    // New receipt in 2026
    const seq = allocateSequentialReceiptNumber(existing, 2026);
    assertEqual(seq.receiptNumber, 1);
    assertEqual(seq.formattedNumber, '1/2026');
    assertEqual(seq.fiscalYear, 2026);
  });

  test('T1-F11-04: Enforces strict monotonic sequence even if receipts are unsorted', () => {
    const unsorted = [
      { receiptNumber: 5, fiscalYear: 2026 },
      { receiptNumber: 2, fiscalYear: 2026 },
      { receiptNumber: 9, fiscalYear: 2026 }
    ];
    const seq = allocateSequentialReceiptNumber(unsorted, 2026);
    assertEqual(seq.receiptNumber, 10);
    assertEqual(seq.formattedNumber, '10/2026');
  });

  test('T1-F11-05: Isolates numbers between different fiscal years correctly', () => {
    const existing = [
      { receiptNumber: 1, fiscalYear: 2025 },
      { receiptNumber: 2, fiscalYear: 2025 },
      { receiptNumber: 1, fiscalYear: 2026 }
    ];
    const next2025 = allocateSequentialReceiptNumber(existing, 2025);
    const next2026 = allocateSequentialReceiptNumber(existing, 2026);
    assertEqual(next2025.formattedNumber, '3/2025');
    assertEqual(next2026.formattedNumber, '2/2026');
  });
});
