import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
    '/',
    '/accounts(.*)',
    '/transactions(.*)',
    '/customers(.*)',
    '/settings(.*)',
    '/new(.*)',
]);

export const proxy = clerkMiddleware(async (auth, request) => {
    const response = NextResponse.next();

    // Allow open finances pages to be embedded in iframes
    if (request.nextUrl.pathname.startsWith('/open-finances/')) {
        // Remove X-Frame-Options to allow embedding
        response.headers.delete('X-Frame-Options');
        // Set CSP to allow embedding from any origin
        // Note: In production, consider restricting this to specific domains
        // by setting ALLOWED_EMBED_ORIGINS environment variable
        const allowedOrigins = process.env.ALLOWED_EMBED_ORIGINS || "'self' *";
        response.headers.set(
            'Content-Security-Policy',
            `frame-ancestors ${allowedOrigins}`,
        );
        // Add CORS headers for public API access
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    }

    // Protect routes that are not open-finances
    if (isProtectedRoute(request)) {
        await auth.protect();
    }

    return response;
});

export const config = {
    matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
