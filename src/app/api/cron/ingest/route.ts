/**
 * Cron-triggered ingestion endpoint.
 *
 * Designed to be called on a schedule by Vercel Cron (see `vercel.json`) or
 * any external scheduler (e.g. a GitHub Actions scheduled workflow). Does
 * two things in one invocation:
 *
 *   1. Pulls recent kind-9735 zap receipts addressed to any registered user,
 *      using max(zap_events.timestamp) as the `since` cursor.
 *   2. Drains a bounded batch of pending `backfill_jobs`, calling
 *      `ingestionService.backfillForPubkey` for each.
 *
 * Protected by a shared secret: the request must carry
 * `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends this header
 * automatically when `CRON_SECRET` is set on the project.
 */

import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, zapEvents, backfillJobs } from '@/lib/db/schema';
import { ingestionService } from '@/lib/ingestion';

/**
 * Returns just the host of the configured DATABASE_URL (no credentials,
 * no path), so the cron response can include it as a diagnostic. This
 * lets you eyeball "is the deployment actually talking to the Neon DB I
 * think it is?" without digging through Vercel env vars.
 */
function dbHostForDiagnostics(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return '(DATABASE_URL unset)';
  try {
    return new URL(url).host;
  } catch {
    return '(unparseable)';
  }
}

// Vercel Hobby allows up to 60s function duration.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Cap how many backfill jobs we drain per cron run so the function stays
// under its time budget. Remaining jobs are picked up on the next tick.
const MAX_BACKFILLS_PER_RUN = 3;

// If we've never ingested before, pull the last hour.
const DEFAULT_LOOKBACK_SECONDS = 60 * 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[cron/ingest] CRON_SECRET is not set — endpoint is unauthenticated');
  }

  const startedAt = Date.now();
  const summary = {
    recentPulled: 0,
    backfillsRun: 0,
    backfillsFailed: 0,
    skippedNoUsers: false,
    durationMs: 0,
    diagnostics: {
      dbHost: dbHostForDiagnostics(),
      cronSecretConfigured: Boolean(secret),
      userCount: 0,
      pendingBackfillCount: 0,
      completedBackfillCount: 0,
      failedBackfillCount: 0,
      zapEventCount: 0,
      firstUserPubkeyPrefix: null as string | null,
    },
  };

  try {
    // --- 0. Diagnostic counts (cheap, all Postgres `count(*)`) ---
    const [userCountRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users);
    summary.diagnostics.userCount = userCountRow?.c ?? 0;

    const [zapCountRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(zapEvents);
    summary.diagnostics.zapEventCount = zapCountRow?.c ?? 0;

    const [pendingRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(backfillJobs)
      .where(eq(backfillJobs.status, 'pending'));
    summary.diagnostics.pendingBackfillCount = pendingRow?.c ?? 0;

    const [completedRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(backfillJobs)
      .where(eq(backfillJobs.status, 'completed'));
    summary.diagnostics.completedBackfillCount = completedRow?.c ?? 0;

    const [failedRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(backfillJobs)
      .where(eq(backfillJobs.status, 'failed'));
    summary.diagnostics.failedBackfillCount = failedRow?.c ?? 0;

    // --- 1. Pull recent zaps for all registered users ---
    const registeredUsers = await db.select({ pubkey: users.pubkey }).from(users);
    const pubkeys = registeredUsers.map((u) => u.pubkey);
    if (pubkeys[0]) {
      summary.diagnostics.firstUserPubkeyPrefix = pubkeys[0].slice(0, 8);
    }

    if (pubkeys.length === 0) {
      summary.skippedNoUsers = true;
    } else {
      // Cursor: newest zap we've already stored, or fall back to lookback.
      const latest = await db
        .select({ ts: zapEvents.timestamp })
        .from(zapEvents)
        .orderBy(desc(zapEvents.timestamp))
        .limit(1);

      const nowSec = Math.floor(Date.now() / 1000);
      const since = latest[0]?.ts ?? nowSec - DEFAULT_LOOKBACK_SECONDS;

      summary.recentPulled = await ingestionService.pullRecentForPubkeys(pubkeys, since);
    }

    // --- 2. Drain a batch of pending backfill jobs ---
    const pending = await db
      .select()
      .from(backfillJobs)
      .where(eq(backfillJobs.status, 'pending'))
      .limit(MAX_BACKFILLS_PER_RUN);

    for (const job of pending) {
      // Claim the job atomically so a concurrent cron run can't double-process it.
      const claimed = await db
        .update(backfillJobs)
        .set({ status: 'running', startedAt: new Date() })
        .where(sql`${backfillJobs.id} = ${job.id} AND ${backfillJobs.status} = 'pending'`)
        .returning({ id: backfillJobs.id });

      if (claimed.length === 0) continue;

      try {
        const count = await ingestionService.backfillForPubkey(job.pubkey);
        await db
          .update(backfillJobs)
          .set({
            status: 'completed',
            completedAt: new Date(),
            eventsProcessed: count,
          })
          .where(eq(backfillJobs.id, job.id));
        summary.backfillsRun++;
      } catch (err) {
        summary.backfillsFailed++;
        console.error(`[cron/ingest] Backfill failed for ${job.pubkey.slice(0, 8)}:`, err);
        await db
          .update(backfillJobs)
          .set({
            status: 'failed',
            completedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
          })
          .where(eq(backfillJobs.id, job.id));
      }
    }

    summary.durationMs = Date.now() - startedAt;
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    summary.durationMs = Date.now() - startedAt;
    console.error('[cron/ingest] Fatal error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), ...summary },
      { status: 500 },
    );
  }
}
