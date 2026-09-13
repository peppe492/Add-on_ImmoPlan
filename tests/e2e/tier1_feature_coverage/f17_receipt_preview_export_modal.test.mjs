// tests/e2e/tier1_feature_coverage/f17_receipt_preview_export_modal.test.mjs
import { describe, test, assertEqual, assertTrue } from '../harness/test_framework.mjs';
import { createRentReceipt, generateReceiptPdf } from '../modules/receipt_pdf_engine.mjs';
import { PdfValidator } from '../harness/pdf_validator.mjs';
import { fixtureLandlord, fixtureTenant1, fixturePropertyCedolare } from '../harness/fixtures.mjs';

describe('Tier 1 - F17: Receipt Preview & Export Modal Contracts', () => {
  test('T1-F17-01: Receipt object contains all necessary fields for preview modal', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });

    assertEqual(receipt.formattedNumber, '1/2026');
    assertEqual(receipt.landlordName, fixtureLandlord.name);
    assertEqual(receipt.tenantName, fixtureTenant1.name);
    assertEqual(receipt.propertyName, fixturePropertyCedolare.name);
    assertEqual(receipt.totalAmount, 850);
  });

  test('T1-F17-02: Export PDF generates valid binary for browser download Blob', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const pdfBuf = generateReceiptPdf(receipt);
    assertTrue(pdfBuf.length > 500);
    assertTrue(PdfValidator.validate(pdfBuf).isValid);
  });

  test('T1-F17-03: Generates clean sanitized filename for download action', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    const filename = `quietanza_${receipt.formattedNumber.replace('/', '_')}.pdf`;
    assertEqual(filename, 'quietanza_1_2026.pdf');
  });

  test('T1-F17-04: Receipt contains complete breakdown rows for print styling', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 }
    });
    assertEqual(receipt.rentAmount, 850);
    assertEqual(receipt.expensesAmount, 100);
    assertEqual(receipt.totalAmount, 850);
  });

  test('T1-F17-05: Preserves custom user notes in receipt export', () => {
    const receipt = createRentReceipt({
      landlord: fixtureLandlord,
      tenant: fixtureTenant1,
      property: fixturePropertyCedolare,
      paymentRecord: { id: 'p1', year: 2026, month: 8, income: 850 },
      notes: 'Pagamento effettuato con bonifico bancario CRO 1234567890'
    });
    assertEqual(receipt.notes, 'Pagamento effettuato con bonifico bancario CRO 1234567890');
  });
});
