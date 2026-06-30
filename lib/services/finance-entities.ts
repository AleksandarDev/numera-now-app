import { UTCDate } from '@date-fns/utc';
import { endOfDay, parse, startOfYear } from 'date-fns';
import {
    aliasedTable,
    and,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    isNotNull,
    isNull,
    lte,
    or,
    sql,
} from 'drizzle-orm';

import { db } from '@/db/drizzle';
import {
    accounts,
    auditEvents,
    customerIbans,
    customers,
    documents,
    documentTransactionLinks,
    documentTypes,
    settings,
    tags,
    transactions,
    transactionTags,
} from '@/db/schema';
import { normalizeAuditEventSource } from '@/lib/audit-query';
import { generateDownloadUrl } from '@/lib/azure-storage';
import {
    buildTransactionDocumentCounts,
    type DeletedMode,
    escapeLikePattern,
    normalizeEntityDate,
    normalizeEntityLimit,
    normalizeEntityOffset,
    splitSearchKeywords,
} from '@/lib/services/finance-entity-core';

type Database = typeof db;

export type ServicePageOptions = {
    limit?: number | null;
    offset?: number | null;
};

export type ListAccountsInput = ServicePageOptions & {
    userId: string;
    search?: string | null;
    accountId?: string | null;
    showClosed?: boolean | null;
};

export type ListAuditEventsInput = ServicePageOptions & {
    userId: string;
    resourceType?: string | null;
    resourceId?: string | null;
    actorUserId?: string | null;
    actorType?: 'user' | 'system' | 'integration' | null;
    action?: string | null;
    from?: string | Date | null;
    to?: string | Date | null;
    source?: string | null;
};

export type ListCustomersInput = ServicePageOptions & {
    userId: string;
    search?: string | null;
    deleted?: DeletedMode;
};

export type ListCustomerIbansInput = ServicePageOptions & {
    userId: string;
    customerId: string;
    deleted?: DeletedMode;
    customerDeleted?: DeletedMode;
};

export type ListDocumentsInput = ServicePageOptions & {
    userId: string;
    documentTypeId?: string | null;
    from?: string | Date | null;
    to?: string | Date | null;
    unattached?: boolean | null;
    deleted?: DeletedMode;
    includeDownloadUrl?: boolean;
};

export type ListTagsInput = ServicePageOptions & {
    userId: string;
};

export type ListTransactionsInput = ServicePageOptions & {
    userId: string;
    id?: string | null;
    from?: string | null;
    to?: string | null;
    accountId?: string | null;
    payeeCustomerId?: string | null;
    deleted?: DeletedMode;
};

const applyLimitOffset = <
    T extends { limit: (limit: number) => T; offset: (offset: number) => T },
>(
    query: T,
    options: ServicePageOptions,
) => {
    let current = query;
    if (typeof options.limit === 'number') {
        current = current.limit(normalizeEntityLimit(options.limit));
    }
    if (typeof options.offset === 'number') {
        current = current.offset(normalizeEntityOffset(options.offset));
    }
    return current;
};

const customerDeletedFilter = (deleted?: DeletedMode) => {
    if (deleted === 'include') {
        return undefined;
    }

    if (deleted === 'only') {
        return eq(customers.isDeleted, true);
    }

    return eq(customers.isDeleted, false);
};

const customerIbanDeletedFilter = (deleted?: DeletedMode) => {
    if (deleted === 'include') {
        return undefined;
    }

    if (deleted === 'only') {
        return eq(customerIbans.isDeleted, true);
    }

    return eq(customerIbans.isDeleted, false);
};

const documentDeletedFilter = (deleted?: DeletedMode) => {
    if (deleted === 'include') {
        return undefined;
    }

    if (deleted === 'only') {
        return eq(documents.isDeleted, true);
    }

    return eq(documents.isDeleted, false);
};

const transactionDeletedFilter = (deleted?: DeletedMode) => {
    if (deleted === 'include') {
        return undefined;
    }

    if (deleted === 'only') {
        return isNotNull(transactions.deletedAt);
    }

    return isNull(transactions.deletedAt);
};

