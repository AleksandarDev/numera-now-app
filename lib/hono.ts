import { hc } from "hono/client";

import { AppType } from "@/app/api/[[...route]]/route";

const getAppUrl = () => {
    const url = process.env.NEXT_PUBLIC_VERCEL_URL;
    if (!url) {
        throw new Error("NEXT_PUBLIC_VERCEL_URL is not set");
    }

    return url.startsWith("http") ? url : `https://${url}`;
}

export const client = hc<AppType>(getAppUrl());