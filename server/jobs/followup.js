import { schedule } from 'node-cron';
import { getPendingFollowUps, markFollowUpSent } from '../db/complaints.js';
import { decryptEmail } from '../lib/email-crypto.js';
import { sendFollowUpEmail } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';

export function startFollowUpJob() {
  schedule(
    '30 3 * * *',
    async () => {
      const secret = process.env.EMAIL_SECRET;
      if (!process.env.RESEND_API_KEY)
        return logger.info({ reqId: 'cron' }, 'Follow-up job skipped: RESEND_API_KEY not set');
      if (!secret) return logger.info({ reqId: 'cron' }, 'Follow-up job skipped: EMAIL_SECRET not set');

      try {
        logger.info({ reqId: 'cron' }, 'Running follow-up job');
        const pending = getPendingFollowUps();
        for (const complaint of pending) {
          if (!complaint.emailEncrypted) continue;
          const email = decryptEmail(complaint.emailEncrypted, secret);
          if (!email) {
            logger.error({ trackingId: complaint.trackingId, reqId: 'cron' }, 'Could not decrypt email');
            continue;
          }
          try {
            await sendFollowUpEmail(email, complaint);
            markFollowUpSent(complaint.trackingId);
            logger.info({ trackingId: complaint.trackingId, reqId: 'cron' }, 'Follow-up sent');
          } catch (e) {
            logger.error({ err: e, trackingId: complaint.trackingId, reqId: 'cron' }, 'Follow-up send failed');
          }
        }
      } catch (e) {
        logger.error({ err: e, reqId: 'cron' }, 'Follow-up job error');
      }
    },
    { timezone: 'Etc/UTC' }
  );
}