const createTransactionAccessFilter = (
    userId: string,
    creditAccounts: ReturnType<typeof aliasedTable<typeof accounts>>,
    debitAccounts: ReturnType<typeof aliasedTable<typeof accounts>>,
) =>
    or(
        eq(accounts.userId, userId),
        eq(creditAccounts.userId, userId),
        eq(debitAccounts.userId, userId),
        and(
            isNull(transactions.accountId),
            isNull(transactions.creditAccountId),
            isNull(transactions.debitAccountId),
            eq(transactions.statusChangedBy, userId),
        ),
    );

export const listAccounts = async (
    input: ListAccountsInput,
    database: Database = db,
) => {
    const keywords = splitSearchKeywords(input.search);
    const searchConditions = keywords.map((keyword) =>
        or(
            ilike(accounts.name, `%${keyword}%`),
            ilike(accounts.code, `%${keyword}%`),
        ),
    );

    const query = database
        .select({
            id: accounts.id,
            name: accounts.name,
            code: accounts.code,
            isOpen: accounts.isOpen,
            isReadOnly: accounts.isReadOnly,
            accountType: accounts.accountType,
            accountClass: accounts.accountClass,
            openingBalance: accounts.openingBalance,
        })
        .from(accounts)
        .where(
            and(
                searchConditions.length > 0
                    ? and(...searchConditions)
                    : undefined,
                eq(accounts.userId, input.userId),
                input.accountId ? eq(accounts.id, input.accountId) : undefined,
                input.showClosed ? undefined : eq(accounts.isOpen, true),
            ),
        )
        .$dynamic();

    const data = await applyLimitOffset(query, input);

    return data.map((account) => {
        let hasInvalidConfig = false;

        if (account.isOpen && account.code && account.code.length > 1) {
            const parentCodes: string[] = [];
            for (let i = 1; i < account.code.length; i++) {
                parentCodes.push(account.code.substring(0, i));
            }

            const closedParents = data.filter(
                (candidate) =>
                    candidate.code &&
                    parentCodes.includes(candidate.code) &&
                    !candidate.isOpen,
            );

            hasInvalidConfig = closedParents.length > 0;
        }

        return {
            ...account,
            hasInvalidConfig,
        };
    });
};

export const getAccount = async (
    input: { userId: string; id: string },
    database: Database = db,
) => {
    const [account] = await database
        .select({
            id: accounts.id,
            name: accounts.name,
            code: accounts.code,
            isOpen: accounts.isOpen,
            isReadOnly: accounts.isReadOnly,
            accountType: accounts.accountType,
            accountClass: accounts.accountClass,
            openingBalance: accounts.openingBalance,
        })
        .from(accounts)
        .where(
            and(eq(accounts.userId, input.userId), eq(accounts.id, input.id)),
        );

    return account ?? null;
};

export const listTags = async (
    input: ListTagsInput,
    database: Database = db,
) => {
    const query = database
        .select({
            id: tags.id,
            name: tags.name,
            color: tags.color,
            tagType: tags.tagType,
        })
        .from(tags)
        .where(eq(tags.userId, input.userId))
        .$dynamic();

    return applyLimitOffset(query, input);
};

export const getTag = async (
    input: { userId: string; id: string },
    database: Database = db,
) => {
    const [tag] = await database
        .select({
            id: tags.id,
            name: tags.name,
            color: tags.color,
            tagType: tags.tagType,
        })
        .from(tags)
        .where(and(eq(tags.userId, input.userId), eq(tags.id, input.id)));

    return tag ?? null;
};

