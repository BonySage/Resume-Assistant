import { notFound } from '../errors.js';
import { isValidId } from '../lib/validators.js';

// router.param('id', requireValidId('Resume not found.')): an id that can't
// exist is a 404 before it reaches the database, where a non-integer would
// throw and become a 500. Same message as a real miss, so both look alike.
export function requireValidId(message) {
  return (req, res, next, value) => {
    if (!isValidId(value)) return next(notFound(message));
    next();
  };
}
