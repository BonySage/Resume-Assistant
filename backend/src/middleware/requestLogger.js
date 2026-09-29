// One line per request: "POST /api/resumes 201 842ms". Health checks are
// skipped so Docker's polling doesn't flood the logs.
export function requestLogger(req, res, next) {
  if (req.path === '/api/health') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
}
