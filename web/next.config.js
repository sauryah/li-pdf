/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  devIndicators: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8085',
    NEXT_PUBLIC_PHOTO_ENGINE_URL: process.env.NEXT_PUBLIC_PHOTO_ENGINE_URL || 'http://localhost:8000',
  },
}

module.exports = nextConfig
