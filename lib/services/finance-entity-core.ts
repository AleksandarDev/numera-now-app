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

export type TransactionDocumentCountTarget = {
    id: string;
    splitGroupId?: string | null;
};

export type TransactionDocumentReference = {
    transactionId?: string | null;
    documentTypeId: string;
};

export type TransactionDocumentCount = {
    total: number;
    requiredTypes: string[];
};

export const buildTransactionDocumentCounts = (
    transactions: TransactionDocumentCountTarget[],
    documents: TransactionDocumentReference[],
    requiredDocumentTypeIds: string[],
) => {
    const transactionById = new Map<string, TransactionDocumentCountTarget>();
    const groupMembers = new Map<string, string[]>();
    const requiredTypes = new Set(requiredDocumentTypeIds);

    for (const transaction of transactions) {
        if (transactionById.has(transaction.id)) continue;

        transactionById.set(transaction.id, transaction);

        if (transaction.splitGroupId) {
            const members = groupMembers.get(transaction.splitGroupId) ?? [];
            members.push(transaction.id);
            groupMembers.set(transaction.splitGroupId, members);
        }
    }

    const documentCounts = new Map<string, TransactionDocumentCount>();

    for (const document of documents) {
        if (!document.transactionId) continue;

        const attachedTransaction = transactionById.get(document.transactionId);
        if (!attachedTransaction) continue;

        const targetIds = attachedTransaction.splitGroupId
            ? (groupMembers.get(attachedTransaction.splitGroupId) ?? [
                  attachedTransaction.id,
              ])
            : [attachedTransaction.id];

        for (const targetId of targetIds) {
            const existing = documentCounts.get(targetId) ?? {
                total: 0,
                requiredTypes: [],
            };

            existing.total++;

            if (
                requiredTypes.has(document.documentTypeId) &&
                !existing.requiredTypes.includes(document.documentTypeId)
            ) {
                existing.requiredTypes.push(document.documentTypeId);
            }

            documentCounts.set(targetId, existing);
        }
    }

    return documentCounts;
};

export const normalizeIban = (iban: string) =>
    iban.toUpperCase().replace(/\s/g, '');

export const normalizeEntityDate = (value?: string | Date | null) => {
    if (!value) {
        return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
};
