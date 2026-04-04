/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable WebSocket for Nostr relay connections
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
