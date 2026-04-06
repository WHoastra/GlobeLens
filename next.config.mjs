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

      // Load Cesium from the global script instead of bundling it.
      // This avoids SWC converting Cesium's octal escapes into
      // illegal template literal sequences.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        { cesium: "Cesium" },
      ];
    }

    config.module.unknownContextCritical = false;

    return config;
  },
};

export default nextConfig;
