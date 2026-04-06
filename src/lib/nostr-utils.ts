/**
 * Shared Nostr utilities for parsing NIP-57 zap receipts.
 * Used by both the client-side ZapBoostClient and server-side ingestion service.
 */

import { nip19 } from 'nostr-tools';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

export interface ParsedZap {
  id: string;
  postId: string | null;
  recipientPubkey: string;
  senderPubkey: string | null;
  amountSats: number;
  timestamp: number;
  zapComment?: string;
}

export interface ParsedPost {
  id: string;
  content: string;
  authorPubkey: string;
  createdAt: number;
  images: string[];
}

/**
 * Extract sats from a kind-9735 zap receipt.
 * NIP-57: the amount lives in the `description` tag (JSON of the zap request),
 * not directly on the receipt. Falls back to a direct `amount` tag (msats) if present.
 */
export function extractAmountSats(event: { tags: string[][] }): number {
  const description = event.tags.find((t) => t[0] === 'description')?.[1];
  if (description) {
    try {
      const zapRequest = JSON.parse(description);
      const msatsTag = zapRequest.tags?.find((t: string[]) => t[0] === 'amount')?.[1];
      if (msatsTag) {
        const msats = parseInt(msatsTag, 10);
        if (!isNaN(msats) && msats > 0) return Math.floor(msats / 1000);
      }
    } catch {}
  }

  const amountTag = event.tags.find((t) => t[0] === 'amount')?.[1];
  if (amountTag) {
    const msats = parseInt(amountTag, 10);
    if (!isNaN(msats) && msats > 0) return Math.floor(msats / 1000);
  }

  return 0;
}

/**
 * Extract the zap comment from the embedded zap request in a kind-9735 receipt.
 */
export function extractZapComment(event: { tags: string[][] }): string | undefined {
  const description = event.tags.find((t) => t[0] === 'description')?.[1];
  if (description) {
    try {
      const zapRequest = JSON.parse(description);
      if (zapRequest.content && zapRequest.content.trim()) {
        return zapRequest.content.trim();
      }
    } catch {}
  }
  return undefined;
}

/**
 * Extract the sender pubkey from the embedded zap request in a kind-9735 receipt.
 */
export function extractSenderPubkey(event: { tags: string[][]; pubkey: string }): string | null {
  const description = event.tags.find((t) => t[0] === 'description')?.[1];
  if (description) {
    try {
      const zapRequest = JSON.parse(description);
      if (zapRequest.pubkey) return zapRequest.pubkey;
    } catch {}
  }
  return null;
}

/**
 * Parse a raw kind-9735 event into a structured ParsedZap.
 */
export function parseZapReceipt(event: { id: string; pubkey: string; created_at: number; tags: string[][] }): ParsedZap | null {
  const pTag = event.tags.find((t) => t[0] === 'p')?.[1];
  if (!pTag) return null;

  const eTag = event.tags.find((t) => t[0] === 'e')?.[1] ?? null;
  const amountSats = extractAmountSats(event);
  const senderPubkey = extractSenderPubkey(event);
  const zapComment = extractZapComment(event);

  return {
    id: event.id,
    postId: eTag,
    recipientPubkey: pTag,
    senderPubkey,
    amountSats,
    timestamp: event.created_at,
    zapComment,
  };
}

/**
 * Parse a raw kind-1 event into a structured ParsedPost.
 */
export function parsePostEvent(event: { id: string; pubkey: string; created_at: number; content: string; tags: string[][] }): ParsedPost {
  const images: string[] = [];
  const imageRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi;
  const matches = event.content.match(imageRegex);
  if (matches) images.push(...matches);

  event.tags?.forEach((tag) => {
    if (tag[0] === 'imeta' || tag[0] === 'image') {
      const url = tag.find((t) => t.startsWith('http'));
      if (url) images.push(url);
    }
  });

  return {
    id: event.id,
    content: event.content,
    authorPubkey: event.pubkey,
    createdAt: event.created_at,
    images,
  };
}

/**
 * Convert hex pubkey to npub (bech32) format.
 */
export function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex);
}

/**
 * Convert npub (bech32) to hex pubkey.
 */
export function npubToHex(npub: string): string | null {
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') return decoded.data;
    return null;
  } catch {
    return null;
  }
}
