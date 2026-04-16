import { z } from 'zod';

export const analyzeSchema = z.object({
  text: z.string().min(10).max(12000),
  language: z.enum(['en', 'ur', 'hi', 'ks']).optional().default('en'),
  sessionId: z.string().uuid().optional(),
  email: z
    .preprocess((v) => (v === '' || v == null ? undefined : v), z.string().email().optional()),
});

export function validateAnalyze(req, res, next) {
  const parsed = analyzeSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten ? parsed.error.flatten() : parsed.error.message,
    });
  }
  req.body = parsed.data;
  next();
}
