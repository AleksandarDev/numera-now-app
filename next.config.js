/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        // reactCompiler: true
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
