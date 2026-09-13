// tests/adversarial_challenger2_suite.mjs
// ============================================================================
// ADVERSARIAL VERIFICATION SUITE — CHALLENGER 2
// Empirical Stress Harness covering:
// 1. Receipt numbering allocator across concurrent requests, year boundaries, multi-year jumps
// 2. Pure Vector PDF generator syntax: %PDF-1.4 header, xref table, exact byte offsets, string escaping, Italian accented vowels
// 3. Italian stamp duty boundary (€77.47 exactly vs €77.48) for ORDINARIO vs CEDOLARE_SECCA
// 4. Leap year rent due date calculation for February 29 (2024, 2028 vs 2025, 2026, 2100)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  allocateSequentialReceiptNumber,
  createRentReceipt,
  evaluateStampDuty,
  generateReceiptPdf
} from './receiptPdfService.bundled.mjs';
import {
  isLeapYear,
  getDaysInMonth,
  getEffectiveRentDueDay,
  calculateDueDate,
  calculateDaysUntilDue,
  getRentDueDate,
  calculateRentStatus
} from './rentStatusService.bundled.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRATCH_DIR = path.join(__dirname, 'scratch_c2');
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

// Extract server.js buildPdfBuffer and escapePdf for server-side verification
const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const escapePdfMatch = serverSrc.match(/function escapePdf\(str\) \{[\s\S]*?\n\}/)[0];
const buildPdfMatch = serverSrc.match(/function buildPdfBuffer\(receipt\) \{[\s\S]*?\n\}/)[0];
const serverBuildPdfBuffer = new Function('receipt', `${escapePdfMatch}\n${buildPdfMatch}\nreturn buildPdfBuffer(receipt);`);

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, testName, message = '') {
  totalAssertions++;
  if (!condition) {
    failedAssertions++;
    const errMsg = `[FAIL] ${testName}: ${message}`;
    failureDetails.push(errMsg);
    console.error(`  ❌ ${errMsg}`);
  } else {
    passedAssertions++;
    console.log(`  ✔ ${testName}`);
  }
}

function assertEqual(actual, expected, testName, message = '') {
  totalAssertions++;
  if (actual !== expected) {
    failedAssertions++;
    const errMsg = `[FAIL] ${testName}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}. ${message}`;
    failureDetails.push(errMsg);
    console.error(`  ❌ ${errMsg}`);
  } else {
    passedAssertions++;
    console.log(`  ✔ ${testName} (=== ${JSON.stringify(actual)})`);
  }
}

console.log('\n============================================================================');
console.log('       ADVERSARIAL VERIFICATION SUITE — CHALLENGER 2');
console.log('============================================================================\n');

// ============================================================================
// SUITE 1: RECEIPT NUMBERING ALLOCATOR
// ============================================================================
console.log('\n─── SUITE 1: RECEIPT NUMBERING ALLOCATOR ───');

// 1.1 Empty array allocation
const empty2026 = allocateSequentialReceiptNumber([], 2026);
assertEqual(empty2026.receiptNumber, 1, '1.1.1 Empty existing receipts allocates receiptNumber = 1');
assertEqual(empty2026.fiscalYear, 2026, '1.1.2 Empty existing receipts assigns targetFiscalYear = 2026');
assertEqual(empty2026.formattedNumber, '1/2026', '1.1.3 Empty existing receipts formats number as 1/2026');
assertEqual(empty2026.id, 'RCP-2026-0001', '1.1.4 Empty existing receipts formats id as RCP-2026-0001');

// 1.2 Null and undefined tolerance
const nullAlloc = allocateSequentialReceiptNumber(null, 2026);
assertEqual(nullAlloc.receiptNumber, 1, '1.2.1 Null input defaults gracefully to 1');
const undefAlloc = allocateSequentialReceiptNumber(undefined, 2026);
assertEqual(undefAlloc.receiptNumber, 1, '1.2.2 Undefined input defaults gracefully to 1');

// 1.3 Year boundary rollover: 2025 -> 2026
const receipts2025 = Array.from({ length: 45 }, (_, i) => ({
  receiptNumber: i + 1,
  fiscalYear: 2025,
  formattedNumber: `${i + 1}/2025`,
  id: `RCP-2025-${String(i + 1).padStart(4, '0')}`
}));
const rollover2026 = allocateSequentialReceiptNumber(receipts2025, 2026);
assertEqual(rollover2026.receiptNumber, 1, '1.3.1 Year rollover resets sequence to 1 when entering 2026');
assertEqual(rollover2026.formattedNumber, '1/2026', '1.3.2 Formatted number reflects new fiscal year 1/2026');
assertEqual(rollover2026.id, 'RCP-2026-0001', '1.3.3 ID prefix reflects new fiscal year RCP-2026-0001');

// 1.4 Multi-year jump: 2025 -> 2027 (gap in 2026)
const jump2027 = allocateSequentialReceiptNumber(receipts2025, 2027);
assertEqual(jump2027.receiptNumber, 1, '1.4.1 Multi-year jump (2025 -> 2027) resets sequence to 1');
assertEqual(jump2027.formattedNumber, '1/2027', '1.4.2 Formatted number reflects 1/2027');

