'use client';

import type { AuditEvent } from '@/features/audit/api/use-get-audit-events';
import { useGetAuditEvents } from '@/features/audit/api/use-get-audit-events';
import { AuditEventList } from '@/features/audit/components/audit-event-list';

type AuditHistoryPanelProps = {
    resourceType: string;
    resourceId?: string | null;
    limit?: number;
    onRevertCustomerEvent?: (event: AuditEvent, customerId: string) => void;
    revertingEventId?: string | null;
};

export const AuditHistoryPanel = ({
    resourceType,
    resourceId,
    limit = 50,
    onRevertCustomerEvent,
    revertingEventId,
}: AuditHistoryPanelProps) => {
    const auditEventsQuery = useGetAuditEvents({
        resourceType,
        resourceId: resourceId ?? undefined,
        limit,
    });

    if (!resourceId) {
        return (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
                Save this record before viewing audit history.
            </div>
        );
    }

    return (
        <AuditEventList
            events={auditEventsQuery.data}
            isLoading={auditEventsQuery.isLoading}
            isError={auditEventsQuery.isError}
            emptyMessage="No audit history recorded for this record."
            onRevertCustomerEvent={onRevertCustomerEvent}
            revertingEventId={revertingEventId}
        />
    );
};
