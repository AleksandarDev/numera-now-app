import { createId } from '@paralleldrive/cuid2';
import type {
    AuditAction,
    AuditActorType,
    AuditEventInput,
} from './audit-core';

type MutationAuditContext = {
    method: string;
    path: string;
    status: number;
    userId: string;
    actorUserId?: string | null;
    actorType?: AuditActorType;
    requestId?: string | null;
    responseJson?: unknown;
    source?: string;
};

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const collectionActionSegments = new Set([
    'bulk-create',
    'bulk-delete',
    'generate-upload-url',
    'generate-standalone-upload-url',
    'standalone',
    'sync',
    'test',
    'types',
]);

const getPathSegments = (path: string) =>
    path
        .split('?')[0]
        .split('/')
        .filter(Boolean)
        .filter((segment) => segment !== 'api');

const getRecordId = (value: unknown): string | null => {
    if (!value || typeof value !== 'object' || !('id' in value)) {
        return null;
    }

    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' && id ? id : null;
};

const getResponseData = (responseJson: unknown) => {
    if (
        responseJson &&
        typeof responseJson === 'object' &&
        'data' in responseJson
    ) {
        return (responseJson as { data?: unknown }).data;
    }

    return undefined;
};

export const shouldAuditHttpMutation = (method: string, status: number) =>
    mutationMethods.has(method.toUpperCase()) && status >= 200 && status < 400;

export const inferAuditAction = (method: string, path: string): AuditAction => {
    const segments = getPathSegments(path);
    const methodName = method.toUpperCase();

    if (segments.includes('sync')) {
        return 'sync';
    }

    if (segments.includes('link')) {
        return 'link';
    }

    if (segments.includes('unlink')) {
        return 'unlink';
    }

    if (segments.includes('bulk-delete') || methodName === 'DELETE') {
        return 'delete';
    }

    if (methodName === 'PATCH' || methodName === 'PUT') {
        return 'update';
    }

    if (segments.includes('test') || segments.includes('generate-upload-url')) {
        return 'integration_event';
    }

    return 'create';
};

export const inferAuditResourceType = (path: string) =>
    getPathSegments(path)[0]?.replaceAll('-', '_') ?? 'unknown';

export const inferAuditResourceId = (
    path: string,
    responseJson: unknown,
    requestId: string,
) => {
    const responseData = getResponseData(responseJson);
    const responseId = Array.isArray(responseData)
        ? null
        : getRecordId(responseData);

    if (responseId) {
        return responseId;
    }

    const [, maybeId] = getPathSegments(path);
    if (maybeId && !collectionActionSegments.has(maybeId)) {
        return maybeId;
    }

    return `operation:${requestId}`;
};

export const getAuditResponseRecords = (responseJson: unknown) => {
    const responseData = getResponseData(responseJson);

    if (Array.isArray(responseData)) {
        return responseData.filter((entry) => getRecordId(entry));
    }

    return getRecordId(responseData) ? [responseData] : [];
};

export const buildMutationAuditEvents = ({
    method,
    path,
    status,
    userId,
    actorUserId = userId,
    actorType = 'user',
    requestId = createId(),
    responseJson,
    source = 'hono_route',
}: MutationAuditContext): AuditEventInput[] => {
    if (!shouldAuditHttpMutation(method, status)) {
        return [];
    }

    const resolvedRequestId = requestId || createId();
    const action = inferAuditAction(method, path);
    const resourceType = inferAuditResourceType(path);
    const sourceMetadata = {
        method,
        path,
        status,
        source,
    };
    const events: AuditEventInput[] = [
        {
            userId,
            actorUserId,
            actorType,
            action,
            resourceType,
            resourceId: inferAuditResourceId(
                path,
                responseJson,
                resolvedRequestId,
            ),
            sourceMetadata: {
                ...sourceMetadata,
                auditLevel: 'operation',
            },
            requestId: resolvedRequestId,
        },
    ];

    for (const record of getAuditResponseRecords(responseJson)) {
        const recordId = getRecordId(record);
        if (!recordId) continue;

        events.push({
            userId,
            actorUserId,
            actorType,
            action,
            resourceType,
            resourceId: recordId,
            after: record,
            sourceMetadata: {
                ...sourceMetadata,
                auditLevel: 'record',
            },
            requestId: resolvedRequestId,
        });
    }

    return events;
};
