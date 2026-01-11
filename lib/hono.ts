import { hc } from 'hono/client';

import type { AppType } from '@/app/api/[[...route]]/route';

const getAppUrl = () => {
    const url =
        process.env.NEXT_PUBLIC_VERCEL_URL ||
        process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    if (!url) {
        throw new Error(
            'NEXT_PUBLIC_VERCEL_URL or NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL is not set',
        );
    }

    return url.startsWith('http') ? url : `https://${url}`;
};

export const client = hc<AppType>(getAppUrl());
