/**
 * AES-256-GCM email encryption — key derived from EMAIL_SECRET
 */

import crypto from 'crypto';

function getKey(secret) {
  if (!secret || typeof secret !== 'string' || secret.length < 8) {
    return null;
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptEmail(plain, secret) {
  if (!plain || !String(plain).trim()) return null;
  const key = getKey(secret);
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain).trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptEmail(ciphertext, secret) {
  if (!ciphertext || typeof ciphertext !== 'string') return null;
  const key = getKey(secret);
  if (!key) return null;
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < 29) return null;
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
