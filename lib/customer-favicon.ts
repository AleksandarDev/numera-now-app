import { isIP } from 'node:net';

const MAX_HTML_BYTES = 512 * 1024;
const MAX_ICON_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

const IMAGE_MIME_BY_EXTENSION = new Map([
    ['.ico', 'image/x-icon'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.webp', 'image/webp'],
    ['.gif', 'image/gif'],
]);

const ACCEPTED_IMAGE_MIME_TYPES = new Set([
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/vnd.microsoft.icon',
    'image/webp',
    'image/x-icon',
]);

type FetchInit = Omit<RequestInit, 'redirect' | 'signal'>;

type FaviconCandidate = {
    url: string;
    rel: string;
    sizes: string | null;
    type: string | null;
};

export const normalizeCustomerWebsite = (
    website?: string | null,
): string | null => {
    const trimmed = website?.trim();
    if (!trimmed) {
        return null;
    }

    const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;

    try {
        const url = new URL(withProtocol);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return null;
        }

        url.username = '';
        url.password = '';
        url.hash = '';

        if (!isPublicFetchUrl(url)) {
            return null;
        }

        return url.toString();
    } catch {
        return null;
    }
};

const isPublicFetchUrl = (url: URL) => {
    const hostname = url.hostname.toLowerCase();
    const ipHostname = hostname.replace(/^\[|\]$/g, '');

    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local')
    ) {
        return false;
    }

    const ipVersion = isIP(ipHostname);
    if (ipVersion === 4) {
        return isPublicIpv4(ipHostname);
    }

    if (ipVersion === 6) {
        return isPublicIpv6(ipHostname);
    }

    return true;
};

const isPublicIpv4 = (hostname: string) => {
    const octets = hostname.split('.').map((part) => Number(part));
    if (
        octets.length !== 4 ||
        octets.some((octet) => !Number.isInteger(octet) || octet < 0)
    ) {
        return false;
    }

    const [first, second] = octets;
    if (first === undefined || second === undefined) {
        return false;
    }

    return !(
        first === 0 ||
        first === 10 ||
        first === 127 ||
        first >= 224 ||
        (first === 100 && second >= 64 && second <= 127) ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 198 && (second === 18 || second === 19))
    );
};

const isPublicIpv6 = (hostname: string) => {
    const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return !(
        normalized === '::1' ||
        normalized === '::' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80:')
    );
};

const fetchWithRedirects = async (
    initialUrl: string,
    init: FetchInit,
    redirectsRemaining = MAX_REDIRECTS,
): Promise<Response | null> => {
    const url = new URL(initialUrl);
    if (!isPublicFetchUrl(url)) {
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...init,
            redirect: 'manual',
            signal: controller.signal,
            headers: {
                'user-agent': 'Numera favicon fetcher',
                ...init.headers,
            },
        });

        if (
            response.status >= 300 &&
            response.status < 400 &&
            response.headers.has('location')
        ) {
            if (redirectsRemaining <= 0) {
                return null;
            }

            const nextUrl = new URL(
                response.headers.get('location') ?? '',
                url,
            );
            if (
                !['http:', 'https:'].includes(nextUrl.protocol) ||
                !isPublicFetchUrl(nextUrl)
            ) {
                return null;
            }

            return fetchWithRedirects(
                nextUrl.toString(),
                init,
                redirectsRemaining - 1,
            );
        }

        return response;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
};

const readResponseBytes = async (
    response: Response,
    maxBytes: number,
): Promise<Buffer | null> => {
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
        return null;
    }

    if (!response.body) {
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer.byteLength <= maxBytes ? buffer : null;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
            return null;
        }

        chunks.push(value);
    }

    return Buffer.concat(chunks);
};

const getMimeType = (url: string, contentTypeHeader: string | null) => {
    const contentType = contentTypeHeader?.split(';')[0]?.trim().toLowerCase();
    if (contentType && ACCEPTED_IMAGE_MIME_TYPES.has(contentType)) {
        return contentType;
    }

    const pathname = new URL(url).pathname.toLowerCase();
    for (const [extension, mimeType] of IMAGE_MIME_BY_EXTENSION) {
        if (pathname.endsWith(extension)) {
            return mimeType;
        }
    }

    return null;
};

