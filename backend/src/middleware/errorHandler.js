import multer from 'multer';
import { HttpError, notFound } from '../errors.js';

// Unknown /api/* paths get a JSON 404 instead of Express's HTML page.
export function apiNotFound(req, res, next) {
  next(notFound(`No API route for ${req.method} ${req.originalUrl}.`, { code: 'ROUTE_NOT_FOUND' }));
}

// Maps library errors we know about onto user-safe HttpErrors.
function normalize(err) {
  if (err instanceof HttpError) return err;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return new HttpError(413, 'Resumes must be 10 MB or smaller.', { code: 'FILE_TOO_LARGE' });
    return new HttpError(400, 'That upload could not be read. Try again with a single PDF or DOCX file.', { code: err.code });
  }
  if (err.type === 'entity.parse.failed') return new HttpError(400, 'The request body isn’t valid JSON.', { code: 'INVALID_JSON' });
  if (err.type === 'entity.too.large') return new HttpError(413, 'That request is too large.', { code: 'PAYLOAD_TOO_LARGE' });
  return null;
}

// Last middleware in the chain: every error ends up here as { error, code? }.
// Unexpected errors are logged with details but shown to the user as a plain 500.
// eslint-disable-next-line no-unused-vars -- Express needs the 4-argument signature.
export function errorHandler(err, req, res, next) {
  const known = normalize(err);
  if (!known) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }
  const status = known?.status || 500;
  const body = {
    error: known ? known.message : 'Something went wrong on our side. Please try again.',
    ...(known?.code ? { code: known.code } : {}),
    ...(known?.details || {}),
  };
  if (res.headersSent) return req.socket.destroy();
  res.status(status).json(body);
}
