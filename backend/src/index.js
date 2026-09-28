// Server entry point: validate config, start listening, shut down cleanly.
import { config, checkConfig } from './config.js';
import { createApp } from './app.js';
import { pool } from './db.js';

const { errors, warnings } = checkConfig();
warnings.forEach((w) => console.warn(`[config] ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`[config] ${e}`));
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`AI Resume Assistant API listening on http://localhost:${config.port} (${config.env})`);
});

// Docker / Ctrl+C: stop accepting requests, let in-flight ones finish, close the DB pool.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — shutting down…`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // don't hang forever
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
