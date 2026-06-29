export const AUDITABILITY_MIGRATION_SEQUENCE = [
    {
        tag: '0043_same_the_initiative',
        purpose: 'Create audit_events before any route writes audit records.',
    },
    {
        tag: '0044_quick_spiral',
        purpose:
            'Add transaction soft-delete columns before transaction delete routes switch to recovery.',
    },
    {
        tag: '0045_misty_sauron',
        purpose:
            'Add document soft-delete columns before document delete routes retain blobs.',
    },
    {
        tag: '0046_colorful_rumiko_fujikawa',
        purpose:
            'Add customer and customer IBAN lifecycle columns before customer revert/trash UI ships.',
    },
] as const;

export const AUDITABILITY_RETENTION_POLICY = {
    auditEvents:
        'Retain audit_events for at least seven years for finance traceability; archival can move older events to cold storage only after exports remain queryable by user, resource, action, and date.',
    softDeletedRecords:
        'Retain soft-deleted transactions, documents, customers, and customer IBANs until an explicit user or operator purge path removes them.',
    documentBlobs:
        'Retain blobs while documents are soft-deleted; delete blobs only on explicit document purge and keep the purge audit event.',
    preMigrationHistory:
        'Do not synthesize historical audit events for changes made before audit_events existed; existing rows remain active through default false/null lifecycle columns.',
} as const;

export const AUDITABILITY_VERIFICATION_MATRIX = [
    {
        area: 'Reports',
        evidence:
            'Income statement, balance sheet, summary, open finances, and account balances filter transactions.deleted_at is null.',
    },
    {
        area: 'Reconciliation',
        evidence:
            'Reconciliation checks ignore soft-deleted transactions and documents.is_deleted rows.',
    },
    {
        area: 'Imports and sync',
        evidence:
            'Banking and Stripe dedupe across active and soft-deleted provider IDs to avoid recreating deleted transactions.',
    },
    {
        area: 'Recovery',
        evidence:
            'Transaction/document/customer/IBAN restore routes write explicit restore audit events.',
    },
    {
        area: 'Customer revert',
        evidence:
            'Customer profile and IBAN revert compare current state to the audit event after snapshot before writing.',
    },
    {
        area: 'Authorization',
        evidence:
            'Audit log queries scope to audit_events.user_id and recovery routes reuse resource ownership checks.',
    },
] as const;

export const auditabilityMigrationTags = () =>
    AUDITABILITY_MIGRATION_SEQUENCE.map((entry) => entry.tag);
