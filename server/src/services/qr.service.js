import crypto from 'node:crypto';
import { config } from '../config/env.js';

// Worker ID card codes: MP1.<workerId>.<card version>.<signature>. The signature is a truncated
// HMAC-SHA256 under a server secret, so cards cannot be forged; replacing a lost card bumps the
// version, which makes the old card's code stop working.
const PREFIX = 'MP1';
const SIGNATURE_LENGTH = 16; // 96 bits of base64url
const CODE = /^MP1\.([a-f0-9]{24})\.([1-9]\d{0,5})\.([A-Za-z0-9_-]{16})$/;

const signature = (workerId, version) =>
  crypto
    .createHmac('sha256', config.qrSecret)
    .update(`${PREFIX}.${workerId}.${version}`)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH);

export const signWorkerCode = (workerId, version) =>
  `${PREFIX}.${workerId}.${version}.${signature(String(workerId), version)}`;

// Returns { workerId, version } for a genuine card code, or null for anything else.
export function readWorkerCode(code) {
  const match = typeof code === 'string' && CODE.exec(code.trim());
  if (!match) return null;
  const [, workerId, versionText, given] = match;
  const version = Number(versionText);
  const expected = signature(workerId, version);
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ? { workerId, version }
    : null;
}
