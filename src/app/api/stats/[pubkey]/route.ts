import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { zapEvents, posts } from '@/lib/db/schema';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import { authenticateRequest } from '@/lib/api-auth';
import { clampDays, getTierConfig } from '@/lib/tiers';

export async function GET(
  request: Request,
  { params }: { params: { pubkey: string } }
) {
  const { pubkey } = params;

  // Authenticate to determine tier (unauthenticated gets free tier limits)
  const auth = await authenticateRequest(request);
  const tier = auth?.tier || 'free';
  const tierConfig = getTierConfig(tier);

  // Parse date range, clamped to tier max
  const url = new URL(request.url);
  const requestedDays = parseInt(url.searchParams.get('days') || '30', 10);
  const days = clampDays(tier, requestedDays);
  const since = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

  try {
    // Total stats for the period
    const [totals] = await db
      .select({
        totalSats: sql<number>`coalesce(sum(${zapEvents.amountSats}), 0)`.as('total_sats'),
        totalZaps: sql<number>`count(*)`.as('total_zaps'),
        avgZapSize: sql<number>`coalesce(avg(${zapEvents.amountSats}), 0)`.as('avg_zap_size'),
        uniqueSenders: sql<number>`count(distinct ${zapEvents.senderPubkey})`.as('unique_senders'),
      })
      .from(zapEvents)
      .where(and(
        eq(zapEvents.recipientPubkey, pubkey),
        gte(zapEvents.timestamp, since),
      ));

    // Top posts by sats (limited by tier)
    const topPosts = await db
      .select({
        postId: zapEvents.postId,
        totalSats: sql<number>`sum(${zapEvents.amountSats})`.as('total_sats'),
        zapCount: sql<number>`count(*)`.as('zap_count'),
      })
      .from(zapEvents)
      .where(and(
        eq(zapEvents.recipientPubkey, pubkey),
        gte(zapEvents.timestamp, since),
      ))
      .groupBy(zapEvents.postId)
      .orderBy(desc(sql`sum(${zapEvents.amountSats})`))
      .limit(tierConfig.maxTopPosts);

    // Enrich top posts with content
    const postIds = topPosts.map((p) => p.postId).filter(Boolean) as string[];
    const postContents = postIds.length > 0
      ? await db.select().from(posts).where(sql`${posts.id} = ANY(${postIds})`)
      : [];

    const postMap = new Map(postContents.map((p) => [p.id, p]));

    const enrichedTopPosts = topPosts.map((p) => ({
      ...p,
      content: p.postId ? postMap.get(p.postId) : null,
    }));

    // Top supporters by total sats (limited by tier)
    const topSupporters = await db
      .select({
        senderPubkey: zapEvents.senderPubkey,
        totalSats: sql<number>`sum(${zapEvents.amountSats})`.as('total_sats'),
        zapCount: sql<number>`count(*)`.as('zap_count'),
      })
      .from(zapEvents)
      .where(and(
        eq(zapEvents.recipientPubkey, pubkey),
        gte(zapEvents.timestamp, since),
      ))
      .groupBy(zapEvents.senderPubkey)
      .orderBy(desc(sql`sum(${zapEvents.amountSats})`))
      .limit(tierConfig.maxTopSupporters);

    // Daily breakdown
    const dailyStats = await db
      .select({
        day: sql<string>`to_char(to_timestamp(${zapEvents.timestamp}), 'YYYY-MM-DD')`.as('day'),
        totalSats: sql<number>`sum(${zapEvents.amountSats})`.as('total_sats'),
        zapCount: sql<number>`count(*)`.as('zap_count'),
      })
      .from(zapEvents)
      .where(and(
        eq(zapEvents.recipientPubkey, pubkey),
        gte(zapEvents.timestamp, since),
      ))
      .groupBy(sql`to_char(to_timestamp(${zapEvents.timestamp}), 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(to_timestamp(${zapEvents.timestamp}), 'YYYY-MM-DD')`);

    return NextResponse.json({
      pubkey,
      tier,
      period: { days, since, requestedDays, clamped: days !== requestedDays },
      totals: {
        sats: Number(totals.totalSats),
        zaps: Number(totals.totalZaps),
        avgZapSize: Math.round(Number(totals.avgZapSize)),
        uniqueSupporters: Number(totals.uniqueSenders),
      },
      topPosts: enrichedTopPosts,
      topSupporters,
      dailyStats,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
