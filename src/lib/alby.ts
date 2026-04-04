/**
 * Alby / NWC Wallet Integration for ZapBoost
 * Enables one-tap zaps via Nostr Wallet Connect
 */

export interface NWCWallet {
  getBalance(): Promise<{ balance: number }>;
  makeInvoice(amount: number, description?: string): Promise<{ invoice: string }>;
  payInvoice(invoice: string): Promise<{ preimage: string }>;
  getBalanceSats(): Promise<number>;
}

export class AlbyWallet implements NWCWallet {
  private nwcUrl: string;
  private wallet: any;

  constructor(nwcUrl: string) {
    this.nwcUrl = nwcUrl;
  }

  async init() {
    // Dynamically import @getalby/sdk to avoid SSR issues
    const { nwc } = await import('@getalby/sdk');
    this.wallet = new nwc.NWCClient({ nostrWalletConnectUrl: this.nwcUrl });
  }

  async getBalance(): Promise<{ balance: number }> {
    if (!this.wallet) await this.init();
    const response = await this.wallet.getBalance();
    return { balance: response.balance };
  }

  async getBalanceSats(): Promise<number> {
    const { balance } = await this.getBalance();
    return Math.floor(balance / 1000); // Convert msats to sats
  }

  async makeInvoice(amount: number, description?: string): Promise<{ invoice: string }> {
    if (!this.wallet) await this.init();
    const response = await this.wallet.makeInvoice({
      amount: amount * 1000, // Convert sats to msats
      description: description || 'ZapBoost zap',
    });
    return { invoice: response.invoice };
  }

  async payInvoice(invoice: string): Promise<{ preimage: string }> {
    if (!this.wallet) await this.init();
    const response = await this.wallet.payInvoice({ invoice });
    return { preimage: response.preimage };
  }
}

/**
 * Check if Alby browser extension is installed
 */
export function isAlbyInstalled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).alby;
}

/**
 * Request Alby connection (OAuth flow)
 */
export async function connectAlby(): Promise<string | null> {
  if (!isAlbyInstalled()) {
    // Redirect to Alby OAuth
    const authUrl = `https://getalby.com/oauth`;
    window.open(authUrl, '_blank');
    return null;
  }

  // Alby extension available
  const alby = (window as any).alby;
  try {
    const response = await alby.enable(['getBalance', 'makeInvoice', 'payInvoice']);
    return response.nwcUrl || null;
  } catch (error) {
    console.error('Alby connection failed:', error);
    return null;
  }
}

/**
 * Send a zap via Alby
 */
export async function sendZap(
  amountSats: number,
  recipientNpub: string,
  eventHash?: string
): Promise<boolean> {
  try {
    if (isAlbyInstalled()) {
      const alby = (window as any).alby;
      
      // Create zap request (NIP-57)
      const invoice = await alby.makeInvoice({
        amount: amountSats * 1000, // msats
        description: `Zap via ZapBoost`,
        // NIP-57 zap request metadata would go here
      });

      // Pay the invoice
      await alby.payInvoice({ invoice: invoice.invoice });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Zap failed:', error);
    return false;
  }
}
