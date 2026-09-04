import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Permit the dev client to hydrate when testing from a phone over the LAN.
  allowedDevOrigins: ["192.168.1.223"],
};

export default nextConfig;