export const listCustomers = async (
    input: ListCustomersInput,
    database: Database = db,
) => {
    const escapedSearch = input.search ? escapeLikePattern(input.search) : '';
    const query = database
        .select({
            id: customers.id,
            name: customers.name,
            friendlyName: customers.friendlyName,
            website: customers.website,
            avatarImage: customers.avatarImage,
            vatNumber: customers.vatNumber,
            address: customers.address,
            contactEmail: customers.contactEmail,
            contactTelephone: customers.contactTelephone,
            country: customers.country,
            isComplete: customers.isComplete,
            isOwnFirm: customers.isOwnFirm,
            isDeleted: customers.isDeleted,
            deletedAt: customers.deletedAt,
            deletedBy: customers.deletedBy,
            deleteReason: customers.deleteReason,
            restoredAt: customers.restoredAt,
            restoredBy: customers.restoredBy,
            restoreReason: customers.restoreReason,
            transactionCount: sql<number>`count(${transactions.id})`.as(
                'transaction_count',
            ),
        })
        .from(customers)
        .leftJoin(
            transactions,
            and(
                eq(customers.id, transactions.payeeCustomerId),
                isNull(transactions.deletedAt),
            ),
        )
        .where(
            and(
                eq(customers.userId, input.userId),
                customerDeletedFilter(input.deleted),
                input.search
                    ? or(
                          ilike(customers.name, `%${escapedSearch}%`),
                          ilike(customers.friendlyName, `%${escapedSearch}%`),
                          ilike(customers.website, `%${escapedSearch}%`),
                          ilike(customers.vatNumber, `%${escapedSearch}%`),
                      )
                    : undefined,
            ),
        )
        .groupBy(customers.id)
        .orderBy(desc(customers.name))
        .$dynamic();

    return applyLimitOffset(query, input);
};

export const getCustomer = async (
    input: { userId: string; id: string; deleted?: DeletedMode },
    database: Database = db,
) => {
    const [customer] = await database
        .select()
        .from(customers)
        .where(
            and(
                eq(customers.id, input.id),
                eq(customers.userId, input.userId),
                customerDeletedFilter(input.deleted),
            ),
        );

    return customer ?? null;
};

export const listCustomerIbans = async (
    input: ListCustomerIbansInput,
    database: Database = db,
) => {
    const customer = await getCustomer(
        {
            id: input.customerId,
            userId: input.userId,
            deleted: input.customerDeleted,
        },
        database,
    );

    if (!customer) {
        return null;
    }

    const query = database
        .select()
        .from(customerIbans)
        .where(
            and(
                eq(customerIbans.customerId, input.customerId),
                customerIbanDeletedFilter(input.deleted),
            ),
        )
        .$dynamic();

    return applyLimitOffset(query, input);
};

export const listAuditEvents = async (
    input: ListAuditEventsInput,
    database: Database = db,
) => {
    const from = normalizeEntityDate(input.from);
    const to = normalizeEntityDate(input.to);
    const source = normalizeAuditEventSource(input.source);
    const conditions = [eq(auditEvents.userId, input.userId)];

    if (input.resourceType) {
        conditions.push(eq(auditEvents.resourceType, input.resourceType));
    }

    if (input.resourceId) {
        conditions.push(eq(auditEvents.resourceId, input.resourceId));
    }

    if (input.actorUserId) {
        conditions.push(eq(auditEvents.actorUserId, input.actorUserId));
    }

    if (input.actorType) {
        conditions.push(eq(auditEvents.actorType, input.actorType));
    }

    if (input.action) {
        conditions.push(eq(auditEvents.action, input.action));
    }

    if (from) {
        conditions.push(gte(auditEvents.createdAt, from));
    }

    if (to) {
        conditions.push(lte(auditEvents.createdAt, to));
    }

    if (source) {
        conditions.push(
            sql`${auditEvents.sourceMetadata}->>'source' = ${source}`,
        );
    }

    const query = database
        .select()
        .from(auditEvents)
        .where(and(...conditions))
        .orderBy(desc(auditEvents.createdAt))
        .$dynamic();

    return applyLimitOffset(query, {
        ...input,
        limit: input.limit ?? 100,
    });
};