// 1.5 Back-entry in previous year: inserting into 2025 after 2026 receipts exist
const mixedReceipts = [
  ...receipts2025,
  { receiptNumber: 1, fiscalYear: 2026, formattedNumber: '1/2026', id: 'RCP-2026-0001' },
  { receiptNumber: 2, fiscalYear: 2026, formattedNumber: '2/2026', id: 'RCP-2026-0002' }
];
const backEntry2025 = allocateSequentialReceiptNumber(mixedReceipts, 2025);
assertEqual(backEntry2025.receiptNumber, 46, '1.5.1 Back-entry into 2025 increments to 46 (max 2025 + 1)');
assertEqual(backEntry2025.formattedNumber, '46/2025', '1.5.2 Formatted number is 46/2025');

// 1.6 Unsorted and reverse-ordered existing receipts
const unsortedReceipts = [
  { receiptNumber: 18, fiscalYear: 2026 },
  { receiptNumber: 3, fiscalYear: 2026 },
  { receiptNumber: 99, fiscalYear: 2026 },
  { receiptNumber: 42, fiscalYear: 2026 },
  { receiptNumber: 1, fiscalYear: 2026 }
];
const nextUnsorted = allocateSequentialReceiptNumber(unsortedReceipts, 2026);
assertEqual(nextUnsorted.receiptNumber, 100, '1.6.1 Unsorted receipts correctly finds maximum sequence (99 -> 100)');
assertEqual(nextUnsorted.formattedNumber, '100/2026', '1.6.2 Formatted number is 100/2026');

// 1.7 Non-sequential gaps in sequence
const gappedReceipts = [
  { receiptNumber: 1, fiscalYear: 2026 },
  { receiptNumber: 2, fiscalYear: 2026 },
  { receiptNumber: 10, fiscalYear: 2026 }
];
const nextGapped = allocateSequentialReceiptNumber(gappedReceipts, 2026);
assertEqual(nextGapped.receiptNumber, 11, '1.7.1 Gapped sequence (1, 2, 10) allocates monotonically past max (11)');

// 1.8 Extreme sequence numbers & padding
const seq9999 = allocateSequentialReceiptNumber([{ receiptNumber: 9998, fiscalYear: 2026 }], 2026);
assertEqual(seq9999.id, 'RCP-2026-9999', '1.8.1 Exactly 4 digits pads to RCP-2026-9999');
const seq10000 = allocateSequentialReceiptNumber([{ receiptNumber: 9999, fiscalYear: 2026 }], 2026);
assertEqual(seq10000.receiptNumber, 10000, '1.8.2 Beyond 9999 allocates receiptNumber 10000');
assertEqual(seq10000.id, 'RCP-2026-10000', '1.8.3 Beyond 9999 expands without truncation to RCP-2026-10000');

// 1.9 Robustness against corrupt or non-numeric entries
const corruptReceipts = [
  { receiptNumber: '5', fiscalYear: 2026 }, // string instead of number
  { receiptNumber: null, fiscalYear: 2026 },
  { receiptNumber: NaN, fiscalYear: 2026 },
  { receiptNumber: -10, fiscalYear: 2026 },
  { receiptNumber: 7, fiscalYear: 2026 }
];
const nextCorrupt = allocateSequentialReceiptNumber(corruptReceipts, 2026);
assertEqual(nextCorrupt.receiptNumber, 8, '1.9.1 Ignores non-numeric or negative values and tracks valid max (7 -> 8)');

// 1.10 Multi-thousand scale stress test (1000 receipts across 10 years)
const largeReceiptDataset = [];
for (let y = 2020; y < 2030; y++) {
  for (let s = 1; s <= 100; s++) {
    largeReceiptDataset.push({ receiptNumber: s, fiscalYear: y, formattedNumber: `${s}/${y}` });
  }
}
const startPerf = Date.now();
for (let t = 0; t < 100; t++) {
  const r = allocateSequentialReceiptNumber(largeReceiptDataset, 2025);
  if (r.receiptNumber !== 101) throw new Error('Large scale sequence mismatch');
}
const elapsedPerf = Date.now() - startPerf;
assert(elapsedPerf < 500, `1.10.1 100 allocations over 1000-receipt dataset executes in ${elapsedPerf}ms (< 500ms)`);

// 1.11 Concurrency Stress & Race Condition Simulation
console.log('  Testing Concurrency & Race Condition Behavior:');
// Without synchronization, 20 concurrent tasks reading identical snapshot
const sharedSnapshot = [{ receiptNumber: 10, fiscalYear: 2026 }];
const uncoordinatedResults = [];
for (let i = 0; i < 20; i++) {
  uncoordinatedResults.push(allocateSequentialReceiptNumber(sharedSnapshot, 2026).receiptNumber);
}
const allDuplicates = uncoordinatedResults.every(n => n === 11);
assert(allDuplicates, '1.11.1 Demonstrates uncoordinated concurrent reads produce identical receipt 11 (race hazard)');

// With sequential stateful generator / mutex queue:
class AtomicReceiptAllocator {
  constructor(initialReceipts = []) {
    this.receipts = [...initialReceipts];
    this.queue = Promise.resolve();
  }
  async allocate(year) {
    return new Promise((resolve) => {
      this.queue = this.queue.then(() => {
        const next = allocateSequentialReceiptNumber(this.receipts, year);
        const newReceipt = { receiptNumber: next.receiptNumber, fiscalYear: year, formattedNumber: next.formattedNumber, id: next.id };
        this.receipts.push(newReceipt);
        resolve(next);
      });
    });
  }
}

