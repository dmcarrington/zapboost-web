/**
 * ZapBoost Nostr Client
 * Connects to public relays and listens for NIP-57 zap receipts (kind 9735)
 * Also fetches post content (kind 1) for display
 */

import { Relay, Filter, nip19 } from 'nostr-tools';
import { DEFAULT_RELAYS, parseZapReceipt, parsePostEvent } from './nostr-utils';

export interface ZapEvent {
  id: string;
  postId: string;
  recipientNpub: string;
  amountSats: number;
  timestamp: number;
  senderNpub?: string;
}

export interface ZapVelocity {
  postId: string;
  satsPerHour: number;
  zapsPerHour: number;
  lastUpdated: number;
}

export interface PostContent {
  id: string;
  content: string;
  authorNpub: string;
  timestamp: number;
  imageUrls?: string[];
}

export interface TrendingPost {
  postId: string;
  satsPerHour: number;
  zapsPerHour: number;
  velocityTrend: 'rising' | 'falling' | 'stable';
  content?: PostContent;
  recipientNpub?: string;
}

// DEFAULT_RELAYS imported from nostr-utils

export class ZapBoostClient {
  private relays: Relay[] = [];
  private subscriptions: any[] = [];
  private zapCache: Map<string, ZapEvent[]> = new Map();
  private velocityCache: Map<string, ZapVelocity> = new Map();
  private postCache: Map<string, PostContent> = new Map();
  private listeners: ((posts: TrendingPost[]) => void)[] = [];
  private isConnected = false;
  private myNpub: string | null = null;  // User's hex pubkey to filter zaps
  private velocityInterval: ReturnType<typeof setInterval> | null = null;

