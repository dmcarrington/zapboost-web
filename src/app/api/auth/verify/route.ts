import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { validateChallenge, createSession } from '@/lib/auth';
import { verifyEvent } from 'nostr-tools';
import { db } from '@/lib/db';
import { backfillJobs } from '@/lib/db/schema';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signedEvent } = body;

    if (!signedEvent) {
      return NextResponse.json({ error: 'Missing signedEvent' }, { status: 400 });
    }

    // Verify the Nostr event signature
    const isValid = verifyEvent(signedEvent);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid event signature' }, { status: 401 });
    }

    // Check it's a kind 27235 auth event (NIP-98 style)
    if (signedEvent.kind !== 27235) {
      return NextResponse.json({ error: 'Invalid event kind, expected 27235' }, { status: 400 });
    }

    // Validate the challenge is in the event content
    const challenge = signedEvent.content;
    if (!validateChallenge(challenge)) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 });
    }

    // Check the event is recent (within 5 minutes)
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
    if (signedEvent.created_at < fiveMinAgo) {
      return NextResponse.json({ error: 'Event too old' }, { status: 401 });
    }

    // Create session
    const pubkey = signedEvent.pubkey;
    const token = await createSession(pubkey);

    // Enqueue a backfill job so the worker pulls historical zaps for this pubkey.
    // Safe to enqueue on every login — the worker will see recent completed jobs
    // and skip, but the simplest correct version just inserts unconditionally.
    try {
      await db.insert(backfillJobs).values({
        id: randomUUID(),
        pubkey,
        status: 'pending',
      });
    } catch (err) {
      console.error('[auth/verify] Failed to enqueue backfill job:', err);
    }

    const response = NextResponse.json({ token, pubkey });

    // Also set as httpOnly cookie
    response.cookies.set('zapboost_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Auth verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
