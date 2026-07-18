import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // No next/image usage in the app — disabling optimization removes the need
  // for OpenNext's image-optimization Lambda (one less function + behavior).
  images: {
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
