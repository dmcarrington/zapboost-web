/**
 * NIP-07 authentication + JWT session management.
 *
 * Flow:
 * 1. Client calls GET /api/auth/challenge to get a random challenge string
 * 2. Client signs the challenge as a kind-27235 event using NIP-07 browser extension
 * 3. Client sends the signed event to POST /api/auth/verify
 * 4. Server verifies the signature and issues a JWT session token
 */

import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';
import { users, sessions } from './db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory challenge store (short-lived, no need for DB)
const challenges = new Map<string, { challenge: string; createdAt: number }>();

export function createChallenge(): string {
  const challenge = crypto.randomUUID();
  challenges.set(challenge, { challenge, createdAt: Date.now() });

  // Clean up old challenges (older than 5 minutes)
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  challenges.forEach((val, key) => {
    if (val.createdAt < fiveMinAgo) challenges.delete(key);
  });

  return challenge;
}

export function validateChallenge(challenge: string): boolean {
  const entry = challenges.get(challenge);
  if (!entry) return false;

  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  if (entry.createdAt < fiveMinAgo) {
    challenges.delete(challenge);
    return false;
  }

  challenges.delete(challenge); // One-time use
  return true;
}

/**
 * Create a JWT session token for an authenticated user.
 * Also ensures the user exists in the database.
 */
export async function createSession(pubkey: string): Promise<string> {
  // Upsert user
  await db.insert(users).values({ pubkey }).onConflictDoNothing();

  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Store session
  await db.insert(sessions).values({
    id: jti,
    pubkey,
    expiresAt,
  });

  // Issue JWT
  const token = await new SignJWT({ pubkey })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify a JWT session token and return the pubkey.
 */
export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.pubkey || typeof payload.pubkey !== 'string') return null;

    // Verify session still exists in DB
    if (payload.jti) {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, payload.jti),
      });
      if (!session) return null;
      if (new Date(session.expiresAt) < new Date()) return null;
    }

    return payload.pubkey;
  } catch {
    return null;
  }
}

/**
 * Extract and verify the session token from a request's cookies or Authorization header.
 */
export async function getSessionFromRequest(request: Request): Promise<string | null> {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifySession(authHeader.slice(7));
  }

  // Try cookie
  const cookies = request.headers.get('Cookie') || '';
  const tokenMatch = cookies.match(/zapboost_session=([^;]+)/);
  if (tokenMatch) {
    return verifySession(tokenMatch[1]);
  }

  return null;
}
