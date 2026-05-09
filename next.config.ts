import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
  },
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
  webpack: (config: any) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": path.resolve(
        process.cwd(),
        "lib",
        "asyncStorageShim"
      ),
    };
    return config;
  },
};

export default nextConfig;
