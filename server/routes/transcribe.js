import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../lib/transcribe.js';
import { logger } from '../lib/logger.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const transcribeRouter = Router();

transcribeRouter.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const reqId = req.id;
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'Voice transcription not configured' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Missing audio file', details: { field: 'audio' } });
    }
    const { language } = req.body || {};
    const transcript = await transcribeAudio(req.file.buffer, req.file.mimetype, language);
    res.json({ transcript, language: language || null, duration: null });
  } catch (err) {
    logger.error({ err, reqId }, 'transcribe failed');
    const msg = err?.message || 'Transcription failed';
    const status = err?.code === 'NO_GROQ' ? 503 : 500;
    res.status(status).json({ error: msg });
  }
});
