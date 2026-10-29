import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mammoth from 'mammoth';
import { checkDocxArchive, resumeTooLongError as tooLong } from './docxLimits.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDFJS_DIST_ROOT = path.join(__dirname, '..', '..', 'node_modules', 'pdfjs-dist');
const STANDARD_FONT_DATA_URL = pathToFileURL(path.join(PDFJS_DIST_ROOT, 'standard_fonts') + path.sep).href;
const CMAPS_URL = pathToFileURL(path.join(PDFJS_DIST_ROOT, 'cmaps') + path.sep).href;

// Real resumes are 1-3 pages (~3-8k characters). These caps are generous for
// any resume but stop a small, huge-page-count file from tying up the CPU and
// sending millions of tokens to the AI (security audit #3).
export const MAX_RESUME_PAGES = 20;
export const MAX_RESUME_CHARS = 50_000;

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// True when the file's first bytes match its claimed type: PDFs start with
// "%PDF-", DOCX files are ZIP archives starting with "PK\x03\x04".
export function matchesFileSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimeType === PDF_MIME) return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (mimeType === DOCX_MIME) return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  return false;
}

export async function extractResumeText(buffer, mimeType, filename) {
  const lower = (filename || '').toLowerCase();
  const isPdf = mimeType === PDF_MIME || lower.endsWith('.pdf');
  const isDocx = mimeType === DOCX_MIME || lower.endsWith('.docx');

  let text;
  if (isPdf) {
    text = normalize(await extractPdfText(buffer));
  } else if (isDocx) {
    checkDocxArchive(buffer); // zip-bomb guard: throws before mammoth unpacks anything
    const { value } = await mammoth.extractRawText({ buffer });
    text = normalize(value);
  } else {
    throw new Error('Unsupported file type. Please upload a PDF or DOCX resume.');
  }
  if (text.length > MAX_RESUME_CHARS) {
    throw tooLong(`This resume is too long to analyze. Keep it under ${MAX_RESUME_CHARS.toLocaleString('en-US')} characters (a few pages).`);
  }
  return text;
}

async function extractPdfText(buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: CMAPS_URL,
    cMapPacked: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  try {
    // Checked before reading any page, so an oversized file costs almost nothing.
    if (doc.numPages > MAX_RESUME_PAGES) {
      throw tooLong(`This resume has ${doc.numPages} pages. Upload a resume of ${MAX_RESUME_PAGES} pages or fewer.`);
    }
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let lastY = null;
      for (const item of content.items) {
        const y = item.transform?.[5];
        if (lastY !== null && y !== lastY) text += '\n';
        text += item.str;
        lastY = y;
      }
      text += '\n\n';
    }
    return text;
  } finally {
    await loadingTask.destroy();
  }
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}
