/**
 * ZapBoost Nostr Client
 * Connects to public relays and listens for NIP-57 zap receipts (kind 9735)
 * Also fetches post content (kind 1) for display
 */

import { Relay, Filter, nip19 } from 'nostr-tools';

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

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

export class ZapBoostClient {
  private relays: Relay[] = [];
  private subscriptions: any[] = [];
  private zapCache: Map<string, ZapEvent[]> = new Map();
  private velocityCache: Map<string, ZapVelocity> = new Map();
  private postCache: Map<string, PostContent> = new Map();
  private listeners: ((posts: TrendingPost[]) => void)[] = [];
  private isConnected = false;

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

  disconnect() {
    this.subscriptions.forEach((sub) => sub.close());
    this.relays.forEach((relay) => relay.close());
    this.relays = [];
    this.subscriptions = [];
    this.isConnected = false;
  }

  getRelayCount() {
    return this.relays.length;
  }

  private startMonitoring() {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

    const filter: Filter = {
      kinds: [9735],
      since: oneHourAgo,
    };

    this.subscriptions = this.relays.map((relay) =>
      relay.subscribe([filter], {
        onevent: (event: any) => {
          this.processZapReceipt(event);
        },
      })
    );

    this.syncHistoricalZaps();

    setInterval(() => this.updateVelocityCache(), 30000);
  }

  async syncHistoricalZaps() {
    console.log('Historical sync: starting...');

    if (this.relays.length === 0) {
      console.log('Historical sync: no relays connected, skipping');
      return;
    }

    const threeMonthsAgo = Math.floor(Date.now() / 1000) - (3 * 30 * 24 * 60 * 60);

    const filter: Filter = {
      kinds: [9735],
      since: threeMonthsAgo,
    };

    console.log(`Historical sync: querying zaps since ${new Date(threeMonthsAgo * 1000).toISOString()}`);

    for (const relay of this.relays) {
      try {
        console.log(`Historical sync: querying ${relay.url}`);
        
        const events: any[] = [];
        const timeout = setTimeout(() => {
          console.log(`Historical sync: timeout on ${relay.url}`);
        }, 5000);

        const sub = relay.subscribe([filter], {
          onevent: (event: any) => {
            events.push(event);
            this.processZapReceipt(event);
          },
          oneose: () => {
            sub.close();
            clearTimeout(timeout);
            console.log(`Historical sync: ${events.length} zaps from ${relay.url}`);
          },
        });
      } catch (err) {
        console.log(`Historical sync: error on ${relay.url}`, err);
      }
    }
  }

  private processZapReceipt(event: any) {
    try {
      const eTag = event.tags.find((t: any) => t[0] === 'e')?.[1];
      if (!eTag) return;

      const amountTag = event.tags.find((t: any) => t[0] === 'amount')?.[1];
      const amountSats = amountTag ? parseInt(amountTag) : 0;
      if (amountSats === 0) return;

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

      const existingZaps = this.zapCache.get(eTag) || [];
      existingZaps.push(zap);
      this.zapCache.set(eTag, existingZaps);

      if (!this.postCache.has(eTag)) {
        this.fetchPostContent(eTag);
      }

      console.log(`Zap received: ${amountSats} sats to post ${eTag.slice(0, 8)}...`);
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
        const imageUrls: string[] = [];
        const imageRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi;
        const matches = postEvent.content.match(imageRegex);
        if (matches) imageUrls.push(...matches);

        postEvent.tags?.forEach((tag: any) => {
          if (tag[0] === 'imeta' || tag[0] === 'image') {
            const url = tag.find((t: string) => t.startsWith('http'));
            if (url) imageUrls.push(url);
          }
        });

        const postContent: PostContent = {
          id: postEvent.id,
          content: postEvent.content,
          authorNpub: nip19.npubEncode(postEvent.pubkey),
          timestamp: postEvent.created_at,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
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
}

export const zapBoostClient = new ZapBoostClient();
