/**
 * Auth utilities — JWT (HS256) and password hashing using Node.js built-ins only.
 *
 * JWT: HMAC-SHA256, base64url encoding per RFC 7519.
 * Passwords: scrypt (Node crypto) with a random 16-byte salt.
 */
import { createHmac, scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// ── JWT ──────────────────────────────────────────────────────────────────────

function base64url(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): string {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

export interface JwtPayload {
  sub: string; // user id
  tenantId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_TTL_SEC = 60 * 60 * 8; // 8 hours

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + DEFAULT_TTL_SEC };
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(full));
  const sig = base64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];

  const expectedSig = base64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());

  // Compare in constant time
  const sigBuf = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expBuf = Buffer.from(expectedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64urlDecode(body)) as JwtPayload;
  } catch {
    return null;
  }

  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

// ── Password hashing ─────────────────────────────────────────────────────────

const SALT_BYTES = 16;
const KEY_BYTES = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const key = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, storedHex] = stored.split(':');
  if (!salt || !storedHex) return false;
  const key = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  const storedBuf = Buffer.from(storedHex, 'hex');
  if (key.length !== storedBuf.length) return false;
  return timingSafeEqual(key, storedBuf);
}

// ── Token extraction helper ──────────────────────────────────────────────────

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  return match ? (match[1] ?? null) : null;
}
