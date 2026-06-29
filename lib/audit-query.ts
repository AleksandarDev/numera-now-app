export const DEFAULT_AUDIT_EVENT_LIMIT = 100;
export const MAX_AUDIT_EVENT_LIMIT = 200;

export const normalizeAuditEventLimit = (value?: number | null) => {
    if (!Number.isFinite(value) || !value || value < 1) {
        return DEFAULT_AUDIT_EVENT_LIMIT;
    }

    return Math.min(Math.floor(value), MAX_AUDIT_EVENT_LIMIT);
};

export const normalizeAuditEventSource = (value?: string | null) => {
    const source = value?.trim();
    return source ? source : undefined;
};

export const normalizeAuditEventDate = (value?: string | null) => {
    if (!value) {
        return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
};