const atomicAllocator = new AtomicReceiptAllocator([{ receiptNumber: 10, fiscalYear: 2026 }]);
const concurrentPromises = Array.from({ length: 50 }, () => atomicAllocator.allocate(2026));
const coordinatedResults = await Promise.all(concurrentPromises);
const assignedNumbers = coordinatedResults.map(r => r.receiptNumber);
const uniqueNumbers = new Set(assignedNumbers);
assertEqual(uniqueNumbers.size, 50, '1.11.2 Serialized atomic allocator generates 50 completely unique sequential numbers');
assertEqual(Math.min(...assignedNumbers), 11, '1.11.3 Minimum assigned sequence is 11');
assertEqual(Math.max(...assignedNumbers), 60, '1.11.4 Maximum assigned sequence is 60');

// ============================================================================
// SUITE 2: PURE VECTOR PDF GENERATOR SYNTAX & BYTE-LEVEL INTEGRITY
// ============================================================================
console.log('\n─── SUITE 2: PURE VECTOR PDF GENERATOR SYNTAX & BYTE OFFSETS ───');

function verifyPdfByteIntegrity(pdfUint8, testPrefix, sourceName) {
  const buf = Buffer.from(pdfUint8);
  const latinStr = buf.toString('latin1');

  // 2.1 %PDF-1.4 Header check
  const header = latinStr.slice(0, 9);
  assertEqual(header, '%PDF-1.4\n', `${testPrefix}.1 [${sourceName}] Starts with exact %PDF-1.4\\n header`);

  // 2.2 Binary comment line (high-order bytes to mark binary file)
  const lines = latinStr.split('\n');
  assert(lines[1].startsWith('%'), `${testPrefix}.2 [${sourceName}] Line 2 is a binary comment`);

  // 2.3 Trailer & startxref structure
  const startxrefMatch = latinStr.match(/startxref\s*\n\s*(\d+)\s*\n\s*%%EOF/);
  assert(Boolean(startxrefMatch), `${testPrefix}.3 [${sourceName}] Trailer contains valid startxref and ends with %%EOF`);
  const declaredStartXref = startxrefMatch ? parseInt(startxrefMatch[1], 10) : -1;

  // 2.4 Actual xref offset match
  const actualXrefOffset = buf.indexOf(Buffer.from('xref\n'));
  assertEqual(declaredStartXref, actualXrefOffset, `${testPrefix}.4 [${sourceName}] startxref points to exact byte offset of xref table`);

  // 2.5 Object Count in xref table
  const xrefHeaderMatch = latinStr.slice(actualXrefOffset).match(/^xref\s*\n\s*0\s+(\d+)/);
  assert(Boolean(xrefHeaderMatch), `${testPrefix}.5 [${sourceName}] xref table has valid '0 N' subsection header`);
  const objCount = xrefHeaderMatch ? parseInt(xrefHeaderMatch[1], 10) : 0;
  assertEqual(objCount, 7, `${testPrefix}.6 [${sourceName}] xref table declares exactly 7 objects (0 to 6)`);

  // 2.6 Exact byte offsets for each object (1 to 6)
  const xrefLines = latinStr.slice(actualXrefOffset).split('\n');
  for (let objIdx = 1; objIdx < objCount; objIdx++) {
    // In xref table: line 0 is 'xref', line 1 is '0 N', line 2 is object 0 (0000000000 65535 f)
    // Line objIdx + 2 is object objIdx
    const entryLine = xrefLines[objIdx + 2];
    assert(Boolean(entryLine), `${testPrefix}.7.${objIdx}a [${sourceName}] xref entry exists for object ${objIdx}`);
    const reportedOffset = parseInt(entryLine.slice(0, 10), 10);
    const target = `${objIdx} 0 obj`;
    const actualObjOffset = buf.indexOf(Buffer.from(target));
    assertEqual(reportedOffset, actualObjOffset, `${testPrefix}.7.${objIdx}b [${sourceName}] Object ${objIdx} xref offset matches exact byte offset`);

    // Verification of PDF 1.4 section 3.4.3: entry is exactly 20 bytes long
    const rawLine = entryLine + '\n';
    assertEqual(rawLine.length, 20, `${testPrefix}.7.${objIdx}c [${sourceName}] Object ${objIdx} xref entry is exactly 20 bytes long`);
  }

  // 2.7 Stream /Length verification for Object 4
  const streamStart = buf.indexOf(Buffer.from('stream\n')) + 7;
  const streamEnd = buf.indexOf(Buffer.from('\nendstream'));
  const actualStreamLength = streamEnd - streamStart;
  const lengthMatch = latinStr.match(/4 0 obj\s*<<\s*\/Length\s+(\d+)\s*>>/);
  const declaredStreamLength = lengthMatch ? parseInt(lengthMatch[1], 10) : -1;
  assertEqual(declaredStreamLength, actualStreamLength, `${testPrefix}.8 [${sourceName}] Object 4 /Length matches exact stream byte span`);

  // 2.8 PDF Syntax: No unbalanced unescaped parentheses in text strings
  const textMatches = latinStr.match(/\((.*?)\)\s+Tj/g) || [];
  for (let i = 0; i < textMatches.length; i++) {
    const tjContent = textMatches[i];
    const raw = tjContent.slice(1, -4);
    let parenDepth = 0;
    let isEscaped = false;
    let balanced = true;
    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c];
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (ch === '\\') {
        isEscaped = true;
        continue;
      }
      if (ch === '(') parenDepth++;
      if (ch === ')') parenDepth--;
      if (parenDepth < 0) {
        balanced = false;
        break;
      }
    }
    if (parenDepth !== 0) balanced = false;
    assert(balanced, `${testPrefix}.9 [${sourceName}] Tj string #${i} has balanced/escaped parentheses: ${JSON.stringify(raw.slice(0, 30))}`);
  }
}

