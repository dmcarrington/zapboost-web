/**
 * Client-side authentication helpers.
 * Uses NIP-07 browser extensions (Alby, nos2x) for signing.
 */

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: any): Promise<any>;
    };
  }
}

export function isNip07Available(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

/**
 * Full NIP-07 login flow:
 * 1. Get challenge from server
 * 2. Sign it with browser extension
 * 3. Send signed event to server
 * 4. Receive JWT token
 */
export async function loginWithNostr(): Promise<{ token: string; pubkey: string }> {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension found. Install Alby or nos2x.');
  }

  // Step 1: Get challenge
  const challengeRes = await fetch('/api/auth/challenge');
  const { challenge } = await challengeRes.json();

  // Step 2: Get pubkey and sign the challenge
  const pubkey = await window.nostr.getPublicKey();

  const event = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: challenge,
    pubkey,
  };

  const signedEvent = await window.nostr.signEvent(event);

  // Step 3: Send to server for verification
  const verifyRes = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedEvent }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.error || 'Authentication failed');
  }

  const { token, pubkey: verifiedPubkey } = await verifyRes.json();

  // Store token in localStorage for API calls
  localStorage.setItem('zapboost_token', token);
  localStorage.setItem('zapboost_pubkey', verifiedPubkey);

  return { token, pubkey: verifiedPubkey };
}

export function getStoredSession(): { token: string; pubkey: string } | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('zapboost_token');
  const pubkey = localStorage.getItem('zapboost_pubkey');
  if (token && pubkey) return { token, pubkey };
  return null;
}

export function clearSession() {
  localStorage.removeItem('zapboost_token');
  localStorage.removeItem('zapboost_pubkey');
}

/**
 * Full logout: hits /api/auth/logout to clear the httpOnly cookie and
 * delete the server-side sessions row, then clears localStorage. Also
 * sets a flag so the landing page does not auto-re-detect the user's
 * npub from their Nostr extension until they explicitly opt back in.
 */
export async function logout(): Promise<void> {
  const session = getStoredSession();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: session ? { Authorization: `Bearer ${session.token}` } : undefined,
      credentials: 'include',
    });
  } catch {
    // Even if the network request fails, still clear client state.
  }
  clearSession();
  try {
    localStorage.setItem('zapboost_skip_autodetect', '1');
  } catch {
    // localStorage may be unavailable in some environments.
  }
}

/**
 * Fetch wrapper that includes the auth token.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const session = getStoredSession();
  const headers = new Headers(options?.headers);
  if (session) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }
  return fetch(url, { ...options, headers });
}
