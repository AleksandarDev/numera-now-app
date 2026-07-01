/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        // reactCompiler: true
    },
    async redirects() {
        return [
            {
                source: '/audit',
                destination: '/settings?section=audit',
                permanent: false,
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'enablebanking.com',
                pathname: '/brands/**',
            },
        ],
    },
};

export default nextConfig;
