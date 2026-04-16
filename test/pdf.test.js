import { describe, it, expect } from 'vitest';
import { generateComplaintPDF } from '../server/lib/pdf.js';

describe('pdf', () => {
  it('generateComplaintPDF returns PDF buffer', async () => {
    const buf = await generateComplaintPDF({
      trackingId: 'AWZ-2026-09999',
      language: 'en',
      severity: 'medium',
      issueType: 'Test',
      department: 'Dept',
      submitTo: 'Office',
      englishLetter: 'Hello',
      urduLetter: 'سلام',
      urdu_letter: undefined,
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});
