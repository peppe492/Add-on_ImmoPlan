// tests/e2e/tier1_feature_coverage/f10_pure_vector_pdf_engine.test.mjs
import { describe, test, assertEqual, assertTrue } from '../harness/test_framework.mjs';
import { generateReceiptPdf, createRentReceipt } from '../modules/receipt_pdf_engine.mjs';
import { PdfValidator } from '../harness/pdf_validator.mjs';
import { fixtureLandlord, fixtureTenant1, fixturePropertyCedolare } from '../harness/fixtures.mjs';

describe('Tier 1 - F10: Pure TypeScript Vector PDF Engine', () => {
  test('T1-F10-01: Generates valid PDF 1.4 byte stream starting with %PDF-1.4', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfBuffer = generateReceiptPdf(receipt);
    const val = PdfValidator.validate(pdfBuffer);
    assertTrue(val.isValid, `PDF validation failed: ${val.errors.join(', ')}`);
    assertEqual(val.version, '1.4');
  });

  test('T1-F10-02: Includes xref table and %%EOF marker', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfStr = generateReceiptPdf(receipt).toString('binary');
    assertTrue(pdfStr.includes('xref'));
    assertTrue(pdfStr.includes('trailer'));
    assertTrue(pdfStr.includes('startxref'));
    assertTrue(pdfStr.endsWith('%%EOF\n'));
  });

  test('T1-F10-03: Includes catalog, pages tree, and standard font objects', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfStr = generateReceiptPdf(receipt).toString('binary');
    assertTrue(pdfStr.includes('/Type /Catalog'));
    assertTrue(pdfStr.includes('/Type /Pages'));
    assertTrue(pdfStr.includes('/Type /Page'));
    assertTrue(pdfStr.includes('/BaseFont /Helvetica'));
  });

  test('T1-F10-04: Contains vector graphics drawing commands (re, RG, rg, S, f)', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfStr = generateReceiptPdf(receipt).toString('binary');
    assertTrue(pdfStr.includes('re')); // Rectangle
    assertTrue(pdfStr.includes('RG')); // Stroke color
    assertTrue(pdfStr.includes('rg')); // Fill color
    assertTrue(pdfStr.includes('S'));  // Stroke
  });

  test('T1-F10-05: Contains text operators (BT, ET, Tf, Td, Tj)', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfStr = generateReceiptPdf(receipt).toString('binary');
    assertTrue(pdfStr.includes('BT'));
    assertTrue(pdfStr.includes('ET'));
    assertTrue(pdfStr.includes('Tf'));
    assertTrue(pdfStr.includes('Td'));
    assertTrue(pdfStr.includes('Tj'));
  });
});
