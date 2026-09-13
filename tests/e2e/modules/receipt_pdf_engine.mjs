// tests/e2e/modules/receipt_pdf_engine.mjs
// Pure Vector PDF 1.4 generator & fiscal quietanza engine (F10, F11, F12)

/**
 * Evaluates the Italian stamp duty (marca da bollo) requirements.
 */
export function evaluateStampDuty(taxRegime, totalAmount) {
  if (taxRegime === 'CEDOLARE_SECCA') {
    return {
      applied: false,
      amount: 0,
      clause: "Operazione soggetta a cedolare secca ex art. 3 D.Lgs. 23/2011. Imposta di bollo non dovuta."
    };
  }

  if (taxRegime === 'ORDINARIO') {
    if (totalAmount > 77.47) {
      return {
        applied: true,
        amount: 2.00,
        clause: "Imposta di bollo di Euro 2,00 assolta sull'originale ai sensi dell'art. 13 DPR 642/1972."
      };
    } else {
      return {
        applied: false,
        amount: 0,
        clause: "Esente da imposta di bollo ex art. 13 Tariffa DPR 642/1972 (importo non superiore a Euro 77,47)."
      };
    }
  }

  return {
    applied: false,
    amount: 0,
    clause: "Esente da imposta di bollo."
  };
}

/**
 * Sequential numbering allocator per fiscal year (Feature F11).
 * Resets to 1 when fiscalYear changes.
 */
export function allocateSequentialReceiptNumber(existingReceipts = [], targetFiscalYear) {
  const receiptsInYear = (existingReceipts || []).filter(r => r.fiscalYear === targetFiscalYear);
  let maxSeq = 0;
  for (const r of receiptsInYear) {
    if (typeof r.receiptNumber === 'number' && r.receiptNumber > maxSeq) {
      maxSeq = r.receiptNumber;
    }
  }
  const nextSeq = maxSeq + 1;
  const formattedNumber = `${nextSeq}/${targetFiscalYear}`;
  const id = `RCP-${targetFiscalYear}-${String(nextSeq).padStart(4, '0')}`;
  return {
    receiptNumber: nextSeq,
    fiscalYear: targetFiscalYear,
    formattedNumber,
    id
  };
}

/**
 * Builds a complete RentReceipt object from constituent domain entities.
 */
export function createRentReceipt({
  existingReceipts = [],
  landlord,
  tenant,
  property,
  paymentRecord,
  competencePeriod,
  taxRegime = 'CEDOLARE_SECCA',
  notes = ''
}) {
  const issueDate = new Date().toISOString();
  const fiscalYear = paymentRecord?.year || new Date().getUTCFullYear();
  const seq = allocateSequentialReceiptNumber(existingReceipts, fiscalYear);

  const rentAmount = paymentRecord?.income || property?.financials?.monthlyRent || 0;
  const expensesAmount = property?.financials?.condoFees || 0;
  const totalAmount = rentAmount; // Total paid

  const stamp = evaluateStampDuty(taxRegime, totalAmount);

  return {
    id: seq.id,
    receiptNumber: seq.receiptNumber,
    fiscalYear: seq.fiscalYear,
    formattedNumber: seq.formattedNumber,
    issueDate,
    paymentRecordId: paymentRecord?.id || `pmt_${Date.now()}`,
    propertyId: property?.id || '',
    propertyName: property?.name || '',
    propertyAddress: property?.address || '',
    tenantId: tenant?.id || '',
    tenantName: tenant?.name || '',
    tenantTaxCode: tenant?.taxCode || '',
    landlordId: landlord?.id || '',
    landlordName: landlord?.name || '',
    landlordTaxCode: landlord?.taxCode || '',
    landlordAddress: landlord?.address || '',
    competencePeriod: competencePeriod || `Mese di competenza ${paymentRecord?.month !== undefined ? paymentRecord.month + 1 : 1}/${fiscalYear}`,
    rentAmount,
    expensesAmount,
    totalAmount,
    taxRegime,
    stampDutyApplied: stamp.applied,
    stampDutyAmount: stamp.amount,
    stampDutyClause: stamp.clause,
    notes,
    createdAt: issueDate
  };
}

/**
 * Escapes characters for PDF string literals: ( -> \(, ) -> \), \ -> \\
 */
function escapePdfText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a clean, compliant Vector PDF 1.4 document buffer.
 * Zero external npm dependencies. Compatible with Node.js and browser.
 */
