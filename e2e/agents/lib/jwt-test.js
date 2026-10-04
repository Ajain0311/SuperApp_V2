import crypto from 'node:crypto';
import { loadDotEnv } from './db-verifier.js';

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

/** Signs an already-expired HS256 JWT. The secret is read from JWT_SECRET and never logged. */
export function signExpiredToken(secret, { userId = '1', mobile = '9999999999' } = {}) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': String(userId),
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone': mobile,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'CUSTOMER',
    iss: process.env.JWT_ISSUER || 'SuperApp',
    aud: process.env.JWT_AUDIENCE || 'SuperApp',
    nbf: now - 7200,
    exp: now - 3600,
  }));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function expiredTokenFromEnv() {
  loadDotEnv();
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return signExpiredToken(secret);
}
