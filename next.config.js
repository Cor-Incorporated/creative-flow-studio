/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    eslint: {
        // Next.js 14 with ESLint 9 compatibility
        // ESLint 9 is fully supported in Next.js 15+
        // For now, we disable ESLint during builds and run it separately via `npm run lint`
        ignoreDuringBuilds: true,
    },
};

module.exports = nextConfig;
