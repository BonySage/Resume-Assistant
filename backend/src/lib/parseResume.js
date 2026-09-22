import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDFJS_DIST_ROOT = path.join(__dirname, '..', '..', 'node_modules', 'pdfjs-dist');
const STANDARD_FONT_DATA_URL = pathToFileURL(path.join(PDFJS_DIST_ROOT, 'standard_fonts') + path.sep).href;
const CMAPS_URL = pathToFileURL(path.join(PDFJS_DIST_ROOT, 'cmaps') + path.sep).href;

export async function extractResumeText(buffer, mimeType, filename) {
  const lower = (filename || '').toLowerCase();
  const isPdf = mimeType === 'application/pdf' || lower.endsWith('.pdf');
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx');

  if (isPdf) {
    return normalize(await extractPdfText(buffer));
  }
  if (isDocx) {
    const { value } = await mammoth.extractRawText({ buffer });
    return normalize(value);
  }
  throw new Error('Unsupported file type. Please upload a PDF or DOCX resume.');
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
