/**
 * Server-side Nostr zap ingestion service.
 * Subscribes to relays, deduplicates zap receipts, and persists them to PostgreSQL.
 * Also fetches and caches post content for zapped posts.
 */

import { Relay, Filter } from 'nostr-tools';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { zapEvents, posts } from './db/schema';
import { DEFAULT_RELAYS, parseZapReceipt, parsePostEvent, ParsedZap } from './nostr-utils';

const INGESTION_RELAYS = [
  ...DEFAULT_RELAYS,
  // Add more relays for broader coverage in production
];

class IngestionService {
  private relays: Relay[] = [];
  private subscriptions: any[] = [];
  private isRunning = false;
  private seenEventIds = new Set<string>();

  async start(pubkeys?: string[]) {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[ingestion] Starting relay connections...');

    const promises = INGESTION_RELAYS.map(async (url) => {
      try {
        const relay = new Relay(url);
        await relay.connect();
        console.log(`[ingestion] Connected to ${url}`);
        return relay;
      } catch (err) {
        console.log(`[ingestion] Failed to connect to ${url}`, err);
        return null;
      }
    });

    const results = await Promise.all(promises);
    this.relays = results.filter((r): r is Relay => r !== null);

    if (this.relays.length === 0) {
      console.error('[ingestion] Failed to connect to any relays');
      this.isRunning = false;
      return;
    }

    this.subscribeToZaps(pubkeys);
  }

  stop() {
    this.subscriptions.forEach((sub) => sub.close());
    this.relays.forEach((relay) => relay.close());
    this.relays = [];
    this.subscriptions = [];
    this.isRunning = false;
    this.seenEventIds.clear();
    console.log('[ingestion] Stopped');
  }

  /**
   * Subscribe to real-time zap receipts from all connected relays.
   * If pubkeys are provided, only listen for zaps to those specific users.
   */
  private subscribeToZaps(pubkeys?: string[]) {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

    const filter: Filter = {
      kinds: [9735],
      since: oneHourAgo,
      ...(pubkeys && pubkeys.length > 0 ? { '#p': pubkeys } : {}),
    };

    console.log('[ingestion] Subscribing with filter:', JSON.stringify(filter));

    this.subscriptions = this.relays.map((relay) =>
      relay.subscribe([filter], {
        onevent: async (event: any) => {
          if (this.seenEventIds.has(event.id)) return;
          this.seenEventIds.add(event.id);

          // Prevent unbounded memory growth
          if (this.seenEventIds.size > 100000) {
            const entries = Array.from(this.seenEventIds);
            this.seenEventIds = new Set(entries.slice(-50000));
          }

          await this.processAndStore(event);
        },
      })
    );
  }

  /**
   * Backfill historical zaps for a specific pubkey.
   * Called when a new user signs up to populate their dashboard.
   */
  async backfillForPubkey(pubkey: string, monthsBack = 12) {
    const since = Math.floor(Date.now() / 1000) - (monthsBack * 30 * 24 * 60 * 60);

    const filter: Filter = {
      kinds: [9735],
      since,
      '#p': [pubkey],
    };

    console.log(`[ingestion] Backfilling zaps for ${pubkey.slice(0, 8)}... since ${new Date(since * 1000).toISOString()}`);

    let totalProcessed = 0;

    const relayPromises = this.relays.map((relay) =>
      new Promise<number>((resolve) => {
        let count = 0;
        const sub = relay.subscribe([filter], {
          onevent: async (event: any) => {
            await this.processAndStore(event);
            count++;
          },
          oneose: () => {
            sub.close();
            resolve(count);
          },
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          sub.close();
          resolve(count);
        }, 30000);
      })
    );

    const counts = await Promise.all(relayPromises);
    totalProcessed = counts.reduce((sum, c) => sum + c, 0);
    console.log(`[ingestion] Backfill complete: ${totalProcessed} events processed`);
    return totalProcessed;
  }

  /**
   * Parse a zap receipt and store it in the database.
   * Also triggers post content fetch if we don't have the post yet.
   */
  private async processAndStore(event: any) {
    const parsed = parseZapReceipt(event);
    if (!parsed) return;

    try {
      await db.insert(zapEvents).values({
        id: parsed.id,
        postId: parsed.postId,
        recipientPubkey: parsed.recipientPubkey,
        senderPubkey: parsed.senderPubkey,
        amountSats: parsed.amountSats,
        timestamp: parsed.timestamp,
        rawEvent: event,
      }).onConflictDoNothing();

      // Fetch post content if we have a post ID and don't have it cached
      if (parsed.postId) {
        await this.fetchAndStorePost(parsed.postId);
      }
    } catch (err) {
      console.error('[ingestion] Error storing zap:', err);
    }
  }

  /**
   * Fetch a kind-1 post from relays and store it in the database.
   * No-ops if the post is already stored.
   */
  private async fetchAndStorePost(postId: string) {
    // Check if we already have this post
    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });
    if (existing) return;

    const filter: Filter = {
      ids: [postId],
      kinds: [1],
    };

    const promises = this.relays.map((relay) =>
      new Promise<any>((resolve) => {
        const sub = relay.subscribe([filter], {
          onevent: (event: any) => {
            sub.close();
            resolve(event);
          },
          oneose: () => {
            sub.close();
            resolve(null);
          },
        });
        setTimeout(() => {
          sub.close();
          resolve(null);
        }, 5000);
      })
    );

    const results = await Promise.all(promises);
    const postEvent = results.find((r) => r !== null);

    if (postEvent) {
      const parsed = parsePostEvent(postEvent);
      try {
        await db.insert(posts).values({
          id: parsed.id,
          content: parsed.content,
          authorPubkey: parsed.authorPubkey,
          createdAt: parsed.createdAt,
          images: parsed.images,
        }).onConflictDoNothing();
      } catch (err) {
        console.error('[ingestion] Error storing post:', err);
      }
    }
  }
}

// Singleton for the ingestion service
export const ingestionService = new IngestionService();