// 2.A Standard Receipt PDF Verification (Client & Server)
const standardReceipt = createRentReceipt({
  landlord: { id: 'l1', name: 'Mario Rossi', taxCode: 'RSSMRA80A01H501Z', address: 'Via Roma 10, Milano' },
  tenant: { id: 't1', name: 'Luigi Verdi', taxCode: 'VRDLGU85M01H501Y' },
  property: { id: 'p1', name: 'Appartamento Sole', address: 'Via Milano 20' },
  paymentRecord: { id: 'pmt1', year: 2026, month: 0, income: 750 },
  taxRegime: 'ORDINARIO',
  notes: 'Note ordinarie'
});

const standardClientBuf = Buffer.from(generateReceiptPdf(standardReceipt));
const standardServerBuf = serverBuildPdfBuffer(standardReceipt);
verifyPdfByteIntegrity(standardClientBuf, '2.A_Client', 'receiptPdfService (standard)');
verifyPdfByteIntegrity(standardServerBuf, '2.A_Server', 'server.js (standard)');

// 2.B Italian Accented Characters Verification (à, è, é, ì, ò, ù, À, È, É, Ì, Ò, Ù)
const accentedReceipt = createRentReceipt({
  landlord: { id: 'l1', name: 'Nicolò D’Amicò (Proprietà)', taxCode: 'RSSMRA80A01H501Z', address: 'Piazza Libertà n. 3, Forlì' },
  tenant: { id: 't1', name: 'Società Agricola Più & Giù s.r.l.', taxCode: 'VRDLGU85M01H501Y' },
  property: { id: 'p1', name: 'Cascina San Donato (Città: Cantù)', address: 'Via Gesù e Maria n. 15' },
  paymentRecord: { id: 'pmt1', year: 2026, month: 1, income: 1200 },
  taxRegime: 'CEDOLARE_SECCA',
  notes: 'Canone saldato per intero: caffè, tè e varie.'
});

const accentedClientBuf = Buffer.from(generateReceiptPdf(accentedReceipt));
const accentedServerBuf = serverBuildPdfBuffer(accentedReceipt);
verifyPdfByteIntegrity(accentedClientBuf, '2.B_Client', 'receiptPdfService (accented)');
verifyPdfByteIntegrity(accentedServerBuf, '2.B_Server', 'server.js (accented)');

// 2.C Complex Parentheses and Backslashes in Names
const complexStringReceipt = createRentReceipt({
  landlord: { id: 'l1', name: 'Studio Legale (Avv. Rossi (Junior))', taxCode: 'RSSMRA80A01H501Z', address: 'Corso (Vecchia Stazione) n. 1/A' },
  tenant: { id: 't1', name: 'Conduttore (Speciale) (Privato)', taxCode: 'VRDLGU85M01H501Y' },
  property: { id: 'p1', name: 'Immobile (Interno 4 - scala B (sottotetto))', address: 'Via (Nuova) \\ Strada C:\\Test' },
  paymentRecord: { id: 'pmt1', year: 2026, month: 2, income: 800 },
  taxRegime: 'ORDINARIO',
  notes: 'Bonifico con note: ((Doppie parentesi)) e backslash \\ e chiusa ) solitaria.'
});

const complexClientBuf = Buffer.from(generateReceiptPdf(complexStringReceipt));
const complexServerBuf = serverBuildPdfBuffer(complexStringReceipt);
verifyPdfByteIntegrity(complexClientBuf, '2.C_Client', 'receiptPdfService (parens & backslashes)');
verifyPdfByteIntegrity(complexServerBuf, '2.C_Server', 'server.js (parens & backslashes)');

// 2.D Unclosed and Raw Parentheses in Name Fields
const unclosedParenReceipt = createRentReceipt({
  landlord: { id: 'l1', name: 'Rossi (Unclosed left paren', taxCode: 'RSSMRA80A01H501Z', address: 'Address with ) unclosed right paren' },
  tenant: { id: 't1', name: 'Tenant with )) (( mixed parens', taxCode: 'VRDLGU85M01H501Y' },
  property: { id: 'p1', name: 'Property with trailing backslash\\', address: 'Address with multiple \\\\\\ backslashes' },
  paymentRecord: { id: 'pmt1', year: 2026, month: 3, income: 900 },
  taxRegime: 'ORDINARIO'
});

