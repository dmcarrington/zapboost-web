import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { zapEvents } from '@/lib/db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import { authenticateRequest } from '@/lib/api-auth';
import { hasFeature, clampDays } from '@/lib/tiers';

export async function GET(
  request: Request,
  { params }: { params: { pubkey: string } }
) {
  const { pubkey } = params;

  const auth = await authenticateRequest(request);
  const tier = auth?.tier || 'free';

  if (!hasFeature(tier, 'hourlyHeatmap')) {
    return NextResponse.json({
      error: 'Upgrade to Creator tier or above for hourly analytics',
      requiredTier: 'creator',
    }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedDays = parseInt(url.searchParams.get('days') || '30', 10);
  const days = clampDays(tier, requestedDays);
  const since = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

  try {
    // Hourly distribution (0-23) — what hours get the most zaps
    const hourlyDistribution = await db
      .select({
        hour: sql<number>`extract(hour from to_timestamp(${zapEvents.timestamp}))`.as('hour'),
        totalSats: sql<number>`sum(${zapEvents.amountSats})`.as('total_sats'),
        zapCount: sql<number>`count(*)`.as('zap_count'),
      })
      .from(zapEvents)
      .where(and(
        eq(zapEvents.recipientPubkey, pubkey),
        gte(zapEvents.timestamp, since),
      ))
      .groupBy(sql`extract(hour from to_timestamp(${zapEvents.timestamp}))`)
      .orderBy(sql`extract(hour from to_timestamp(${zapEvents.timestamp}))`);

    // Day-of-week distribution (0=Sun, 6=Sat)
    const dowDistribution = await db
      .select({
        dow: sql<number>`extract(dow from to_timestamp(${zapEvents.timestamp}))`.as('dow'),
        totalSats: sql<number>`sum(${zapEvents.amountSats})`.as('total_sats'),
        zapCount: sql<number>`count(*)`.as('zap_count'),
      })
      .from(zapEvents)
      .where(and(
        eq(zapEvents.recipientPubkey, pubkey),
        gte(zapEvents.timestamp, since),
      ))
      .groupBy(sql`extract(dow from to_timestamp(${zapEvents.timestamp}))`)
      .orderBy(sql`extract(dow from to_timestamp(${zapEvents.timestamp}))`);

    // Heatmap: hour x day-of-week
    const heatmap = await db
      .select({
        hour: sql<number>`extract(hour from to_timestamp(${zapEvents.timestamp}))`.as('hour'),
        dow: sql<number>`extract(dow from to_timestamp(${zapEvents.timestamp}))`.as('dow'),
        totalSats: sql<number>`sum(${zapEvents.amountSats})`.as('total_sats'),
        zapCount: sql<number>`count(*)`.as('zap_count'),
      })
      .from(zapEvents)
      .where(and(
        eq(zapEvents.recipientPubkey, pubkey),
        gte(zapEvents.timestamp, since),
      ))
      .groupBy(
        sql`extract(hour from to_timestamp(${zapEvents.timestamp}))`,
        sql`extract(dow from to_timestamp(${zapEvents.timestamp}))`,
      )
      .orderBy(
        sql`extract(dow from to_timestamp(${zapEvents.timestamp}))`,
        sql`extract(hour from to_timestamp(${zapEvents.timestamp}))`,
      );

    // Zap size distribution (buckets)
    const sizeDistribution = await db
      .select({
        bucket: sql<string>`case
          when ${zapEvents.amountSats} < 100 then '<100'
          when ${zapEvents.amountSats} < 1000 then '100-999'
          when ${zapEvents.amountSats} < 10000 then '1k-9.9k'
          when ${zapEvents.amountSats} < 100000 then '10k-99k'
          else '100k+'
        end`.as('bucket'),
        zapCount: sql<number>`count(*)`.as('zap_count'),
        totalSats: sql<number>`sum(${zapEvents.amountSats})`.as('total_sats'),
      })
      .from(zapEvents)
      .where(and(
        eq(zapEvents.recipientPubkey, pubkey),
        gte(zapEvents.timestamp, since),
      ))
      .groupBy(sql`case
        when ${zapEvents.amountSats} < 100 then '<100'
        when ${zapEvents.amountSats} < 1000 then '100-999'
        when ${zapEvents.amountSats} < 10000 then '1k-9.9k'
        when ${zapEvents.amountSats} < 100000 then '10k-99k'
        else '100k+'
      end`);

    return NextResponse.json({
      pubkey,
      period: { days, since },
      hourlyDistribution,
      dowDistribution,
      heatmap,
      sizeDistribution,
    });
  } catch (error) {
    console.error('Hourly stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
