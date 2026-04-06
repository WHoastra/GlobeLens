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

    // Point cesium JS imports to pre-built CJS bundle to avoid
    // SWC converting octal escapes into template literals.
    // Use cesium$ to match only bare "cesium" imports, not subpaths like cesium/Build/...
    config.resolve.alias = {
      ...config.resolve.alias,
      "cesium$": path.resolve(__dirname, "node_modules/cesium/index.cjs"),
    };

    config.module.unknownContextCritical = false;

    return config;
  },
};

export default nextConfig;
