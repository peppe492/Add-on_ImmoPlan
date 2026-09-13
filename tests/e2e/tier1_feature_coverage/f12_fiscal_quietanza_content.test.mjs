// tests/e2e/tier1_feature_coverage/f12_fiscal_quietanza_content.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { createRentReceipt, evaluateStampDuty, generateReceiptPdf } from '../modules/receipt_pdf_engine.mjs';
import { PdfValidator } from '../harness/pdf_validator.mjs';
import {
  fixtureLandlord,
  fixtureTenant1,
  fixtureTenant2,
  fixturePropertyCedolare,
  fixturePropertyOrdinario,
  fixturePropertySmallRent
} from '../harness/fixtures.mjs';

describe('Tier 1 - F12: Fiscal Quietanza Content', () => {
  test('T1-F12-01: Renders complete landlord identification in PDF text', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfBuf = generateReceiptPdf(receipt);
    const text = PdfValidator.validate(pdfBuf).fullTextContent;
    assertTrue(text.includes(fixtureLandlord.name));
    assertTrue(text.includes(fixtureLandlord.taxCode));
  });

  test('T1-F12-02: Renders complete tenant identification in PDF text', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfBuf = generateReceiptPdf(receipt);
    const text = PdfValidator.validate(pdfBuf).fullTextContent;
    assertTrue(text.includes(fixtureTenant1.name));
    assertTrue(text.includes(fixtureTenant1.taxCode));
  });

  test('T1-F12-03: Renders property address and competence period', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      competencePeriod: 'Mese di Settembre 2026',
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfBuf = generateReceiptPdf(receipt);
    const text = PdfValidator.validate(pdfBuf).fullTextContent;
    assertTrue(text.includes(fixturePropertyCedolare.name));
    assertTrue(text.includes('Settembre 2026'));
  });

  test('T1-F12-04: Cedolare Secca is EXEMPT from stamp duty with statutory clause', () => {
    const stamp = evaluateStampDuty('CEDOLARE_SECCA', 1200);
    assertFalse(stamp.applied);
    assertEqual(stamp.amount, 0);
    assertTrue(stamp.clause.includes('art. 3 D.Lgs. 23/2011'));
  });

  test('T1-F12-05: Regime Ordinario > 77.47 applies 2.00 stamp duty with statutory clause', () => {
    const stamp = evaluateStampDuty('ORDINARIO', 1100);
    assertTrue(stamp.applied);
    assertEqual(stamp.amount, 2.00);
    assertTrue(stamp.clause.includes('art. 13 DPR 642/1972'));
  });
});
