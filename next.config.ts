import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for the Docker image.
  output: 'standalone',
  // Pin the file-tracing root to this project (a stray lockfile elsewhere on
  // the machine otherwise confuses standalone output collection).
  outputFileTracingRoot: __dirname,
  // solclientjs is a CommonJS SDK that must run in the long-lived Node process
  // and must NOT be bundled by webpack/turbopack — keep it external.
  serverExternalPackages: ['solclientjs'],
  // The Solace session is process-global state; never statically optimize.
  reactStrictMode: true,
};

export default nextConfig;
