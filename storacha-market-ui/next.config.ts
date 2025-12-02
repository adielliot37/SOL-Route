import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Ignore optional dependencies that cause warnings
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'pino-pretty': false,
      };
    }
    
    // Ignore pino-pretty in module resolution (it's an optional dependency)
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
    };
    
    // Ignore warnings about optional peer dependencies
    config.ignoreWarnings = [
      { module: /node_modules\/pino/ },
      { module: /node_modules\/pino-pretty/ },
    ];
    
    return config;
  },
};

export default nextConfig;
