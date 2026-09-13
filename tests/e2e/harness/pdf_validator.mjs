// tests/e2e/harness/pdf_validator.mjs
// Zero-dependency pure Vector PDF 1.4 syntax and structural validator

export class PdfValidator {
  /**
   * Validates that the provided buffer is a compliant Vector PDF 1.4 document.
   * @param {Buffer | Uint8Array} buffer 
   * @returns {{ isValid: boolean, version: string, objectCount: number, errors: string[], extractedTexts: string[] }}
   */
  static validate(buffer) {
    const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const content = raw.toString('binary');
    const errors = [];
    const extractedTexts = [];

    // 1. Magic Header Verification
    if (!content.startsWith('%PDF-1.')) {
      errors.push(`Invalid PDF header: expected "%PDF-1.", found "${content.slice(0, 8)}"`);
    }
    const versionMatch = content.match(/^%PDF-(1\.[0-7])/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    // 2. Trailer and EOF Verification
    if (!content.includes('%%EOF')) {
      errors.push('Missing "%%EOF" end-of-file marker');
    }
    if (!content.includes('trailer')) {
      errors.push('Missing "trailer" dictionary');
    }
    if (!content.includes('startxref')) {
      errors.push('Missing "startxref" pointer');
    }

    // 3. XREF Table Verification
    if (!content.includes('xref')) {
      errors.push('Missing "xref" cross-reference table');
    }

    // 4. Object Structures
    const objects = content.match(/\d+\s+0\s+obj/g) || [];
    if (objects.length < 3) {
      errors.push(`Insufficient PDF objects: found ${objects.length}, expected >= 4`);
    }

    if (!content.includes('/Type /Catalog') && !content.includes('/Type/Catalog')) {
      errors.push('Missing Document Catalog (/Type /Catalog)');
    }
    if (!content.includes('/Type /Pages') && !content.includes('/Type/Pages')) {
      errors.push('Missing Pages Tree (/Type /Pages)');
    }
    if (!content.includes('/Type /Page') && !content.includes('/Type/Page')) {
      errors.push('Missing Page Object (/Type /Page)');
    }
    if (!content.includes('/Type /Font') && !content.includes('/Type/Font')) {
      errors.push('Missing Font definition (/Type /Font)');
    }
    if (!content.includes('stream') || !content.includes('endstream')) {
      errors.push('Missing Content stream (stream ... endstream)');
    }

    // 5. Vector Graphics and Text Operators Verification
    const hasTextBlocks = content.includes('BT') && content.includes('ET');
    if (!hasTextBlocks) {
      errors.push('Missing text rendering blocks (BT ... ET)');
    }

    // Extract text strings from (string) Tj or [ (string) ] TJ
    const tjMatches = content.matchAll(/\(((?:\\\(|\\\)|[^)])*)\)\s*Tj/g);
    for (const m of tjMatches) {
      extractedTexts.push(m[1].replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\'));
    }

    const tjArrayMatches = content.matchAll(/\[([^\]]*)\]\s*TJ/g);
    for (const m of tjArrayMatches) {
      const inner = m[1];
      const innerTexts = inner.matchAll(/\(([^)]*)\)/g);
      for (const im of innerTexts) {
        extractedTexts.push(im[1]);
      }
    }

    return {
      isValid: errors.length === 0,
      version,
      objectCount: objects.length,
      errors,
      extractedTexts,
      fullTextContent: extractedTexts.join(' ')
    };
  }

  /**
   * Asserts that the PDF contains specific mandatory text keywords.
   * @param {Buffer | Uint8Array} buffer 
   * @param {string[]} requiredKeywords 
   */
  static assertContainsKeywords(buffer, requiredKeywords) {
    const res = this.validate(buffer);
    if (!res.isValid) {
      throw new Error(`PDF validation failed: ${res.errors.join('; ')}`);
    }
    const allText = res.fullTextContent;
    for (const kw of requiredKeywords) {
      if (!allText.includes(kw)) {
        throw new Error(`PDF missing mandatory keyword "${kw}". Extracted text:\n${allText.slice(0, 500)}...`);
      }
    }
    return true;
  }
}
