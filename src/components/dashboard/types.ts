export interface Stats {
  pubkey: string;
  period: { days: number; since: number };
  totals: {
    sats: number;
    zaps: number;
    avgZapSize: number;
    uniqueSupporters: number;
  };
  topPosts: TopPost[];
  topSupporters: TopSupporter[];
  dailyStats: DailyStat[];
}

export interface HourlyStats {
  pubkey: string;
  period: { days: number; since: number };
  hourlyDistribution: Array<{ hour: number; totalSats: number; zapCount: number }>;
  dowDistribution: Array<{ dow: number; totalSats: number; zapCount: number }>;
  heatmap: Array<{ hour: number; dow: number; totalSats: number; zapCount: number }>;
  sizeDistribution: Array<{ bucket: string; zapCount: number; totalSats: number }>;
}

export interface TopPost {
  postId: string | null;
  totalSats: number;
  zapCount: number;
  content: { id: string; content: string; authorPubkey: string; images: string[] } | null;
}

export interface TopSupporter {
  senderPubkey: string | null;
  totalSats: number;
  zapCount: number;
}

export interface DailyStat {
  day: string;
  totalSats: number;
  zapCount: number;
}

export function formatSats(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function truncateNpub(npub: string): string {
  if (npub.length <= 16) return npub;
  return `${npub.slice(0, 10)}...${npub.slice(-6)}`;
}