export function generateReceiptPdf(receipt) {
  const width = 595.28;  // A4 portrait width in points
  const height = 841.89; // A4 portrait height in points

  // Content Stream construction using PDF vector and text operators
  const streamLines = [
    // Background card border & header banner
    '0.2 0.3 0.5 RG',     // Stroke color
    '0.95 0.97 1.0 rg',   // Header banner background fill
    '40 760 515 50 re',
    'B',                  // Fill and stroke
    // Title
    'BT',
    '/F2 20 Tf',
    '55 778 Td',
    `(${escapePdfText(`QUIETANZA DI PAGAMENTO - RICEVUTA N. ${receipt.formattedNumber}`)}) Tj`,
    'ET',
    // Subheader
    'BT',
    '/F1 10 Tf',
    '55 765 Td',
    `(${escapePdfText(`Data di emissione: ${receipt.issueDate.split('T')[0]}`)}) Tj`,
    'ET',
    // Landlord section box
    '0.8 0.8 0.8 RG',
    '40 640 515 105 re',
    'S',
    'BT',
    '/F2 12 Tf',
    '55 725 Td',
    `(${escapePdfText('DATI DEL LOCATORE (PROPRIETARIO)')}) Tj`,
    '/F1 10 Tf',
    '0 -16 Td',
    `(${escapePdfText(`Nome / Ragione Sociale: ${receipt.landlordName}`)}) Tj`,
    '0 -14 Td',
    `(${escapePdfText(`Codice Fiscale: ${receipt.landlordTaxCode}`)}) Tj`,
    '0 -14 Td',
    `(${escapePdfText(`Indirizzo: ${receipt.landlordAddress}`)}) Tj`,
    'ET',
    // Tenant section box
    '40 520 515 105 re',
    'S',
    'BT',
    '/F2 12 Tf',
    '55 605 Td',
    `(${escapePdfText('DATI DEL CONDUTTORE (INQUILINO)')}) Tj`,
    '/F1 10 Tf',
    '0 -16 Td',
    `(${escapePdfText(`Nome / Ragione Sociale: ${receipt.tenantName}`)}) Tj`,
    '0 -14 Td',
    `(${escapePdfText(`Codice Fiscale: ${receipt.tenantTaxCode}`)}) Tj`,
    'ET',
    // Property and Competence box
    '40 400 515 105 re',
    'S',
    'BT',
    '/F2 12 Tf',
    '55 485 Td',
    '(DETTAGLI IMMOBILE E COMPETENZA) Tj',
    '/F1 10 Tf',
    '0 -16 Td',
    `(${escapePdfText(`Immobile: ${receipt.propertyName}`)}) Tj`,
    '0 -14 Td',
    `(${escapePdfText(`Ubicazione: ${receipt.propertyAddress}`)}) Tj`,
    '0 -14 Td',
    `(${escapePdfText(`Periodo di competenza: ${receipt.competencePeriod}`)}) Tj`,
    'ET',
    // Financial Breakdown Table
    '0.15 0.45 0.7 rg',
    '40 350 515 30 re',
    'f',
    'BT',
    '/F2 11 Tf',
    '1 1 1 rg', // White text
    '55 360 Td',
    '(VOCE CONTABILE) Tj',
    '400 0 Td',
    '(IMPORTO) Tj',
    'ET',
    // Row 1: Canone
    '0 0 0 rg',
    '40 315 515 35 re',
    'S',
    'BT',
    '/F1 10 Tf',
    '55 328 Td',
    '(Canone di locazione concordato/pattuito) Tj',
    '400 0 Td',
    `(${escapePdfText(`Euro ${receipt.rentAmount.toFixed(2)}`)}) Tj`,
    'ET',
    // Row 2: Spese Accessorie
    '40 280 515 35 re',
    'S',
    'BT',
    '/F1 10 Tf',
    '55 293 Td',
    '(Oneri accessori e spese condominiali) Tj',
    '400 0 Td',
    `(${escapePdfText(`Euro ${receipt.expensesAmount.toFixed(2)}`)}) Tj`,
    'ET',
    // Row 3: Totale Corrisposto (Bold Banner)
    '0.92 0.94 0.98 rg',
    '40 240 515 40 re',
    'f',
    '0.2 0.3 0.5 RG',
    '40 240 515 40 re',
    'S',
    'BT',
    '/F2 13 Tf',
    '0.1 0.2 0.4 rg',
    '55 254 Td',
    '(TOTALE CORRISPOSTO E SALDATO) Tj',
    '380 0 Td',
    `(${escapePdfText(`Euro ${receipt.totalAmount.toFixed(2)}`)}) Tj`,
    'ET',
    // Fiscal Stamp Duty & Notes section
    '40 140 515 85 re',
    'S',
    'BT',
    '/F2 10 Tf',
    '0 0 0 rg',
    '55 205 Td',
    '(INFORMAZIONI FISCALI E DICHIARAZIONE DI QUIETANZA) Tj',
    '/F1 9 Tf',
    '0 -16 Td',
    `(${escapePdfText(`Regime fiscale applicato: ${receipt.taxRegime}`)}) Tj`,
    '0 -14 Td',
    `(${escapePdfText(receipt.stampDutyClause || '')}) Tj`,
    '0 -14 Td',
    '(Il locatore rilascia la presente quale quietanza liberatoria a saldo di quanto sopra specificato.) Tj',
    'ET',
    // Landlord Signature line
    'BT',
    '/F2 10 Tf',
    '380 75 Td',
    '(Firma del locatore per quietanza) Tj',
    'ET',
    '360 60 m 530 60 l S'
  ];

  const streamContent = streamLines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'binary');

  // Construct PDF Objects
  const objects = [];

  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // 3: Page
  objects.push(
    '3 0 obj\n' +
    '<< /Type /Page /Parent 2 0 R ' +
    `/MediaBox [0 0 ${width} ${height}] ` +
    '/Contents 4 0 R ' +
    '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> ' +
    '>>\nendobj\n'
  );

  // 4: Content Stream
  objects.push(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`
  );

  // 5: Font Helvetica Regular
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );

  // 6: Font Helvetica Bold
  objects.push(
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'
  );

  // Build PDF Binary
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0]; // offset for object 0

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += objects[i];
  }

  const startXref = Buffer.byteLength(pdf, 'binary');
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    pdf += `${offStr} 00000 n \n`;
  }

  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${startXref}\n`;
  pdf += '%%EOF\n';

  return Buffer.from(pdf, 'binary');
}
