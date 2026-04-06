import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

export async function POST(request: Request) {
  // Best-effort delete of the sessions row keyed by the JWT's jti. We read
  // the token from either the cookie or the Authorization header — whichever
  // the caller used at login.
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(/zapboost_session=([^;]+)/);
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieMatch?.[1] || bearer;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload.jti) {
        await db.delete(sessions).where(eq(sessions.id, payload.jti as string));
      }
    } catch {
      // Expired / invalid token — still clear the cookie below.
    }
  }

  const response = NextResponse.json({ ok: true });
  // Clear the httpOnly cookie by setting maxAge: 0
  response.cookies.set('zapboost_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