const parseAttributes = (tag: string) => {
    const attributes = new Map<string, string>();
    const attributePattern =
        /\s([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

    for (const match of tag.matchAll(attributePattern)) {
        const [, name, doubleQuoted, singleQuoted, bare] = match;
        if (!name) continue;
        attributes.set(
            name.toLowerCase(),
            doubleQuoted ?? singleQuoted ?? bare ?? '',
        );
    }

    return attributes;
};

const extractFaviconCandidates = (html: string, pageUrl: string) => {
    const candidates: FaviconCandidate[] = [];
    const seenUrls = new Set<string>();
    const linkPattern = /<link\b[^>]*>/gi;

    for (const match of html.matchAll(linkPattern)) {
        const attributes = parseAttributes(match[0]);
        const rel = attributes.get('rel')?.toLowerCase() ?? '';
        const relTokens = rel.split(/\s+/).filter(Boolean);
        const href = attributes.get('href');

        if (
            !href ||
            (!relTokens.includes('icon') &&
                !relTokens.includes('apple-touch-icon') &&
                !relTokens.includes('apple-touch-icon-precomposed'))
        ) {
            continue;
        }

        try {
            const candidateUrl = new URL(href, pageUrl);
            if (
                !['http:', 'https:'].includes(candidateUrl.protocol) ||
                !isPublicFetchUrl(candidateUrl) ||
                seenUrls.has(candidateUrl.toString())
            ) {
                continue;
            }

            seenUrls.add(candidateUrl.toString());
            candidates.push({
                url: candidateUrl.toString(),
                rel,
                sizes: attributes.get('sizes') ?? null,
                type: attributes.get('type')?.toLowerCase() ?? null,
            });
        } catch {}
    }

    return candidates.sort((left, right) => {
        return scoreFaviconCandidate(right) - scoreFaviconCandidate(left);
    });
};

const scoreFaviconCandidate = (candidate: FaviconCandidate) => {
    let score = 0;

    if (candidate.type === 'image/svg+xml') {
        score += 120;
    }

    if (candidate.rel.includes('apple-touch-icon')) {
        score += 25;
    }

    if (candidate.sizes === 'any') {
        score += 80;
    } else if (candidate.sizes) {
        const bestSize = candidate.sizes
            .split(/\s+/)
            .map((size) => size.match(/^(\d+)x(\d+)$/i))
            .filter((match): match is RegExpMatchArray => !!match)
            .map((match) => Math.min(Number(match[1]), Number(match[2])))
            .filter((size) => Number.isFinite(size) && size > 0)
            .sort((left, right) => Math.abs(left - 64) - Math.abs(right - 64))
            .at(0);

        if (bestSize) {
            score += Math.max(0, 80 - Math.abs(bestSize - 64));
        }
    }

    return score;
};

const fetchHtml = async (websiteUrl: string) => {
    try {
        const response = await fetchWithRedirects(websiteUrl, {
            headers: {
                accept: 'text/html,application/xhtml+xml',
            },
        });

        if (!response?.ok) {
            return null;
        }

        const contentType = response.headers
            .get('content-type')
            ?.split(';')[0]
            ?.trim()
            .toLowerCase();

        if (
            contentType &&
            !['text/html', 'application/xhtml+xml'].includes(contentType)
        ) {
            return null;
        }

        const bytes = await readResponseBytes(response, MAX_HTML_BYTES);
        return bytes ? new TextDecoder().decode(bytes) : null;
    } catch {
        return null;
    }
};

const fetchIconDataUrl = async (iconUrl: string) => {
    try {
        const response = await fetchWithRedirects(iconUrl, {
            headers: {
                accept: 'image/avif,image/webp,image/svg+xml,image/png,image/*,*/*;q=0.8',
            },
        });

        if (!response?.ok) {
            return null;
        }

        const mimeType = getMimeType(
            iconUrl,
            response.headers.get('content-type'),
        );
        if (!mimeType) {
            return null;
        }

        const bytes = await readResponseBytes(response, MAX_ICON_BYTES);
        if (!bytes || bytes.byteLength === 0) {
            return null;
        }

        return `data:${mimeType};base64,${bytes.toString('base64')}`;
    } catch {
        return null;
    }
};

export const fetchCustomerAvatarImage = async (
    website?: string | null,
): Promise<string | null> => {
    const normalizedWebsite = normalizeCustomerWebsite(website);
    if (!normalizedWebsite) {
        return null;
    }

    const html = await fetchHtml(normalizedWebsite);
    const candidates = html
        ? extractFaviconCandidates(html, normalizedWebsite)
        : [];

    const origin = new URL(normalizedWebsite).origin;
    for (const fallback of ['/favicon.svg', '/favicon.png', '/favicon.ico']) {
        candidates.push({
            url: new URL(fallback, origin).toString(),
            rel: 'icon',
            sizes: null,
            type: null,
        });
    }

    const seenUrls = new Set<string>();
    for (const candidate of candidates) {
        if (seenUrls.has(candidate.url)) {
            continue;
        }

        seenUrls.add(candidate.url);
        const dataUrl = await fetchIconDataUrl(candidate.url);
        if (dataUrl) {
            return dataUrl;
        }
    }

    return null;
};
