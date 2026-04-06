/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        http: false,
        https: false,
        zlib: false,
      };
    }

    config.module.unknownContextCritical = false;

    return config;
  },
};

export default nextConfig;
