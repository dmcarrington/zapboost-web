/**
 * ZapBoost Nostr Client
 * Connects to public relays and listens for NIP-57 zap receipts (kind 9735)
 */

import { relayInit, Filter } from 'nostr-tools';

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

export interface TrendingPost {
  postId: string;
  satsPerHour: number;
  zapsPerHour: number;
  velocityTrend: 'rising' | 'falling' | 'stable';
}

// Default relays for zap receipt monitoring
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

export class ZapBoostClient {
  private relays: any[] = [];
  private subscriptions: any[] = [];
  private zapCache: Map<string, ZapEvent[]> = new Map();
  private velocityCache: Map<string, ZapVelocity> = new Map();
  private listeners: ((posts: TrendingPost[]) => void)[] = [];
  private isConnected = false;

  async connect() {
    try {
      // Connect to multiple relays for redundancy
      this.relays = await Promise.all(
        DEFAULT_RELAYS.map(async (url) => {
          const relay = relayInit(url);
          await relay.connect();
          console.log(`Connected to ${url}`);
          return relay;
        })
      );

      this.isConnected = true;
      this.startMonitoring();
    } catch (error) {
      console.error('Failed to connect to relays:', error);
      this.isConnected = false;
    }
  }

  disconnect() {
    this.subscriptions.forEach((sub) => sub.unsub());
    this.relays.forEach((relay) => relay.close());
    this.relays = [];
    this.subscriptions = [];
    this.isConnected = false;
  }

  private startMonitoring() {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

    const filter: Filter = {
      kinds: [9735], // Zap receipt
      since: oneHourAgo,
    };

    // Subscribe on all connected relays
    this.subscriptions = this.relays.map((relay) =>
      relay.subscribe([filter], {
        onevent: (event: any) => {
          this.processZapReceipt(event);
        },
      })
    );

    // Update velocity cache every 30 seconds
    setInterval(() => this.updateVelocityCache(), 30000);
  }

  private processZapReceipt(event: any) {
    try {
      // Extract e-tag (the post being zapped)
      const eTag = event.tags.find((t: any) => t[0] === 'e')?.[1];
      if (!eTag) return;

      // Extract amount from bolt11 or amount tag
      const amountTag = event.tags.find((t: any) => t[0] === 'amount')?.[1];
      const amountSats = amountTag ? parseInt(amountTag) : 0;
      if (amountSats === 0) return;

      // Extract recipient (p-tag)
      const pTag = event.tags.find((t: any) => t[0] === 'p')?.[1];
      if (!pTag) return;

      const zap: ZapEvent = {
        id: event.id,
        postId: eTag,
        recipientNpub: pTag,
        amountSats,
        timestamp: event.created_at,
        senderNpub: event.pubkey,
      };

      // Add to cache
      const existingZaps = this.zapCache.get(eTag) || [];
      existingZaps.push(zap);
      this.zapCache.set(eTag, existingZaps);

      console.log(`Zap received: ${amountSats} sats to post ${eTag.slice(0, 8)}...`);
    } catch (error) {
      console.error('Error processing zap receipt:', error);
    }
  }

  private updateVelocityCache() {
    const oneHourAgo = Date.now() - 3600000;
    const trendingPosts: TrendingPost[] = [];

    this.zapCache.forEach((zaps, postId) => {
      const recentZaps = zaps.filter((z) => z.timestamp * 1000 >= oneHourAgo);
      const satsPerHour = recentZaps.reduce((sum, z) => sum + z.amountSats, 0);
      const zapsPerHour = recentZaps.length;

      if (satsPerHour > 0) {
        const velocity: ZapVelocity = {
          postId,
          satsPerHour,
          zapsPerHour,
          lastUpdated: Date.now(),
        };
        this.velocityCache.set(postId, velocity);

        trendingPosts.push({
          postId,
          satsPerHour,
          zapsPerHour,
          velocityTrend: 'stable', // Would need historical data for trend
        });
      }
    });

    // Sort by sats per hour
    trendingPosts.sort((a, b) => b.satsPerHour - a.satsPerHour);

    // Notify listeners
    this.listeners.forEach((listener) => listener(trendingPosts));
  }

  subscribe(callback: (posts: TrendingPost[]) => void) {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  getTrendingPosts(limit: number = 50): TrendingPost[] {
    const posts: TrendingPost[] = [];
    this.velocityCache.forEach((velocity) => {
      posts.push({
        postId: velocity.postId,
        satsPerHour: velocity.satsPerHour,
        zapsPerHour: velocity.zapsPerHour,
        velocityTrend: 'stable',
      });
    });
    posts.sort((a, b) => b.satsPerHour - a.satsPerHour);
    return posts.slice(0, limit);
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const zapBoostClient = new ZapBoostClient();