  async connect() {
    this.relays = [];
    
    // Connect to relays with error handling - don't fail if one relay is down
    const promises = DEFAULT_RELAYS.map(async (url) => {
      try {
        const relay = new Relay(url);
        await relay.connect();
        console.log(`Connected to ${url}`);
        return relay;
      } catch (err) {
        console.log(`Failed to connect to ${url}`, err);
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    this.relays = results.filter((r): r is Relay => r !== null);

    if (this.relays.length === 0) {
      console.error('Failed to connect to any relays');
      this.isConnected = false;
      return;
    }

    this.isConnected = true;
    this.startMonitoring();
  }

  async syncHistoricalZaps() {
    console.log('Historical sync: starting...');

    if (this.relays.length === 0) {
      console.log('Historical sync: no relays connected, skipping');
      return;
    }

    const threeMonthsAgo = Math.floor(Date.now() / 1000) - (3 * 30 * 24 * 60 * 60);

    // Build filter - only if we know our npub.
    // NIP-01 tag filters are keyed `#p`, not `p`. A bare `p` key is an
    // unknown field and relays return no matches.
    const filterWithP: Filter = this.myNpub ? {
      kinds: [9735],
      since: threeMonthsAgo,
      '#p': [this.myNpub],
    } : {
      kinds: [9735],
      since: threeMonthsAgo,
    };

    console.log(`Historical sync: querying zaps since ${new Date(threeMonthsAgo * 1000).toISOString()}`);
    console.log('Historical sync filter:', filterWithP);

    for (const relay of this.relays) {
      try {
        console.log(`Historical sync: querying ${relay.url}`);
        
        const events: any[] = [];
        const timeout = setTimeout(() => {
          console.log(`Historical sync: timeout on ${relay.url}`);
        }, 5000);

        console.log('Historical sync: subscribing to', relay.url);
        const sub = relay.subscribe([filterWithP], {
          onevent: (event: any) => {
            events.push(event);
            this.processZapReceipt(event);
          },
          oneose: () => {
            sub.close();
            clearTimeout(timeout);
            console.log(`Historical sync: ${events.length} zaps from ${relay.url}`);
            this.updateVelocityCache();
          },
        });
      } catch (err) {
        console.log(`Historical sync: error on ${relay.url}`, err);
      }
    }
  }

  disconnect() {
    this.subscriptions.forEach((sub) => sub.close());
    this.relays.forEach((relay) => relay.close());
    this.relays = [];
    this.subscriptions = [];
    this.isConnected = false;
  }

  private startMonitoring() {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

    // Build filter - only if we know our npub.
    // NIP-01 tag filters are keyed `#p`, not `p`. A bare `p` key is an
    // unknown field and relays return no matches.
    const filterWithP: Filter = this.myNpub ? {
      kinds: [9735],
      since: oneHourAgo,
      '#p': [this.myNpub],
    } : {
      kinds: [9735],
      since: oneHourAgo,
    };

    console.log('Subscription filter:', filterWithP);

    this.subscriptions = this.relays.map((relay) =>
      relay.subscribe([filterWithP], {
        onevent: (event: any) => {
          this.processZapReceipt(event);
        },
      })
    );

    // Start historical sync after a brief delay to ensure relays are ready
    setTimeout(() => {
      this.syncHistoricalZaps();
    }, 500);

    this.velocityInterval = setInterval(() => this.updateVelocityCache(), 30000);
  }

  private processZapReceipt(event: any) {
    try {
      const parsed = parseZapReceipt(event);
      if (!parsed) {
        console.log('processZapReceipt: missing p-tag, skipping');
        return;
      }

      if (!parsed.postId) {
        console.log('processZapReceipt: missing e-tag (profile zap), skipping');
        return;
      }

      // Only process zaps to our npub (if we know it)
      if (this.myNpub && parsed.recipientPubkey !== this.myNpub) {
        console.log('processZapReceipt: zap not for us, skipping');
        return;
      }

      const zap: ZapEvent = {
        id: parsed.id,
        postId: parsed.postId,
        recipientNpub: parsed.recipientPubkey,
        amountSats: parsed.amountSats,
        timestamp: parsed.timestamp,
        senderNpub: parsed.senderPubkey ?? event.pubkey,
      };

      const existingZaps = this.zapCache.get(parsed.postId) || [];
      existingZaps.push(zap);
      this.zapCache.set(parsed.postId, existingZaps);

      if (!this.postCache.has(parsed.postId)) {
        this.fetchPostContent(parsed.postId);
      }

      console.log(`Zap received: ${parsed.amountSats} sats to post ${parsed.postId.slice(0, 8)}...`);
    } catch (error) {
      console.error('Error processing zap receipt:', error);
    }
  }

  private async fetchPostContent(postId: string) {
    try {
      const filter: Filter = {
        ids: [postId],
        kinds: [1],
      };

      const promises = this.relays.map((relay) => {
        return new Promise((resolve) => {
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
          }, 3000);
        });
      });

      const results = await Promise.all(promises);
      const postEvent = results.find((r) => r !== null) as any;

      if (postEvent) {
        const parsed = parsePostEvent(postEvent);
        const postContent: PostContent = {
          id: parsed.id,
          content: parsed.content,
          authorNpub: nip19.npubEncode(parsed.authorPubkey),
          timestamp: parsed.createdAt,
          imageUrls: parsed.images.length > 0 ? parsed.images : undefined,
        };

        this.postCache.set(postId, postContent);
      }
    } catch (error) {
      console.error('Error fetching post content:', error);
    }
  }

  private updateVelocityCache() {
    const oneHourAgo = Date.now() - 3600000;
    const trendingPosts: TrendingPost[] = [];

    console.log('updateVelocityCache: processing', this.zapCache.size, 'posts from cache');

    this.zapCache.forEach((zaps, postId) => {
      const recentZaps = zaps.filter((z) => z.timestamp * 1000 >= oneHourAgo);
      const satsPerHour = recentZaps.reduce((sum, z) => sum + z.amountSats, 0);
      const zapsPerHour = recentZaps.length;

      // For demo purposes, also track ALL zaps (not just recent)
      const totalZaps = zaps.length;
      const totalSats = zaps.reduce((sum, z) => sum + z.amountSats, 0);

      console.log('Post', postId.slice(0, 8), 'zaps:', totalZaps, 'sats:', totalSats);

      if (totalZaps > 0) {
        const velocity: ZapVelocity = {
          postId,
          satsPerHour: totalSats,
          zapsPerHour: totalZaps,
          lastUpdated: Date.now(),
        };
        this.velocityCache.set(postId, velocity);

        trendingPosts.push({
          postId,
          satsPerHour: totalSats,
          zapsPerHour: totalZaps,
          velocityTrend: 'stable',
          content: this.postCache.get(postId),
          recipientNpub: zaps[0]?.recipientNpub,
        });
      }
    });

    trendingPosts.sort((a, b) => b.satsPerHour - a.satsPerHour);
    this.listeners.forEach((listener) => listener(trendingPosts));
  }

  subscribe(callback: (posts: TrendingPost[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  getTrendingPosts(limit: number = 50): TrendingPost[] {
    const posts: TrendingPost[] = [];
    this.velocityCache.forEach((velocity, postId) => {
      const zaps = this.zapCache.get(postId) || [];
      posts.push({
        postId: velocity.postId,
        satsPerHour: velocity.satsPerHour,
        zapsPerHour: velocity.zapsPerHour,
        velocityTrend: 'stable',
        content: this.postCache.get(postId),
        recipientNpub: zaps[0]?.recipientNpub,
      });
    });
    posts.sort((a, b) => b.satsPerHour - a.satsPerHour);
    return posts.slice(0, limit);
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  getRelayCount() {
    return this.relays.length;
  }

  setMyNpub(hexPubkey: string | null) {
    this.myNpub = hexPubkey;
    console.log('ZapBoostClient: set myNpub to', hexPubkey);
  }

  /**
   * Clear all caches and restart subscriptions with the current myNpub filter.
   * Call this after setMyNpub so the relay subscription and cache are clean.
   */
  restart() {
    this.subscriptions.forEach((sub) => sub.close());
    this.subscriptions = [];
    if (this.velocityInterval) {
      clearInterval(this.velocityInterval);
      this.velocityInterval = null;
    }
    this.zapCache.clear();
    this.velocityCache.clear();
    this.postCache.clear();
    this.listeners.forEach((l) => l([]));
    if (this.isConnected) {
      this.startMonitoring();
    }
  }
}

export const zapBoostClient = new ZapBoostClient();
