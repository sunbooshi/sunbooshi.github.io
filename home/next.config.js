/** @type {import('next').NextConfig} */
const nextConfig = {
    trailingSlash: true,
    output: 'export',
    distDir: 'dist',
    images: {
        unoptimized: true,
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'sunbooshi.github.io',
            pathname: '/photos/**',
          },
        ],
    },
}

module.exports = nextConfig
