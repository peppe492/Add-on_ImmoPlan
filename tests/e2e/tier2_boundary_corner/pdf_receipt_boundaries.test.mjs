// tests/e2e/tier2_boundary_corner/pdf_receipt_boundaries.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import {
  evaluateStampDuty,
  allocateSequentialReceiptNumber,
  createRentReceipt,
  generateReceiptPdf
} from '../modules/receipt_pdf_engine.mjs';
import { PdfValidator } from '../harness/pdf_validator.mjs';
import { fixtureLandlord, fixtureTenant1, fixturePropertyCedolare } from '../harness/fixtures.mjs';

describe('Tier 2 - PDF & Receipt Fiscal Boundaries', () => {
  // F12 Stamp Duty Boundaries
  test('T2-F12-01: Exactly € 77.47 under ORDINARIO is EXEMPT from stamp duty', () => {
    const stamp = evaluateStampDuty('ORDINARIO', 77.47);
    assertFalse(stamp.applied);
    assertEqual(stamp.amount, 0);
    assertTrue(stamp.clause.includes('non superiore a Euro 77,47'));
  });

  test('T2-F12-02: Exactly € 77.48 under ORDINARIO APPLIES € 2.00 stamp duty', () => {
    const stamp = evaluateStampDuty('ORDINARIO', 77.48);
    assertTrue(stamp.applied);
    assertEqual(stamp.amount, 2.00);
    assertTrue(stamp.clause.includes('Euro 2,00'));
  });

  test('T2-F12-03: Small amount (€ 10.00) under ORDINARIO is EXEMPT', () => {
    const stamp = evaluateStampDuty('ORDINARIO', 10.00);
    assertFalse(stamp.applied);
    assertEqual(stamp.amount, 0);
  });

  test('T2-F12-04: Large amount (€ 5,000.00) under CEDOLARE_SECCA remains EXEMPT', () => {
    const stamp = evaluateStampDuty('CEDOLARE_SECCA', 5000.00);
    assertFalse(stamp.applied);
    assertEqual(stamp.amount, 0);
  });

  test('T2-F12-05: Tax regime ESENTE is always exempt from stamp duty', () => {
    const stamp = evaluateStampDuty('ESENTE', 2500.00);
    assertFalse(stamp.applied);
    assertEqual(stamp.amount, 0);
  });

  // F11 Numbering Boundaries
  test('T2-F11-01: High sequential number (e.g. 9999/2026) formats cleanly', () => {
    const existing = [{ receiptNumber: 9998, fiscalYear: 2026 }];
    const seq = allocateSequentialReceiptNumber(existing, 2026);
    assertEqual(seq.receiptNumber, 9999);
    assertEqual(seq.formattedNumber, '9999/2026');
    assertEqual(seq.id, 'RCP-2026-9999');
  });

  test('T2-F11-02: Receipts out of chronological order do not reset sequence', () => {
    const existing = [
      { receiptNumber: 4, fiscalYear: 2026 },
      { receiptNumber: 1, fiscalYear: 2026 },
      { receiptNumber: 7, fiscalYear: 2026 }
    ];
    const seq = allocateSequentialReceiptNumber(existing, 2026);
    assertEqual(seq.receiptNumber, 8);
  });

  test('T2-F11-03: Empty existing receipts array allocates number 1', () => {
    const seq = allocateSequentialReceiptNumber([], 2027);
    assertEqual(seq.receiptNumber, 1);
    assertEqual(seq.formattedNumber, '1/2027');
  });

  test('T2-F11-04: Null existing receipts handles gracefully and allocates 1', () => {
    const seq = allocateSequentialReceiptNumber(null, 2026);
    assertEqual(seq.receiptNumber, 1);
  });

  // F10 Vector PDF Encoding & Text Boundaries
  test('T2-F10-01: Italian accented vowels (à, è, é, ì, ò, ù) in names and addresses render in PDF', () => {
    const accentedLandlord = {
      ...fixtureLandlord,
      name: 'Niccolò D\'Amitié',
      address: 'Piazza della Libertà 42, Forlì'
    };
    const receipt = createRentReceipt({
      landlord: accentedLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfBuf = generateReceiptPdf(receipt);
    const text = PdfValidator.validate(pdfBuf).fullTextContent;
    assertTrue(text.includes('Niccolò'));
    assertTrue(text.includes('Libertà'));
  });

  test('T2-F10-02: Parentheses in property name or notes do not corrupt PDF stream syntax', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: { ...fixturePropertyCedolare, name: 'Attico (Scala B - Int. 4)' },
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 },
      notes: 'Nota di pagamento (acconto del 50%)'
    });
    const pdfBuf = generateReceiptPdf(receipt);
    const val = PdfValidator.validate(pdfBuf);
    assertTrue(val.isValid, 'PDF with escaped parentheses must remain valid');
  });

  test('T2-F10-03: Backslashes in notes are safely escaped in PDF output', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 },
      notes: 'Path reference C:\\data\\receipts'
    });
    const pdfBuf = generateReceiptPdf(receipt);
    const val = PdfValidator.validate(pdfBuf);
    assertTrue(val.isValid);
  });

  test('T2-F10-04: Multi-line text does not produce unclosed string literals', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 },
      notes: 'Line 1\nLine 2\nLine 3'
    });
    const pdfBuf = generateReceiptPdf(receipt);
    assertTrue(PdfValidator.validate(pdfBuf).isValid);
  });

  test('T2-F10-05: Concurrent generation of 25 receipts completes rapidly without error', () => {
    const promises = Array.from({ length: 25 }).map((_, i) => {
      const r = createRentReceipt({
        landlord: fixtureLandlord,
        tenant: fixtureTenant1,
        property: fixturePropertyCedolare,
        paymentRecord: { id: `p_${i}`, year: 2026, month: i % 12, income: 800 + i }
      });
      return generateReceiptPdf(r);
    });
    assertEqual(promises.length, 25);
    for (const buf of promises) {
      assertTrue(PdfValidator.validate(buf).isValid);
    }
  });

  test('T2-F11-05: Receipt ID format preserves 4-digit zero padding', () => {
    const seq = allocateSequentialReceiptNumber([], 2026);
    assertEqual(seq.id, 'RCP-2026-0001');
    const seq99 = allocateSequentialReceiptNumber([{ receiptNumber: 98, fiscalYear: 2026 }], 2026);
    assertEqual(seq99.id, 'RCP-2026-0099');
  });
});
