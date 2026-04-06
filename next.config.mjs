import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    // Redirect bare "cesium" imports to a tiny shim that re-exports
    // window.Cesium (loaded via script tag in layout.tsx).
    // This avoids SWC transpiling Cesium source and breaking on octal escapes.
    config.resolve.alias = {
      ...config.resolve.alias,
      "cesium$": path.resolve(__dirname, "src/lib/cesiumShim.js"),
    };

    config.module.unknownContextCritical = false;

    return config;
  },
};

export default nextConfig;