export const listDocuments = async (
    input: ListDocumentsInput,
    database: Database = db,
) => {
    const conditions = [eq(documents.uploadedBy, input.userId)];
    const deletedFilter = documentDeletedFilter(input.deleted);
    const from = normalizeEntityDate(input.from);
    const to = normalizeEntityDate(input.to);

    if (deletedFilter) conditions.push(deletedFilter);

    if (!input.deleted) {
        const activeTransactionFilter = or(
            isNull(documents.transactionId),
            isNull(transactions.deletedAt),
        );
        if (activeTransactionFilter) {
            conditions.push(activeTransactionFilter);
        }
    }

    if (input.documentTypeId) {
        conditions.push(eq(documents.documentTypeId, input.documentTypeId));
    }

    if (from) {
        conditions.push(gte(documents.uploadedAt, from));
    }

    if (to) {
        conditions.push(lte(documents.uploadedAt, to));
    }

    if (input.unattached) {
        const unattachedFilter = and(
            isNull(documents.transactionId),
            isNull(documentTransactionLinks.id),
        );
        if (unattachedFilter) {
            conditions.push(unattachedFilter);
        }
    }

    const query = database
        .select({
            id: documents.id,
            fileName: documents.fileName,
            fileSize: documents.fileSize,
            mimeType: documents.mimeType,
            documentTypeId: documents.documentTypeId,
            documentTypeName: documentTypes.name,
            transactionId: sql<
                string | null
            >`coalesce(${documentTransactionLinks.transactionId}, ${documents.transactionId})`,
            uploadedBy: documents.uploadedBy,
            uploadedAt: documents.uploadedAt,
            storagePath: documents.storagePath,
            isDeleted: documents.isDeleted,
            deletedAt: documents.deletedAt,
            deletedBy: documents.deletedBy,
            deleteReason: documents.deleteReason,
            restoredAt: documents.restoredAt,
            restoredBy: documents.restoredBy,
            restoreReason: documents.restoreReason,
            transactionDate: transactions.date,
            transactionPayee: transactions.payee,
        })
        .from(documents)
        .leftJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
        .leftJoin(
            documentTransactionLinks,
            eq(documentTransactionLinks.documentId, documents.id),
        )
        .leftJoin(
            transactions,
            eq(
                transactions.id,
                sql`coalesce(${documentTransactionLinks.transactionId}, ${documents.transactionId})`,
            ),
        )
        .where(and(...conditions))
        .orderBy(desc(documents.uploadedAt))
        .$dynamic();

    const data = await applyLimitOffset(query, input);
    const documentsById = new Map<
        string,
        (typeof data)[number] & {
            transactionIds: string[];
            transactionCount: number;
        }
    >();

    for (const document of data) {
        const existing = documentsById.get(document.id);
        const transactionIds = existing?.transactionIds ?? [];
        if (
            document.transactionId &&
            !transactionIds.includes(document.transactionId)
        ) {
            transactionIds.push(document.transactionId);
        }

        documentsById.set(document.id, {
            ...(existing ?? document),
            transactionIds,
            transactionCount: transactionIds.length,
        });
    }

    const aggregatedDocuments = [...documentsById.values()];

    if (input.includeDownloadUrl === false) {
        return aggregatedDocuments;
    }

    return aggregatedDocuments.map((document) => ({
        ...document,
        downloadUrl: generateDownloadUrl(document.storagePath),
    }));
};

export const getDocument = async (
    input: { userId: string; id: string; deleted?: DeletedMode },
    database: Database = db,
) => {
    const [document] = await database
        .select()
        .from(documents)
        .where(
            and(
                eq(documents.id, input.id),
                eq(documents.uploadedBy, input.userId),
                documentDeletedFilter(input.deleted),
            ),
        );

    return document ?? null;
};

