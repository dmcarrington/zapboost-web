import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZapBoost — Real-time Nostr Zap Velocity",
  description: "Trending Nostr posts ranked by Lightning zap velocity (sats/hour)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
