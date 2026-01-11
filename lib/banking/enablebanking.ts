import { createSign } from 'node:crypto';

export const ENABLE_BANKING_API_BASE = 'https://api.enablebanking.com';

const JWT_ISSUER = 'enablebanking.com';
const JWT_AUDIENCE = 'api.enablebanking.com';
const DEFAULT_JWT_TTL_SECONDS = 5 * 60;

export type EnableBankingCredentials = {
    applicationId: string;
    privateKey: string;
};

const base64UrlEncode = (value: string | Buffer) =>
    (Buffer.isBuffer(value) ? value : Buffer.from(value))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

export const createEnableBankingJwt = (
    credentials: EnableBankingCredentials,
    ttlSeconds = DEFAULT_JWT_TTL_SECONDS,
) => {
    const now = Math.floor(Date.now() / 1000);
    const header = {
        typ: 'JWT',
        alg: 'RS256',
        kid: credentials.applicationId,
    };
    const payload = {
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
        iat: now,
        exp: now + ttlSeconds,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();

    const signature = signer.sign(credentials.privateKey);
    const encodedSignature = base64UrlEncode(signature);

    return `${signingInput}.${encodedSignature}`;
};

export const getEnableBankingHeaders = (
    credentials: EnableBankingCredentials,
): HeadersInit => ({
    Accept: 'application/json',
    Authorization: `Bearer ${createEnableBankingJwt(credentials)}`,
});
