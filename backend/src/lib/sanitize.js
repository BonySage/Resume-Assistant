import sanitizeHtml from 'sanitize-html';

// NFR-2.4: strip any HTML/script content from free-text user input before it
// is stored or echoed back, independent of the frontend's own escaping.
export function sanitizeText(input) {
  if (typeof input !== 'string') return input;
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}
