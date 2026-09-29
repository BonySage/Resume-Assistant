// Throw an HttpError from any route or middleware (sync or async) and the
// central error handler turns it into { error, code, ...details } with the
// right status. Express 5 forwards errors from async handlers automatically.
//
//   if (!resume) throw notFound('Resume not found.');
//   throw new HttpError(422, 'Could not read that file.', { code: 'UNREADABLE_FILE' });
export class HttpError extends Error {
  constructor(status, message, { code, details, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details; // extra JSON fields for the client, e.g. { fallbackToPaste: true }
    this.expose = true; // safe to show `message` to the user
  }
}

export const badRequest = (message = 'Bad request.', opts) => new HttpError(400, message, opts);
export const unauthorized = (message = 'Not authenticated', opts) => new HttpError(401, message, { code: 'NO_SESSION', ...opts });
export const forbidden = (message = 'You don’t have access to that.', opts) => new HttpError(403, message, opts);
export const notFound = (message = 'Not found.', opts) => new HttpError(404, message, opts);
export const conflict = (message = 'That already exists.', opts) => new HttpError(409, message, opts);
export const unprocessable = (message = 'That input could not be processed.', opts) => new HttpError(422, message, opts);