const unclosedClientBuf = Buffer.from(generateReceiptPdf(unclosedParenReceipt));
const unclosedServerBuf = serverBuildPdfBuffer(unclosedParenReceipt);
verifyPdfByteIntegrity(unclosedClientBuf, '2.D_Client', 'receiptPdfService (adversarial parens)');
verifyPdfByteIntegrity(unclosedServerBuf, '2.D_Server', 'server.js (adversarial parens)');

// 2.E Native Commercial Engine Verification via macOS PDFKit (Quartz)
console.log('  Testing Native PDF Document Rendering via macOS PDFKit:');
const clientPdfPath = path.join(SCRATCH_DIR, 'adversarial_client.pdf');
const serverPdfPath = path.join(SCRATCH_DIR, 'adversarial_server.pdf');
fs.writeFileSync(clientPdfPath, accentedClientBuf);
fs.writeFileSync(serverPdfPath, accentedServerBuf);

const escapedClientPath = clientPdfPath.replace(/'/g, "\\'");
const escapedServerPath = serverPdfPath.replace(/'/g, "\\'");

const jxaScript = `
  ObjC.import('PDFKit');
  ObjC.import('Foundation');

  function evalDoc(filePath) {
    var url = $.NSURL.fileURLWithPath(filePath);
    var doc = $.PDFDocument.alloc.initWithURL(url);
    if (!doc) return { success: false, error: 'Init failed' };
    var pageCount = Number(doc.pageCount);
    var page = doc.pageAtIndex(0);
    if (!page) return { success: false, error: 'Page 0 failed' };
    var bounds = page.boundsForBox($.kPDFDisplayBoxMediaBox);
    var text = page.string ? ObjC.unwrap(page.string) : '';
    return {
      success: true,
      pageCount: pageCount,
      width: bounds.size.width,
      height: bounds.size.height,
      textLength: text.length
    };
  }

  var c = evalDoc('${escapedClientPath}');
  var s = evalDoc('${escapedServerPath}');
  JSON.stringify({ client: c, server: s });
`;

const jxaRes = spawnSync('osascript', ['-l', 'JavaScript', '-e', jxaScript], { encoding: 'utf8' });
if (jxaRes.status === 0 && jxaRes.stdout.trim()) {
  const parsed = JSON.parse(jxaRes.stdout.trim());
  assertEqual(parsed.client.success, true, '2.E.1 macOS Quartz PDFKit successfully renders client-generated PDF');
  assertEqual(parsed.client.pageCount, 1, '2.E.2 Client PDF has exactly 1 page');
  assertEqual(parsed.client.width, 595.28, '2.E.3 Client PDF width matches exact A4 width (595.28 pt)');
  assertEqual(parsed.client.height, 841.89, '2.E.4 Client PDF height matches exact A4 height (841.89 pt)');
  assert(parsed.client.textLength > 500, '2.E.5 Client PDF renders text stream cleanly (textLength > 500 chars)');

  assertEqual(parsed.server.success, true, '2.E.6 macOS Quartz PDFKit successfully renders server-generated PDF');
  assertEqual(parsed.server.pageCount, 1, '2.E.7 Server PDF has exactly 1 page');
  assertEqual(parsed.server.width, 595.28, '2.E.8 Server PDF width matches exact A4 width (595.28 pt)');
  assertEqual(parsed.server.height, 841.89, '2.E.9 Server PDF height matches exact A4 height (841.89 pt)');
} else {
  console.log('  ⚠️ PDFKit check skipped (osascript unavailable or not macOS)');
}

// ============================================================================
// SUITE 3: ITALIAN STAMP DUTY BOUNDARY (€77.47 vs €77.48)
// ============================================================================
console.log('\n─── SUITE 3: ITALIAN STAMP DUTY BOUNDARY (€77.47 vs €77.48) ───');

// 3.1 ORDINARIO Regime Boundary Test Matrix
const ord0 = evaluateStampDuty('ORDINARIO', 0.00);
assertEqual(ord0.applied, false, '3.1.1 ORDINARIO €0.00: stamp duty NOT applied');
assertEqual(ord0.amount, 0, '3.1.2 ORDINARIO €0.00: stamp duty amount = 0');

const ord50 = evaluateStampDuty('ORDINARIO', 50.00);
assertEqual(ord50.applied, false, '3.1.3 ORDINARIO €50.00: stamp duty NOT applied');

const ord77_46 = evaluateStampDuty('ORDINARIO', 77.46);
assertEqual(ord77_46.applied, false, '3.1.4 ORDINARIO €77.46: stamp duty NOT applied');

// Exact Legal Threshold: €77.47 (Art. 13 DPR 642/1972)
const ord77_47 = evaluateStampDuty('ORDINARIO', 77.47);
assertEqual(ord77_47.applied, false, '3.1.5 ORDINARIO €77.47 EXACT: stamp duty NOT applied (fino a 77,47 euro è esente)');
assertEqual(ord77_47.amount, 0, '3.1.6 ORDINARIO €77.47 EXACT: amount = 0');
assert(ord77_47.clause.includes('non superiore a Euro 77,47'), '3.1.7 ORDINARIO €77.47 clause cites non superiore a Euro 77,47');

// Micro float threshold: 77.47000000000001
const ord77_47_float = evaluateStampDuty('ORDINARIO', 77.47000000000001);
assertEqual(ord77_47_float.applied, true, '3.1.8 ORDINARIO 77.47000000000001: strict > 77.47 evaluates true');

// First Cent Above Threshold: €77.48
const ord77_48 = evaluateStampDuty('ORDINARIO', 77.48);
assertEqual(ord77_48.applied, true, '3.1.9 ORDINARIO €77.48 (first cent above threshold): stamp duty APPLIED');
assertEqual(ord77_48.amount, 2.00, '3.1.10 ORDINARIO €77.48: stamp duty amount = 2.00');
assert(ord77_48.clause.includes('Euro 2,00'), '3.1.11 ORDINARIO €77.48 clause mentions Euro 2,00');
assert(ord77_48.clause.includes('DPR 642/1972'), '3.1.12 ORDINARIO €77.48 clause cites DPR 642/1972');

const ord1500 = evaluateStampDuty('ORDINARIO', 1500.00);
assertEqual(ord1500.applied, true, '3.1.13 ORDINARIO €1500.00: stamp duty APPLIED');
assertEqual(ord1500.amount, 2.00, '3.1.14 ORDINARIO €1500.00: amount = 2.00');

// 3.2 CEDOLARE_SECCA Regime (Exempt from Stamp Duty ex Art. 3 D.Lgs. 23/2011)
const ced0 = evaluateStampDuty('CEDOLARE_SECCA', 0.00);
assertEqual(ced0.applied, false, '3.2.1 CEDOLARE_SECCA €0.00: stamp duty NOT applied');

const ced77_47 = evaluateStampDuty('CEDOLARE_SECCA', 77.47);
assertEqual(ced77_47.applied, false, '3.2.2 CEDOLARE_SECCA €77.47: stamp duty NOT applied');

const ced77_48 = evaluateStampDuty('CEDOLARE_SECCA', 77.48);
assertEqual(ced77_48.applied, false, '3.2.3 CEDOLARE_SECCA €77.48: stamp duty NOT applied (cedolare secca is unconditionally exempt)');
assertEqual(ced77_48.amount, 0, '3.2.4 CEDOLARE_SECCA €77.48: amount = 0');
assert(ced77_48.clause.includes('D.Lgs. 23/2011'), '3.2.5 CEDOLARE_SECCA clause cites D.Lgs. 23/2011');

const ced5000 = evaluateStampDuty('CEDOLARE_SECCA', 5000.00);
assertEqual(ced5000.applied, false, '3.2.6 CEDOLARE_SECCA €5000.00: stamp duty NOT applied');
assertEqual(ced5000.amount, 0, '3.2.7 CEDOLARE_SECCA €5000.00: amount = 0');

// 3.3 ESENTE Regime
const ese1000 = evaluateStampDuty('ESENTE', 1000.00);
assertEqual(ese1000.applied, false, '3.3.1 ESENTE €1000.00: stamp duty NOT applied');
assertEqual(ese1000.amount, 0, '3.3.2 ESENTE €1000.00: amount = 0');

// 3.4 Edge & Negative Amounts
const negAmount = evaluateStampDuty('ORDINARIO', -100.00);
assertEqual(negAmount.applied, false, '3.4.1 Negative amount -€100: stamp duty NOT applied');

const defaultRegime = evaluateStampDuty(undefined, 800.00);
assertEqual(defaultRegime.applied, false, '3.4.2 Undefined regime defaults safely to CEDOLARE_SECCA (amount = 0)');

// 3.5 Server-side Stamp Clause Consistency in server.js
const serverPdfOrd77_47 = serverBuildPdfBuffer({
  formattedNumber: '1/2026',
  totalAmount: 77.47,
  taxRegime: 'ORDINARIO',
  issueDate: '2026-03-01'
}).toString('latin1');
assert(serverPdfOrd77_47.includes('Esente da imposta di bollo'), '3.5.1 Server PDF at €77.47 ORDINARIO includes exemption clause');

const serverPdfOrd77_48 = serverBuildPdfBuffer({
  formattedNumber: '2/2026',
  totalAmount: 77.48,
  taxRegime: 'ORDINARIO',
  issueDate: '2026-03-01'
}).toString('latin1');
assert(serverPdfOrd77_48.includes('Imposta di bollo di Euro 2,00'), '3.5.2 Server PDF at €77.48 ORDINARIO includes €2,00 stamp duty clause');

const serverPdfCed5000 = serverBuildPdfBuffer({
  formattedNumber: '3/2026',
  totalAmount: 5000.00,
  taxRegime: 'CEDOLARE_SECCA',
  issueDate: '2026-03-01'
}).toString('latin1');
assert(serverPdfCed5000.includes('Operazione soggetta a cedolare secca'), '3.5.3 Server PDF at €5000 CEDOLARE_SECCA includes cedolare secca clause');

// ============================================================================
// SUITE 4: LEAP YEAR RENT DUE DATE CALCULATION (FEBRUARY 29)
// ============================================================================
console.log('\n─── SUITE 4: LEAP YEAR RENT DUE DATE CALCULATION (FEBRUARY 29) ───');

// 4.1 Gregorian Leap Year Algorithm (divisible by 4, not 100 unless 400)
// Standard leap years
assertEqual(isLeapYear(2024), true, '4.1.1 2024 is a leap year (divisible by 4)');
assertEqual(isLeapYear(2028), true, '4.1.2 2028 is a leap year (divisible by 4)');
assertEqual(isLeapYear(2032), true, '4.1.3 2032 is a leap year (divisible by 4)');
// Century leap years
assertEqual(isLeapYear(2000), true, '4.1.4 2000 is a leap year (divisible by 400)');
assertEqual(isLeapYear(2400), true, '4.1.5 2400 is a leap year (divisible by 400)');
// Standard common years
assertEqual(isLeapYear(2025), false, '4.1.6 2025 is a common year (not divisible by 4)');
assertEqual(isLeapYear(2026), false, '4.1.7 2026 is a common year (not divisible by 4)');
assertEqual(isLeapYear(2027), false, '4.1.8 2027 is a common year (not divisible by 4)');
// Secular common years (century divisible by 100 but NOT 400)
assertEqual(isLeapYear(1900), false, '4.1.9 1900 is NOT a leap year (divisible by 100 but not 400)');
assertEqual(isLeapYear(2100), false, '4.1.10 2100 is NOT a leap year (divisible by 100 but not 400)');
assertEqual(isLeapYear(2200), false, '4.1.11 2200 is NOT a leap year (divisible by 100 but not 400)');
assertEqual(isLeapYear(2300), false, '4.1.12 2300 is NOT a leap year (divisible by 100 but not 400)');

// 4.2 Days in Month for February (month index 1)
assertEqual(getDaysInMonth(2024, 1), 29, '4.2.1 February 2024 has 29 days');
assertEqual(getDaysInMonth(2028, 1), 29, '4.2.2 February 2028 has 29 days');
assertEqual(getDaysInMonth(2000, 1), 29, '4.2.3 February 2000 has 29 days');
assertEqual(getDaysInMonth(2400, 1), 29, '4.2.4 February 2400 has 29 days');
assertEqual(getDaysInMonth(2025, 1), 28, '4.2.5 February 2025 has 28 days');
assertEqual(getDaysInMonth(2026, 1), 28, '4.2.6 February 2026 has 28 days');
assertEqual(getDaysInMonth(2100, 1), 28, '4.2.7 February 2100 has 28 days');
assertEqual(getDaysInMonth(1900, 1), 28, '4.2.8 February 1900 has 28 days');

// 4.3 Due Date Calculation when rentDueDay = 29
// In leap years, February 29 is valid and preserved:
assertEqual(calculateDueDate(2024, 1, 29), '2024-02-29', '4.3.1 In 2024 (leap), rentDueDay 29 -> 2024-02-29');
assertEqual(calculateDueDate(2028, 1, 29), '2028-02-29', '4.3.2 In 2028 (leap), rentDueDay 29 -> 2028-02-29');
assertEqual(calculateDueDate(2000, 1, 29), '2000-02-29', '4.3.3 In 2000 (leap), rentDueDay 29 -> 2000-02-29');

// In common years, February 29 clamps to February 28:
assertEqual(calculateDueDate(2025, 1, 29), '2025-02-28', '4.3.4 In 2025 (common), rentDueDay 29 clamps to 2025-02-28');
assertEqual(calculateDueDate(2026, 1, 29), '2026-02-28', '4.3.5 In 2026 (common), rentDueDay 29 clamps to 2026-02-28');
assertEqual(calculateDueDate(2100, 1, 29), '2100-02-28', '4.3.6 In 2100 (secular non-leap), rentDueDay 29 clamps to 2100-02-28');

// 4.4 Due Date Calculation when rentDueDay = 30 or 31 (end of month)
assertEqual(calculateDueDate(2024, 1, 30), '2024-02-29', '4.4.1 In 2024 (leap), rentDueDay 30 clamps to 2024-02-29');
assertEqual(calculateDueDate(2024, 1, 31), '2024-02-29', '4.4.2 In 2024 (leap), rentDueDay 31 clamps to 2024-02-29');
assertEqual(calculateDueDate(2025, 1, 30), '2025-02-28', '4.4.3 In 2025 (common), rentDueDay 30 clamps to 2025-02-28');
assertEqual(calculateDueDate(2025, 1, 31), '2025-02-28', '4.4.4 In 2025 (common), rentDueDay 31 clamps to 2025-02-28');
assertEqual(calculateDueDate(2100, 1, 31), '2100-02-28', '4.4.5 In 2100 (common), rentDueDay 31 clamps to 2100-02-28');

// 4.5 Due Date Calculation when rentDueDay = 28
assertEqual(calculateDueDate(2024, 1, 28), '2024-02-28', '4.5.1 In 2024 (leap), rentDueDay 28 remains 2024-02-28');
assertEqual(calculateDueDate(2025, 1, 28), '2025-02-28', '4.5.2 In 2025 (common), rentDueDay 28 remains 2025-02-28');

// 4.6 12-Month Calendar Clamping Matrix for rentDueDay = 31
const months31Days = [0, 2, 4, 6, 7, 9, 11]; // Jan, Mar, May, Jul, Aug, Oct, Dec
const months30Days = [3, 5, 8, 10]; // Apr, Jun, Sep, Nov
for (const m of months31Days) {
  const dueStr = calculateDueDate(2026, m, 31);
  const expectedDay = '31';
  assertEqual(dueStr.slice(-2), expectedDay, `4.6.31 Month ${m + 1} with 31 days keeps 31`);
}
for (const m of months30Days) {
  const dueStr = calculateDueDate(2026, m, 31);
  const expectedDay = '30';
  assertEqual(dueStr.slice(-2), expectedDay, `4.6.30 Month ${m + 1} with 30 days clamps 31 to 30`);
}

// 4.7 High-level getRentDueDate API with Property and Tenant Entities
const propLeap = {
  id: 'p_leap',
  name: 'Villa Bisestile',
  currentTenantId: 't_leap',
  financials: { monthlyRent: 1500, rentDueDay: 5 }
};
const tenantLeap = {
  id: 't_leap',
  name: 'Tenant Bisestile',
  rentDueDay: 29
};

assertEqual(
  getRentDueDate(propLeap, tenantLeap, 2024, 1),
  '2024-02-29',
  '4.7.1 getRentDueDate(prop, tenant, 2024, 1) returns 2024-02-29'
);
assertEqual(
  getRentDueDate(propLeap, tenantLeap, 2025, 1),
  '2025-02-28',
  '4.7.2 getRentDueDate(prop, tenant, 2025, 1) returns 2025-02-28'
);
assertEqual(
  getRentDueDate(propLeap, tenantLeap, 2100, 1),
  '2100-02-28',
  '4.7.3 getRentDueDate(prop, tenant, 2100, 1) returns 2100-02-28'
);

// 4.8 Robustness on Out-of-bounds rentDueDay values
assertEqual(getEffectiveRentDueDay(undefined), 5, '4.8.1 undefined rentDueDay defaults to 5');
assertEqual(getEffectiveRentDueDay(null), 5, '4.8.2 null rentDueDay defaults to 5');
assertEqual(getEffectiveRentDueDay(NaN), 5, '4.8.3 NaN rentDueDay defaults to 5');
assertEqual(getEffectiveRentDueDay(0), 5, '4.8.4 0 rentDueDay (< 1) defaults to 5');
assertEqual(getEffectiveRentDueDay(-12), 5, '4.8.5 negative rentDueDay defaults to 5');
assertEqual(getEffectiveRentDueDay(32), 5, '4.8.6 rentDueDay > 31 defaults to 5');
assertEqual(getEffectiveRentDueDay(15.9), 15, '4.8.7 floating rentDueDay truncates to 15');

// 4.9 Calendar Countdown across Leap Day (2024-02-29)
const dueLeap = '2024-02-29';
assertEqual(calculateDaysUntilDue(dueLeap, '2024-02-28'), 1, '4.9.1 On 2024-02-28, days until 2024-02-29 is +1 (due tomorrow)');
assertEqual(calculateDaysUntilDue(dueLeap, '2024-02-29'), 0, '4.9.2 On 2024-02-29, days until 2024-02-29 is 0 (due today)');
assertEqual(calculateDaysUntilDue(dueLeap, '2024-03-01'), -1, '4.9.3 On 2024-03-01, days until 2024-02-29 is -1 (1 day overdue)');
assertEqual(calculateDaysUntilDue(dueLeap, '2024-02-01'), 28, '4.9.4 On 2024-02-01, days until 2024-02-29 is +28');

// 4.10 Rent Status Engine Evaluation on and across Leap Day
const statusDueDay = calculateRentStatus({
  property: propLeap,
  tenant: tenantLeap,
  rentalRecords: [],
  year: 2024,
  month: 1,
  referenceDate: '2024-02-29',
  reminderAdvanceDays: 5
});
assertEqual(statusDueDay.status, 'IN_SCADENZA', '4.10.1 On leap day (2024-02-29), status is IN_SCADENZA');
assertEqual(statusDueDay.daysUntilDue, 0, '4.10.2 On leap day, daysUntilDue = 0');
assertEqual(statusDueDay.dueDate, '2024-02-29', '4.10.3 Status item dueDate is 2024-02-29');

const statusOverdue = calculateRentStatus({
  property: propLeap,
  tenant: tenantLeap,
  rentalRecords: [],
  year: 2024,
  month: 1,
  referenceDate: '2024-03-01',
  reminderAdvanceDays: 5
});
assertEqual(statusOverdue.status, 'SCADUTO', '4.10.4 On the day after leap day (2024-03-01), unpaid rent transitions to SCADUTO');
assertEqual(statusOverdue.daysUntilDue, -1, '4.10.5 daysUntilDue is -1');

// ============================================================================
// SUITE SUMMARY & VERDICT
// ============================================================================
console.log('\n============================================================================');
console.log('       ADVERSARIAL SUITE EXECUTION SUMMARY');
console.log('============================================================================');
console.log(`  Total Assertions Checked : ${totalAssertions}`);
console.log(`  Passed Assertions        : ${passedAssertions}`);
console.log(`  Failed Assertions        : ${failedAssertions}`);

if (failedAssertions > 0) {
  console.log('\n❌ ADVERSARIAL FAILURES DETECTED:');
  failureDetails.forEach(f => console.log(`  ${f}`));
  process.exit(1);
} else {
  console.log('\n✨ ALL ADVERSARIAL CHALLENGES CONFIRMED AND VERIFIED WITH 100% SUCCESS!');
  process.exit(0);
}
