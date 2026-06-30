export const CUSTOMER_PROFILE_REVERT_FIELDS = [
    'name',
    'friendlyName',
    'website',
    'avatarImage',
    'vatNumber',
    'address',
    'contactEmail',
    'contactTelephone',
    'country',
    'isComplete',
    'isOwnFirm',
] as const;

export const CUSTOMER_IBAN_REVERT_FIELDS = [
    'iban',
    'bankName',
    'isDeleted',
    'deletedAt',
    'deletedBy',
    'deleteReason',
    'restoredAt',
    'restoredBy',
    'restoreReason',
] as const;

export const CUSTOMER_LIFECYCLE_REVERT_FIELDS = [
    ...CUSTOMER_PROFILE_REVERT_FIELDS,
    'isDeleted',
    'deletedAt',
    'deletedBy',
    'deleteReason',
    'restoredAt',
    'restoredBy',
    'restoreReason',
] as const;

type CustomerLifecyclePatchInput = {
    userId: string;
    reason?: string | null;
    now?: Date;
};

export type RecordValue = string | number | boolean | null | Date | undefined;
export type SnapshotRecord = Record<string, RecordValue>;

const comparableValue = (value: unknown) => {
    if (value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return value;
};

const collectRevertConflicts = (
    fields: readonly string[],
    current: SnapshotRecord,
    eventAfter: SnapshotRecord,
) =>
    fields.filter(
        (field) =>
            field in eventAfter &&
            comparableValue(current[field]) !==
                comparableValue(eventAfter[field]),
    );

export const createCustomerSoftDeletePatch = ({
    userId,
    reason = null,
    now = new Date(),
}: CustomerLifecyclePatchInput) => ({
    isDeleted: true,
    deletedAt: now,
    deletedBy: userId,
    deleteReason: reason,
    restoredAt: null,
    restoredBy: null,
    restoreReason: null,
});

export const createCustomerRestorePatch = ({
    userId,
    reason = null,
    now = new Date(),
}: CustomerLifecyclePatchInput) => ({
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    restoredAt: now,
    restoredBy: userId,
    restoreReason: reason,
});

export const createCustomerIbanSoftDeletePatch = ({
    userId,
    reason = null,
    now = new Date(),
}: CustomerLifecyclePatchInput) => ({
    isDeleted: true,
    deletedAt: now,
    deletedBy: userId,
    deleteReason: reason,
    restoredAt: null,
    restoredBy: null,
    restoreReason: null,
});

export const createCustomerIbanRestorePatch = ({
    userId,
    reason = null,
    now = new Date(),
}: CustomerLifecyclePatchInput) => ({
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    restoredAt: now,
    restoredBy: userId,
    restoreReason: reason,
});

export const createCustomerProfileRevertPatch = (eventBefore: SnapshotRecord) =>
    Object.fromEntries(
        CUSTOMER_PROFILE_REVERT_FIELDS.filter(
            (field) => field in eventBefore,
        ).map((field) => [field, eventBefore[field] ?? null]),
    );

export const getCustomerProfileRevertConflicts = ({
    current,
    eventAfter,
}: {
    current: SnapshotRecord;
    eventAfter: SnapshotRecord;
}) =>
    collectRevertConflicts(CUSTOMER_PROFILE_REVERT_FIELDS, current, eventAfter);

export const getCustomerLifecycleRevertConflicts = ({
    current,
    eventAfter,
}: {
    current: SnapshotRecord;
    eventAfter: SnapshotRecord;
}) =>
    collectRevertConflicts(
        CUSTOMER_LIFECYCLE_REVERT_FIELDS,
        current,
        eventAfter,
    );

export const getCustomerIbanRevertConflicts = ({
    current,
    eventAfter,
}: {
    current: SnapshotRecord;
    eventAfter: SnapshotRecord;
}) => collectRevertConflicts(CUSTOMER_IBAN_REVERT_FIELDS, current, eventAfter);
