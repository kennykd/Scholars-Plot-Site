import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['swagger-ui-react', 'swagger-client', 'react-syntax-highlighter'],
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/api/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;