import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { zapEvents } from '@/lib/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { pubkey: string } }
) {
  const { pubkey } = params;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const since = url.searchParams.get('since')
    ? parseInt(url.searchParams.get('since')!, 10)
    : undefined;
  const until = url.searchParams.get('until')
    ? parseInt(url.searchParams.get('until')!, 10)
    : undefined;

  try {
    const conditions = [eq(zapEvents.recipientPubkey, pubkey)];
    if (since) conditions.push(gte(zapEvents.timestamp, since));
    if (until) conditions.push(lte(zapEvents.timestamp, until));

    const zaps = await db
      .select({
        id: zapEvents.id,
        postId: zapEvents.postId,
        senderPubkey: zapEvents.senderPubkey,
        amountSats: zapEvents.amountSats,
        timestamp: zapEvents.timestamp,
      })
      .from(zapEvents)
      .where(and(...conditions))
      .orderBy(desc(zapEvents.timestamp))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      pubkey,
      zaps,
      pagination: { limit, offset, count: zaps.length },
    });
  } catch (error) {
    console.error('Zaps API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
