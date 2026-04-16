import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function baseUrl() {
  const b = process.env.PUBLIC_BASE_URL || '';
  return b.replace(/\/$/, '') || '';
}

function buildFollowUpEmailHTML(complaint) {
  const tid = complaint.trackingId || '';
  const issue = complaint.issueType || '—';
  const dept = complaint.department || '—';
  const submit = complaint.submitTo || '—';
  const pdfUrl = `${baseUrl()}/api/complaints/${encodeURIComponent(tid)}/pdf`;
  const statusUrl = `${baseUrl()}/#demo`;

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#f4f4f4;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#e8621a;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
      <strong>Awaaz AI</strong> — Follow-up reminder
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
      <p>7 days have passed since you filed complaint <strong>${tid}</strong>.</p>
      <p><strong>Issue:</strong> ${escapeHtml(issue)}<br/>
      <strong>Department:</strong> ${escapeHtml(dept)}<br/>
      <strong>Submit to:</strong> ${escapeHtml(submit)}</p>
      <p>If you haven’t submitted yet, here’s what to do: <strong>${escapeHtml(submit)}</strong></p>
      <p><a href="${pdfUrl}" style="color:#e8621a;">Download your complaint PDF</a></p>
      <p>If you have already submitted, you can update status in the app: <a href="${statusUrl}" style="color:#e8621a;">Open Awaaz AI</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="font-size:12px;color:#888;">You received this because you opted in for a one-time reminder for this complaint. This is not a marketing list.</p>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendFollowUpEmail(to, complaint) {
  if (!resend) {
    throw new Error('Email not configured');
  }
  return resend.emails.send({
    from: 'Awaaz AI <noreply@awaaz-ai.in>',
    to,
    subject: `Follow-up: Your complaint ${complaint.trackingId}`,
    html: buildFollowUpEmailHTML(complaint),
  });
}
