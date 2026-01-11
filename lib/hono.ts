import { hc } from 'hono/client';

import type { AppType } from '@/app/api/[[...route]]/route';

const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;

const getAppUrl = () => {
    const url =
        vercelEnv === 'preview'
            ? process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL ||
              process.env.NEXT_PUBLIC_VERCEL_URL ||
              process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
            : process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
              process.env.NEXT_PUBLIC_VERCEL_URL;
    if (!url) {
        throw new Error(
            'NEXT_PUBLIC_VERCEL_URL or NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL is not set',
        );
    }

    return url.startsWith('http') ? url : `https://${url}`;
};

export const client = hc<AppType>(getAppUrl());
