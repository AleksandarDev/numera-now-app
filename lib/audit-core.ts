import { createId } from '@paralleldrive/cuid2';

export const AUDIT_REDACTED_VALUE = '[REDACTED]';

export type AuditActorType = 'user' | 'system' | 'integration';

export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'restore'
    | 'purge'
    | 'import'
    | 'sync'
    | 'status_change'
    | 'link'
    | 'unlink'
    | 'settings_update'
    | 'integration_event';

export type AuditJson =
    | null
    | string
    | number
    | boolean
    | AuditJson[]
    | { [key: string]: AuditJson };

export type AuditFieldDelta = Record<
    string,
    {
        before: AuditJson;
        after: AuditJson;
    }
>;

export type AuditEventInput = {
    userId: string;
    actorUserId?: string | null;
    actorType: AuditActorType;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    resourceLabel?: string | null;
    before?: unknown;
    after?: unknown;
    fieldDelta?: AuditFieldDelta | null;
    sourceMetadata?: unknown;
    requestId?: string | null;
    revertedFromEventId?: string | null;
};

export const AUDIT_TRANSACTION_UNSUPPORTED_MESSAGE =
    'Audit mutations require a transaction-capable database client.';

export type AuditTransactionRunner<Database> = {
    transaction: <Result>(
        callback: (tx: Database) => Promise<Result>,
    ) => Promise<Result>;
};

const sensitiveKeyPatterns = [
    /api[_-]?key/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /secret/i,
    /password/i,
    /credential/i,
    /webhook/i,
];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const isSensitiveKey = (key: string) =>
    sensitiveKeyPatterns.some((pattern) => pattern.test(key));

const normalizeAuditValue = (
    value: unknown,
    redactSensitiveKeys = true,
): AuditJson => {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((entry) =>
            normalizeAuditValue(entry, redactSensitiveKeys),
        );
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
                key,
                redactSensitiveKeys && isSensitiveKey(key)
                    ? AUDIT_REDACTED_VALUE
                    : normalizeAuditValue(entry, redactSensitiveKeys),
            ]),
        );
    }

    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    return String(value);
};

export const redactAuditPayload = (value: unknown): AuditJson =>
    normalizeAuditValue(value);

const auditJsonEquals = (left: AuditJson, right: AuditJson) =>
    JSON.stringify(left) === JSON.stringify(right);

export const createAuditFieldDelta = (
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined,
): AuditFieldDelta => {
    const delta: AuditFieldDelta = {};
    const keys = new Set([
        ...Object.keys(before ?? {}),
        ...Object.keys(after ?? {}),
    ]);

    for (const key of keys) {
        const beforeValue = isSensitiveKey(key)
            ? AUDIT_REDACTED_VALUE
            : normalizeAuditValue(before?.[key]);
        const afterValue = isSensitiveKey(key)
            ? AUDIT_REDACTED_VALUE
            : normalizeAuditValue(after?.[key]);
        const beforeComparable = normalizeAuditValue(before?.[key], false);
        const afterComparable = normalizeAuditValue(after?.[key], false);

        if (!auditJsonEquals(beforeComparable, afterComparable)) {
            delta[key] = {
                before: beforeValue,
                after: afterValue,
            };
        }
    }

    return delta;
};

export const buildAuditEventValues = (input: AuditEventInput) => {
    const before =
        input.before === undefined ? null : redactAuditPayload(input.before);
    const after =
        input.after === undefined ? null : redactAuditPayload(input.after);
    const fieldDelta =
        input.fieldDelta ??
        (isPlainObject(input.before) || isPlainObject(input.after)
            ? createAuditFieldDelta(
                  isPlainObject(input.before) ? input.before : null,
                  isPlainObject(input.after) ? input.after : null,
              )
            : null);

    return {
        id: createId(),
        userId: input.userId,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        resourceLabel: input.resourceLabel ?? null,
        before,
        after,
        fieldDelta: fieldDelta === null ? null : redactAuditPayload(fieldDelta),
        sourceMetadata:
            input.sourceMetadata === undefined
                ? null
                : redactAuditPayload(input.sourceMetadata),
        requestId: input.requestId ?? null,
        revertedFromEventId: input.revertedFromEventId ?? null,
    };
};

export const runAuditedMutation = async <Result, Database>(
    database: Partial<AuditTransactionRunner<Database>>,
    callback: (tx: Database) => Promise<Result>,
) => {
    if (typeof database.transaction !== 'function') {
        throw new Error(AUDIT_TRANSACTION_UNSUPPORTED_MESSAGE);
    }

    try {
        return await database.transaction(callback);
    } catch (error) {
        if (
            error instanceof Error &&
            /No transactions support/i.test(error.message)
        ) {
            throw new Error(AUDIT_TRANSACTION_UNSUPPORTED_MESSAGE, {
                cause: error,
            });
        }

        throw error;
    }
};