export const listTransactions = async (
    input: ListTransactionsInput,
    database: Database = db,
) => {
    const startDate = input.from
        ? parse(input.from, 'yyyy-MM-dd', new UTCDate())
        : startOfYear(new UTCDate());
    const endDate = input.to
        ? endOfDay(parse(input.to, 'yyyy-MM-dd', new UTCDate()))
        : new UTCDate();
    const creditAccounts = aliasedTable(accounts, 'creditAccounts');
    const debitAccounts = aliasedTable(accounts, 'debitAccounts');

    const [userSettings] = await database
        .select({
            minRequiredDocuments: settings.minRequiredDocuments,
            requiredDocumentTypeIds: settings.requiredDocumentTypeIds,
        })
        .from(settings)
        .where(eq(settings.userId, input.userId));

    const minRequiredDocs = userSettings?.minRequiredDocuments ?? 0;
    const requiredDocTypeIds = userSettings?.requiredDocumentTypeIds
        ? JSON.parse(userSettings.requiredDocumentTypeIds)
        : [];

    const query = database
        .select({
            id: transactions.id,
            date: transactions.date,
            payee: transactions.payee,
            payeeCustomerId: transactions.payeeCustomerId,
            payeeCustomerName:
                sql<string>`coalesce(${customers.friendlyName}, ${customers.name})`.as(
                    'payee_customer_name',
                ),
            amount: transactions.amount,
            notes: transactions.notes,
            account: accounts.name,
            accountCode: accounts.code,
            accountId: transactions.accountId,
            accountIsOpen: accounts.isOpen,
            accountClass: accounts.accountClass,
            creditAccount: creditAccounts.name,
            creditAccountCode: creditAccounts.code,
            creditAccountId: transactions.creditAccountId,
            creditAccountIsOpen: creditAccounts.isOpen,
            creditAccountType: creditAccounts.accountType,
            creditAccountClass: creditAccounts.accountClass,
            debitAccount: debitAccounts.name,
            debitAccountCode: debitAccounts.code,
            debitAccountId: transactions.debitAccountId,
            debitAccountIsOpen: debitAccounts.isOpen,
            debitAccountType: debitAccounts.accountType,
            debitAccountClass: debitAccounts.accountClass,
            status: transactions.status,
            statusChangedAt: transactions.statusChangedAt,
            statusChangedBy: transactions.statusChangedBy,
            splitGroupId: transactions.splitGroupId,
            splitType: transactions.splitType,
            stripePaymentId: transactions.stripePaymentId,
            deletedAt: transactions.deletedAt,
            deletedBy: transactions.deletedBy,
            deleteReason: transactions.deleteReason,
            restoredAt: transactions.restoredAt,
            restoredBy: transactions.restoredBy,
            restoreReason: transactions.restoreReason,
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(
            creditAccounts,
            eq(transactions.creditAccountId, creditAccounts.id),
        )
        .leftJoin(
            debitAccounts,
            eq(transactions.debitAccountId, debitAccounts.id),
        )
        .leftJoin(customers, eq(transactions.payeeCustomerId, customers.id))
        .where(
            and(
                input.accountId
                    ? or(
                          eq(transactions.accountId, input.accountId),
                          eq(transactions.creditAccountId, input.accountId),
                          eq(transactions.debitAccountId, input.accountId),
                      )
                    : undefined,
                input.id ? eq(transactions.id, input.id) : undefined,
                input.payeeCustomerId
                    ? eq(transactions.payeeCustomerId, input.payeeCustomerId)
                    : undefined,
                createTransactionAccessFilter(
                    input.userId,
                    creditAccounts,
                    debitAccounts,
                ),
                gte(transactions.date, startDate),
                lte(transactions.date, endDate),
                transactionDeletedFilter(input.deleted),
            ),
        )
        .orderBy(desc(transactions.date))
        .$dynamic();

    const data = await applyLimitOffset(query, input);
    const transactionIds = data.map((transaction) => transaction.id);
    const splitGroupIds = [
        ...new Set(
            data
                .map((transaction) => transaction.splitGroupId)
                .filter((id): id is string => Boolean(id)),
        ),
    ];
    let documentCountTargets = data.map((transaction) => ({
        id: transaction.id,
        splitGroupId: transaction.splitGroupId,
    }));
    let documentCounts = buildTransactionDocumentCounts(
        documentCountTargets,
        [],
        requiredDocTypeIds,
    );

    if (transactionIds.length > 0) {
        if (splitGroupIds.length > 0) {
            const memberCreditAccounts = aliasedTable(
                accounts,
                'memberCreditAccounts',
            );
            const memberDebitAccounts = aliasedTable(
                accounts,
                'memberDebitAccounts',
            );
            const splitGroupMembers = await database
                .select({
                    id: transactions.id,
                    splitGroupId: transactions.splitGroupId,
                })
                .from(transactions)
                .leftJoin(accounts, eq(transactions.accountId, accounts.id))
                .leftJoin(
                    memberCreditAccounts,
                    eq(transactions.creditAccountId, memberCreditAccounts.id),
                )
                .leftJoin(
                    memberDebitAccounts,
                    eq(transactions.debitAccountId, memberDebitAccounts.id),
                )
                .where(
                    and(
                        inArray(transactions.splitGroupId, splitGroupIds),
                        createTransactionAccessFilter(
                            input.userId,
                            memberCreditAccounts,
                            memberDebitAccounts,
                        ),
                        transactionDeletedFilter(input.deleted),
                    ),
                );

            documentCountTargets = [
                ...documentCountTargets,
                ...splitGroupMembers,
            ];
        }

        const documentTransactionIds = [
            ...new Set(documentCountTargets.map((target) => target.id)),
        ];
        const docsData = await database
            .select({
                documentId: documents.id,
                transactionId: documents.transactionId,
                documentTypeId: documents.documentTypeId,
            })
            .from(documents)
            .where(
                and(
                    inArray(documents.transactionId, documentTransactionIds),
                    eq(documents.isDeleted, false),
                ),
            );
        const linkedDocsData = await database
            .select({
                documentId: documents.id,
                transactionId: documentTransactionLinks.transactionId,
                documentTypeId: documents.documentTypeId,
            })
            .from(documentTransactionLinks)
            .innerJoin(
                documents,
                eq(documentTransactionLinks.documentId, documents.id),
            )
            .where(
                and(
                    inArray(
                        documentTransactionLinks.transactionId,
                        documentTransactionIds,
                    ),
                    eq(documents.isDeleted, false),
                ),
            );

        documentCounts = buildTransactionDocumentCounts(
            documentCountTargets,
            [...docsData, ...linkedDocsData],
            requiredDocTypeIds,
        );
    }

    const transactionTagsMap: Map<
        string,
        Array<{ id: string; name: string; color: string | null }>
    > = new Map();

    if (transactionIds.length > 0) {
        const tagsData = await database
            .select({
                transactionId: transactionTags.transactionId,
                tagId: tags.id,
                tagName: tags.name,
                tagColor: tags.color,
            })
            .from(transactionTags)
            .innerJoin(tags, eq(transactionTags.tagId, tags.id))
            .where(inArray(transactionTags.transactionId, transactionIds));

        for (const tagData of tagsData) {
            const existing =
                transactionTagsMap.get(tagData.transactionId) ?? [];
            existing.push({
                id: tagData.tagId,
                name: tagData.tagName,
                color: tagData.tagColor,
            });
            transactionTagsMap.set(tagData.transactionId, existing);
        }
    }

    return data.map((transaction) => {
        const attachedRequiredCount =
            documentCounts.get(transaction.id)?.requiredTypes.length ?? 0;
        const totalRequiredTypes = requiredDocTypeIds.length;
        let hasAllRequiredDocuments = true;

        if (totalRequiredTypes > 0) {
            hasAllRequiredDocuments =
                minRequiredDocs === 0
                    ? attachedRequiredCount >= totalRequiredTypes
                    : attachedRequiredCount >=
                      Math.min(minRequiredDocs, totalRequiredTypes);
        }

        return {
            ...transaction,
            tags: transactionTagsMap.get(transaction.id) ?? [],
            documentCount: documentCounts.get(transaction.id)?.total ?? 0,
            hasAllRequiredDocuments,
            requiredDocumentTypes: totalRequiredTypes,
            attachedRequiredTypes: attachedRequiredCount,
            minRequiredDocuments: minRequiredDocs,
        };
    });
};

export const getTransaction = async (
    input: { userId: string; id: string; deleted?: DeletedMode },
    database: Database = db,
) => {
    const [transaction] = await listTransactions(
        {
            userId: input.userId,
            id: input.id,
            deleted: input.deleted ?? 'include',
            limit: 1,
        },
        database,
    );

    return transaction ?? null;
};
