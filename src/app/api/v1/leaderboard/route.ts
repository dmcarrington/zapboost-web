import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { zapEvents } from '@/lib/db/schema';
import { sql, gte, desc } from 'drizzle-orm';
import { authenticateApiKey } from '@/lib/api-keys';

export async function GET(request: Request) {
  const apiKey = await authenticateApiKey(request);
  if (!apiKey) {
    return NextResponse.json({
      error: 'Valid API key required. Pass via X-API-Key header or api_key query parameter.',
    }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '7', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const since = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

  try {
    // Top creators by total sats received in the period
    const leaderboard = await db
      .select({
        pubkey: zapEvents.recipientPubkey,
        totalSats: sql<number>`sum(${zapEvents.amountSats})`.as('total_sats'),
        totalZaps: sql<number>`count(*)`.as('total_zaps'),
        uniqueSupporters: sql<number>`count(distinct ${zapEvents.senderPubkey})`.as('unique_supporters'),
        topPostSats: sql<number>`max(${zapEvents.amountSats})`.as('top_post_sats'),
      })
      .from(zapEvents)
      .where(gte(zapEvents.timestamp, since))
      .groupBy(zapEvents.recipientPubkey)
      .orderBy(desc(sql`sum(${zapEvents.amountSats})`))
      .limit(limit);

    // Calculate velocity (sats per hour over the period)
    const hoursInPeriod = days * 24;
    const enriched = leaderboard.map((entry, i) => ({
      rank: i + 1,
      pubkey: entry.pubkey,
      totalSats: Number(entry.totalSats),
      totalZaps: Number(entry.totalZaps),
      uniqueSupporters: Number(entry.uniqueSupporters),
      satsPerHour: Math.round(Number(entry.totalSats) / hoursInPeriod),
      zapsPerHour: Math.round((Number(entry.totalZaps) / hoursInPeriod) * 100) / 100,
    }));

    return NextResponse.json({
      period: { days, since },
      count: enriched.length,
      leaderboard: enriched,
    });
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
