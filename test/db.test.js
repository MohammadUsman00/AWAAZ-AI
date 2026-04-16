import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../server/db/index.js';
import {
  createComplaint,
  getComplaintByTrackingId,
  listComplaints,
  updateComplaintStatus,
  getStats,
  generateTrackingId,
} from '../server/db/complaints.js';

beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM complaints; DELETE FROM sessions;');
});

describe('complaints db', () => {
  it('createComplaint + getComplaintByTrackingId', () => {
    const tid = generateTrackingId();
    const row = createComplaint({
      trackingId: tid,
      sessionId: '00000000-0000-4000-8000-000000000001',
      language: 'en',
      inputText: 'x'.repeat(12),
      analysis: {
        issue_type: 'Roads',
        department: 'PWD',
        severity: 'high',
        submit_to: 'portal',
        english_letter: 'Letter',
        urdu_letter: 'خط',
        summary: 'Sum',
      },
    });
    expect(row?.trackingId).toBe(tid);
    const got = getComplaintByTrackingId(tid);
    expect(got?.issueType).toBe('Roads');
  });

  it('listComplaints pagination + filters', () => {
    const sid = '00000000-0000-4000-8000-000000000002';
    const t1 = generateTrackingId();
    const t2 = generateTrackingId();
    createComplaint({
      trackingId: t1,
      sessionId: sid,
      language: 'en',
      inputText: 'y'.repeat(15),
      analysis: { issue_type: 'A', severity: 'critical', summary: 's1' },
    });
    createComplaint({
      trackingId: t2,
      sessionId: sid,
      language: 'ur',
      inputText: 'z'.repeat(15),
      analysis: { issue_type: 'B', severity: 'low', summary: 's2' },
    });
    const r = listComplaints({ limit: 1, offset: 0, severity: 'critical' });
    expect(r.total).toBe(1);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].issue_type).toBe('A');
  });

  it('updateComplaintStatus + getStats', () => {
    const tid = generateTrackingId();
    createComplaint({
      trackingId: tid,
      sessionId: '00000000-0000-4000-8000-000000000003',
      language: 'en',
      inputText: 'q'.repeat(12),
      analysis: { issue_type: 'Water', severity: 'critical', summary: 'x' },
    });
    updateComplaintStatus(tid, 'resolved');
    const s = getStats();
    expect(s.total).toBe(1);
    expect(s.resolved_count).toBe(1);
  });
});
