import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const pubkey = await getSessionFromRequest(request);
  if (!pubkey) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.pubkey, pubkey),
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    pubkey: user.pubkey,
    tier: user.tier,
    createdAt: user.createdAt,
  });
}
