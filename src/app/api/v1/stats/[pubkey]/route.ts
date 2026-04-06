import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { zapEvents, posts } from '@/lib/db/schema';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import { authenticateApiKey } from '@/lib/api-keys';
import { clampDays } from '@/lib/tiers';

export async function GET(
  request: Request,
  { params }: { params: { pubkey: string } }
) {
  const apiKey = await authenticateApiKey(request);
  if (!apiKey) {
    return NextResponse.json({
      error: 'Valid API key required. Pass via X-API-Key header or api_key query parameter.',
    }, { status: 401 });
  }

  const { pubkey } = params;
  const url = new URL(request.url);
  const requestedDays = parseInt(url.searchParams.get('days') || '30', 10);
  const days = clampDays(apiKey.tier, requestedDays);
  const since = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), apiKey.tierConfig.maxTopPosts);

  try {
    const [totals] = await db
      .select({
        totalSats: sql<number>`coalesce(sum(${zapEvents.amountSats}), 0)`,
        totalZaps: sql<number>`count(*)`,
        avgZapSize: sql<number>`coalesce(avg(${zapEvents.amountSats}), 0)`,
        uniqueSenders: sql<number>`count(distinct ${zapEvents.senderPubkey})`,
      })
      .from(zapEvents)
      .where(and(eq(zapEvents.recipientPubkey, pubkey), gte(zapEvents.timestamp, since)));

    const topPosts = await db
      .select({
        postId: zapEvents.postId,
        totalSats: sql<number>`sum(${zapEvents.amountSats})`,
        zapCount: sql<number>`count(*)`,
      })
      .from(zapEvents)
      .where(and(eq(zapEvents.recipientPubkey, pubkey), gte(zapEvents.timestamp, since)))
      .groupBy(zapEvents.postId)
      .orderBy(desc(sql`sum(${zapEvents.amountSats})`))
      .limit(limit);

    const topSupporters = await db
      .select({
        senderPubkey: zapEvents.senderPubkey,
        totalSats: sql<number>`sum(${zapEvents.amountSats})`,
        zapCount: sql<number>`count(*)`,
      })
      .from(zapEvents)
      .where(and(eq(zapEvents.recipientPubkey, pubkey), gte(zapEvents.timestamp, since)))
      .groupBy(zapEvents.senderPubkey)
      .orderBy(desc(sql`sum(${zapEvents.amountSats})`))
      .limit(limit);

    const dailyStats = await db
      .select({
        day: sql<string>`to_char(to_timestamp(${zapEvents.timestamp}), 'YYYY-MM-DD')`,
        totalSats: sql<number>`sum(${zapEvents.amountSats})`,
        zapCount: sql<number>`count(*)`,
      })
      .from(zapEvents)
      .where(and(eq(zapEvents.recipientPubkey, pubkey), gte(zapEvents.timestamp, since)))
      .groupBy(sql`to_char(to_timestamp(${zapEvents.timestamp}), 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(to_timestamp(${zapEvents.timestamp}), 'YYYY-MM-DD')`);

    return NextResponse.json({
      pubkey,
      period: { days, since },
      totals: {
        sats: Number(totals.totalSats),
        zaps: Number(totals.totalZaps),
        avgZapSize: Math.round(Number(totals.avgZapSize)),
        uniqueSupporters: Number(totals.uniqueSenders),
      },
      topPosts,
      topSupporters,
      dailyStats,
    });
  } catch (error) {
    console.error('V1 stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
