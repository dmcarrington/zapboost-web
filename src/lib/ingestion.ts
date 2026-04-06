/**
 * Server-side Nostr zap ingestion service.
 *
 * Stateless, pull-based: every call connects to relays, queries with a
 * bounded filter, waits for EOSE (or times out), writes to Postgres, and
 * disconnects. Designed to run inside a serverless function triggered by a
 * cron schedule — there is no long-running process.
 *
 * Dedup is handled entirely at the DB layer via `zap_events.id` primary key
 * + `onConflictDoNothing`, so multiple concurrent invocations are safe.
 */

import { Relay, Filter } from 'nostr-tools';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { zapEvents, posts } from './db/schema';
import { DEFAULT_RELAYS, parseZapReceipt, parsePostEvent } from './nostr-utils';

const INGESTION_RELAYS = [...DEFAULT_RELAYS];

const RELAY_QUERY_TIMEOUT_MS = 15_000;
const POST_FETCH_TIMEOUT_MS = 5_000;

class IngestionService {
  /**
   * Pull recent zap receipts addressed to any of the given pubkeys, since
   * the provided unix timestamp. Called by the cron ingest route.
   */
  async pullRecentForPubkeys(pubkeys: string[], since: number): Promise<number> {
    if (pubkeys.length === 0) return 0;

    const filter: Filter = {
      kinds: [9735],
      since,
      '#p': pubkeys,
    };

    console.log(
      `[ingestion] Pulling zaps for ${pubkeys.length} user(s) since ${new Date(since * 1000).toISOString()}`,
    );

    const relays = await this.connectRelays();
    if (relays.length === 0) return 0;

    try {
      return await this.queryAndStore(relays, filter, RELAY_QUERY_TIMEOUT_MS);
    } finally {
      this.closeRelays(relays);
    }
  }

  /**
   * Backfill historical zaps for a single pubkey. Called when a new user
   * signs up (enqueued via `backfill_jobs` by /api/auth/verify, drained by
   * the cron ingest route).
   */
  async backfillForPubkey(pubkey: string, monthsBack = 12): Promise<number> {
    const since = Math.floor(Date.now() / 1000) - monthsBack * 30 * 24 * 60 * 60;

    const filter: Filter = {
      kinds: [9735],
      since,
      '#p': [pubkey],
    };

    console.log(
      `[ingestion] Backfilling zaps for ${pubkey.slice(0, 8)}… since ${new Date(since * 1000).toISOString()}`,
    );

    const relays = await this.connectRelays();
    if (relays.length === 0) return 0;

    try {
      const count = await this.queryAndStore(relays, filter, RELAY_QUERY_TIMEOUT_MS);
      console.log(`[ingestion] Backfill complete for ${pubkey.slice(0, 8)}: ${count} events`);
      return count;
    } finally {
      this.closeRelays(relays);
    }
  }

  // --- internals ---

  private async connectRelays(): Promise<Relay[]> {
    const results = await Promise.all(
      INGESTION_RELAYS.map(async (url) => {
        try {
          const relay = new Relay(url);
          await relay.connect();
          return relay;
        } catch (err) {
          console.log(`[ingestion] Failed to connect to ${url}`, err);
          return null;
        }
      }),
    );
    const relays = results.filter((r): r is Relay => r !== null);
    if (relays.length === 0) {
      console.error('[ingestion] Failed to connect to any relays');
    }
    return relays;
  }

  private closeRelays(relays: Relay[]) {
    for (const relay of relays) {
      try {
        relay.close();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Query each relay for events matching the filter, storing them as they
   * arrive. Resolves when every relay has sent EOSE or the timeout fires.
   */
  private async queryAndStore(relays: Relay[], filter: Filter, timeoutMs: number): Promise<number> {
    const relayCounts = await Promise.all(
      relays.map(
        (relay) =>
          new Promise<number>((resolve) => {
            let count = 0;
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              try {
                sub.close();
              } catch {
                // ignore
              }
              resolve(count);
            };

            const sub = relay.subscribe([filter], {
              onevent: async (event: any) => {
                count++;
                await this.processAndStore(event, relays);
              },
              oneose: () => finish(),
            });

            setTimeout(finish, timeoutMs);
          }),
      ),
    );

    return relayCounts.reduce((sum, c) => sum + c, 0);
  }

  private async processAndStore(event: any, relays: Relay[]) {
    const parsed = parseZapReceipt(event);
    if (!parsed) return;

    try {
      await db
        .insert(zapEvents)
        .values({
          id: parsed.id,
          postId: parsed.postId,
          recipientPubkey: parsed.recipientPubkey,
          senderPubkey: parsed.senderPubkey,
          amountSats: parsed.amountSats,
          timestamp: parsed.timestamp,
          rawEvent: event,
        })
        .onConflictDoNothing();

      if (parsed.postId) {
        await this.fetchAndStorePost(parsed.postId, relays);
      }
    } catch (err) {
      console.error('[ingestion] Error storing zap:', err);
    }
  }

  private async fetchAndStorePost(postId: string, relays: Relay[]) {
    const existing = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
    if (existing) return;

    const filter: Filter = { ids: [postId], kinds: [1] };

    const results = await Promise.all(
      relays.map(
        (relay) =>
          new Promise<any>((resolve) => {
            let settled = false;
            const finish = (value: any) => {
              if (settled) return;
              settled = true;
              try {
                sub.close();
              } catch {
                // ignore
              }
              resolve(value);
            };
            const sub = relay.subscribe([filter], {
              onevent: (event: any) => finish(event),
              oneose: () => finish(null),
            });
            setTimeout(() => finish(null), POST_FETCH_TIMEOUT_MS);
          }),
      ),
    );

    const postEvent = results.find((r) => r !== null);
    if (!postEvent) return;

    const parsed = parsePostEvent(postEvent);
    try {
      await db
        .insert(posts)
        .values({
          id: parsed.id,
          content: parsed.content,
          authorPubkey: parsed.authorPubkey,
          createdAt: parsed.createdAt,
          images: parsed.images,
        })
        .onConflictDoNothing();
    } catch (err) {
      console.error('[ingestion] Error storing post:', err);
    }
  }
}

export const ingestionService = new IngestionService();
