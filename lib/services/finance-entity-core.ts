export const DEFAULT_ENTITY_LIMIT = 50;
export const MAX_ENTITY_LIMIT = 100;

export type DeletedMode = 'include' | 'only';

export const normalizeEntityLimit = (
    value?: number | null,
    options?: { defaultLimit?: number; maxLimit?: number },
) => {
    const defaultLimit = options?.defaultLimit ?? DEFAULT_ENTITY_LIMIT;
    const maxLimit = options?.maxLimit ?? MAX_ENTITY_LIMIT;

    if (!Number.isFinite(value) || !value || value < 1) {
        return defaultLimit;
    }

    return Math.min(Math.floor(value), maxLimit);
};

export const normalizeEntityOffset = (value?: number | null) => {
    if (!Number.isFinite(value) || !value || value < 0) {
        return 0;
    }

    return Math.floor(value);
};

export const normalizeDeletedMode = (
    value?: string | null,
): DeletedMode | undefined => {
    if (value === 'include' || value === 'only') {
        return value;
    }

    return undefined;
};

export const escapeLikePattern = (value: string): string =>
    value.replace(/[\\%_]/g, '\\$&');

export const splitSearchKeywords = (search?: string | null) =>
    (search?.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [])
        .map((keyword) => keyword.replace(/"/g, '').trim())
        .filter(Boolean);

export const normalizeIban = (iban: string) =>
    iban.toUpperCase().replace(/\s/g, '');

export const normalizeEntityDate = (value?: string | Date | null) => {
    if (!value) {
        return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
};
