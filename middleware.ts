import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/open-finances(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
    const response = NextResponse.next();

    // Allow open finances pages to be embedded in iframes
    if (req.nextUrl.pathname.startsWith('/open-finances/')) {
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

    // Protect non-public routes
    if (!isPublicRoute(req)) {
        await auth.protect();
    }

    return response;
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
