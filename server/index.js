import 'dotenv/config';
import { createApp } from './app.js';
import { getDb } from './db/index.js';
import { startFollowUpJob } from './jobs/followup.js';
import { logger } from './lib/logger.js';

getDb();
startFollowUpJob();

const app = createApp();
const PORT = parseInt(process.env.PORT || '8080', 10);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Awaaz AI backend listening');
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY is not set — /api/analyze will return 503');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_TOKEN) {
    logger.warn('ADMIN_TOKEN is not set — admin APIs return 503 until configured');
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    logger.error(
      { port: PORT },
      `Port ${PORT} is already in use. Stop the other process or set a different PORT in .env.`
    );
    process.exit(1);
  }
  throw err;
});
