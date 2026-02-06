/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript hatalarını göster - güvenlik için kritik
  typescript: {
    ignoreBuildErrors: false,
  },
  // ESLint hatalarını göster - kod kalitesi için
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Güvenlik başlıkları
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
