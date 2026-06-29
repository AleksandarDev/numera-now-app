'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AuditEvent } from '@/features/audit/api/use-get-audit-events';

type AuditJsonObject = Record<string, unknown>;

type AuditEventListProps = {
    events?: AuditEvent[];
    isLoading?: boolean;
    isError?: boolean;
    emptyMessage?: string;
    onRevertCustomerEvent?: (event: AuditEvent, customerId: string) => void;
    revertingEventId?: string | null;
};

const skeletonKeys = [
    'audit-event-skeleton-1',
    'audit-event-skeleton-2',
    'audit-event-skeleton-3',
    'audit-event-skeleton-4',
];

const isObject = (value: unknown): value is AuditJsonObject =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const isFieldDelta = (
    value: unknown,
): value is { before: unknown; after: unknown } =>
    isObject(value) && 'before' in value && 'after' in value;

const getSource = (event: AuditEvent) =>
    isObject(event.sourceMetadata) &&
    typeof event.sourceMetadata.source === 'string'
        ? event.sourceMetadata.source
        : null;

export const getAuditEventCustomerId = (event: AuditEvent) => {
    if (event.resourceType === 'customer') {
        return event.resourceId;
    }

    if (
        event.resourceType === 'customer_iban' &&
        isObject(event.sourceMetadata) &&
        typeof event.sourceMetadata.customerId === 'string'
    ) {
        return event.sourceMetadata.customerId;
    }

    return null;
};

const getChangedFields = (event: AuditEvent) => {
    if (!isObject(event.fieldDelta)) {
        return [];
    }

    return Object.keys(event.fieldDelta);
};

const formatDateTime = (value: string | Date) =>
    format(new Date(value), 'MMM d, yyyy HH:mm');

const formatValue = (value: unknown) => {
    if (value === null || value === undefined) {
        return 'empty';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    return JSON.stringify(value);
};

const FieldDelta = ({ event }: { event: AuditEvent }) => {
    if (!isObject(event.fieldDelta)) {
        return null;
    }

    const entries = Object.entries(event.fieldDelta).filter(
        (entry): entry is [string, { before: unknown; after: unknown }] =>
            isFieldDelta(entry[1]),
    );

    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="mt-3 space-y-1.5">
            {entries.slice(0, 8).map(([field, delta]) => (
                <div
                    key={field}
                    className="grid grid-cols-[120px_1fr] gap-2 text-xs"
                >
                    <div className="font-medium text-muted-foreground">
                        {field}
                    </div>
                    <div className="min-w-0">
                        <span className="break-words text-muted-foreground">
                            {formatValue(delta.before)}
                        </span>
                        <span className="px-1.5 text-muted-foreground">
                            -&gt;
                        </span>
                        <span className="break-words">
                            {formatValue(delta.after)}
                        </span>
                    </div>
                </div>
            ))}
            {entries.length > 8 && (
                <div className="text-xs text-muted-foreground">
                    +{entries.length - 8} more fields
                </div>
            )}
        </div>
    );
};

export const AuditEventList = ({
    events,
    isLoading,
    isError,
    emptyMessage = 'No audit events found.',
    onRevertCustomerEvent,
    revertingEventId,
}: AuditEventListProps) => {
    if (isLoading) {
        return (
            <div className="space-y-2">
                {skeletonKeys.map((key) => (
                    <div
                        key={key}
                        className="h-24 animate-pulse rounded-md border bg-muted/30"
                    />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">
                Failed to load audit history.
            </div>
        );
    }

    if (!events || events.length === 0) {
        return (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {events.map((event) => {
                const source = getSource(event);
                const changedFields = getChangedFields(event);
                const customerId = getAuditEventCustomerId(event);
                const canRevert =
                    !!onRevertCustomerEvent &&
                    !!customerId &&
                    (event.resourceType === 'customer' ||
                        event.resourceType === 'customer_iban') &&
                    !event.revertedFromEventId;

                return (
                    <div key={event.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        {event.action}
                                    </Badge>
                                    <span className="text-sm font-medium">
                                        {event.resourceLabel ||
                                            event.resourceId}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {event.resourceType}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {formatDateTime(event.createdAt)}
                                    {event.actorUserId
                                        ? ` by ${event.actorUserId}`
                                        : ` by ${event.actorType}`}
                                    {source ? ` - ${source}` : ''}
                                </div>
                                {changedFields.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {changedFields
                                            .slice(0, 8)
                                            .map((field) => (
                                                <Badge
                                                    key={field}
                                                    variant="outline"
                                                >
                                                    {field}
                                                </Badge>
                                            ))}
                                        {changedFields.length > 8 && (
                                            <Badge variant="outline">
                                                +{changedFields.length - 8}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                            {canRevert && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outlined"
                                    disabled={revertingEventId === event.id}
                                    onClick={() =>
                                        onRevertCustomerEvent(event, customerId)
                                    }
                                >
                                    <RotateCcw className="mr-2 size-4" />
                                    Revert
                                </Button>
                            )}
                        </div>
                        <FieldDelta event={event} />
                    </div>
                );
            })}
        </div>
    );
};
