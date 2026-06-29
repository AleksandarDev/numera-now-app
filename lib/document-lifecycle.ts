export const DOCUMENT_SOFT_DELETE_BLOB_POLICY =
    'Soft-deleted documents retain their blob storage object; blobs are removed only by explicit purge.';

export const createDocumentSoftDeletePatch = ({
    userId,
    reason = null,
    now = new Date(),
}: {
    userId: string;
    reason?: string | null;
    now?: Date;
}) => ({
    isDeleted: true,
    deletedAt: now,
    deletedBy: userId,
    deleteReason: reason,
    restoredAt: null,
    restoredBy: null,
    restoreReason: null,
});

export const createDocumentRestorePatch = ({
    userId,
    reason = null,
    now = new Date(),
}: {
    userId: string;
    reason?: string | null;
    now?: Date;
}) => ({
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    restoredAt: now,
    restoredBy: userId,
    restoreReason: reason,
});
