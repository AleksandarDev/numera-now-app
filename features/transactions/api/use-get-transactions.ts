import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';

import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetTransactions = () => {
    const [{ from, to, accountId }] = useQueryStates({
        from: parseAsString,
        to: parseAsString,
        accountId: parseAsString,
    });
    const queryFrom = from ?? undefined;
    const queryTo = to ?? undefined;
    const queryAccountId = accountId ?? undefined;

    const query = useQuery({
        queryKey: [
            'transactions',
            { from: queryFrom, to: queryTo, accountId: queryAccountId },
        ],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const response = await client.api.transactions.$get({
                query: {
                    from: queryFrom,
                    to: queryTo,
                    accountId: queryAccountId,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch transactions.');

            const { data } = await response.json();

            type SplitMeta = {
                role: 'parent' | 'child';
                childIndex?: number;
                childCount?: number;
                isLastChild?: boolean;
            };

            type SplitSummary = ReturnType<typeof buildSplitSummary>;

            type TransactionWithMeta = (typeof data)[number] & {
                amount: number;
                splitMeta?: SplitMeta;
                splitSummary?: SplitSummary;
            };

            const converted: TransactionWithMeta[] = data.map((transaction) => ({
                ...transaction,
                amount: convertAmountFromMiliunits(transaction.amount),
            }));

            const sortedByDateDesc = [...converted].sort((a, b) => {
                const aTime = new Date(a.date).getTime();
                const bTime = new Date(b.date).getTime();
                if (aTime !== bTime) return bTime - aTime;
                return a.id.localeCompare(b.id);
            });

            const statusOrder = {
                draft: 0,
                pending: 1,
                completed: 2,
                reconciled: 3,
            } as const;

            const normalizeStatus = (status?: string | null) => {
                if (!status) return 'pending';
                return status in statusOrder ? status : 'pending';
            };

            const getStatusRank = (status?: string | null) =>
                statusOrder[
                    normalizeStatus(status) as keyof typeof statusOrder
                ];

            /**
             * Aggregates data from child transactions to create a summary for parent split transactions.
             *
             * @param children - Array of child transactions belonging to a split group
             * @returns A summary object containing:
             *   - status: The lowest status among all children (draft < pending < completed < reconciled)
             *   - tags: Unique tags collected from all children
             *   - documentCount: Total count of documents across all children
             *   - hasAllRequiredDocuments: True only if all children have required documents
             *   - creditAccounts/debitAccounts/singleAccounts: Unique accounts aggregated from children
             *   - customers: Unique customer names from all children
             *   - totalAmount: Sum of amounts from all children
             */
            const buildSplitSummary = (children: typeof converted) => {
                const tagsMap = new Map<
                    string,
                    { id: string; name: string; color?: string | null }
                >();
                const creditAccountsMap = new Map<
                    string,
                    { id: string; name: string; code?: string | null }
                >();
                const debitAccountsMap = new Map<
                    string,
                    { id: string; name: string; code?: string | null }
                >();
                const singleAccountsMap = new Map<
                    string,
                    { id: string; name: string; code?: string | null }
                >();
                const customersSet = new Set<string>();

                let documentCount = 0;
                let hasAllRequiredDocuments = true;
                let requiredDocumentTypes = 0;
                let minRequiredDocuments = 0;
                let attachedRequiredTypes = Number.POSITIVE_INFINITY;
                let status: string | null = null;
                let totalAmount = 0;

                const addAccount = (
                    id?: string | null,
                    name?: string | null,
                    code?: string | null,
                    targetMap?: Map<
                        string,
                        { id: string; name: string; code?: string | null }
                    >,
                ) => {
                    if (!id || !name) return;
                    const map = targetMap ?? singleAccountsMap;
                    if (!map.has(id)) {
                        map.set(id, { id, name, code });
                    }
                };

                for (const child of children) {
                    if (child.tags) {
                        for (const tag of child.tags) {
                            tagsMap.set(tag.id, tag);
                        }
                    }

                    documentCount += child.documentCount ?? 0;
                    hasAllRequiredDocuments =
                        hasAllRequiredDocuments &&
                        (child.hasAllRequiredDocuments ?? true);
                    requiredDocumentTypes = Math.max(
                        requiredDocumentTypes,
                        child.requiredDocumentTypes ?? 0,
                    );
                    minRequiredDocuments = Math.max(
                        minRequiredDocuments,
                        child.minRequiredDocuments ?? 0,
                    );
                    attachedRequiredTypes = Math.min(
                        attachedRequiredTypes,
                        child.attachedRequiredTypes ?? 0,
                    );
                    totalAmount += child.amount ?? 0;

                    if (!status) {
                        status = normalizeStatus(child.status);
                    } else if (
                        getStatusRank(child.status) < getStatusRank(status)
                    ) {
                        status = normalizeStatus(child.status);
                    }

                    addAccount(
                        child.accountId,
                        child.account,
                        child.accountCode,
                        singleAccountsMap,
                    );
                    addAccount(
                        child.creditAccountId,
                        child.creditAccount,
                        child.creditAccountCode,
                        creditAccountsMap,
                    );
                    addAccount(
                        child.debitAccountId,
                        child.debitAccount,
                        child.debitAccountCode,
                        debitAccountsMap,
                    );

                    const customerName =
                        child.payeeCustomerName ?? child.payee ?? null;
                    if (customerName) {
                        customersSet.add(customerName);
                    }
                }

                return {
                    status: normalizeStatus(status),
                    tags: Array.from(tagsMap.values()),
                    documentCount,
                    hasAllRequiredDocuments,
                    requiredDocumentTypes,
                    attachedRequiredTypes:
                        attachedRequiredTypes === Number.POSITIVE_INFINITY
                            ? 0
                            : attachedRequiredTypes,
                    minRequiredDocuments,
                    totalAmount,
                    creditAccounts: Array.from(creditAccountsMap.values()),
                    debitAccounts: Array.from(debitAccountsMap.values()),
                    singleAccounts: Array.from(singleAccountsMap.values()),
                    customers: Array.from(customersSet),
                };
            };

            const splitGroups = new Map<
                string,
                {
                    parent?: (typeof converted)[number];
                    children: typeof converted;
                }
            >();

            for (const tx of sortedByDateDesc) {
                if (!tx.splitGroupId) continue;
                const entry = splitGroups.get(tx.splitGroupId) ?? {
                    children: [],
                };
                if (tx.splitType === 'parent') {
                    entry.parent = tx;
                } else if (tx.splitType === 'child') {
                    entry.children.push(tx);
                }
                splitGroups.set(tx.splitGroupId, entry);
            }

            const ordered: typeof converted = [];
            const seen = new Set<string>();

            for (const tx of sortedByDateDesc) {
                if (seen.has(tx.id)) continue;

                if (tx.splitGroupId && tx.splitType === 'parent') {
                    ordered.push(tx);
                    seen.add(tx.id);
                    const kids =
                        splitGroups.get(tx.splitGroupId)?.children ?? [];
                    for (const child of kids) {
                        if (!seen.has(child.id)) {
                            ordered.push(child);
                            seen.add(child.id);
                        }
                    }
                } else if (!tx.splitGroupId || tx.splitType !== 'child') {
                    ordered.push(tx);
                    seen.add(tx.id);
                }
            }

            // Any orphan children (missing parent) get appended at end
            for (const tx of sortedByDateDesc) {
                if (!seen.has(tx.id)) {
                    ordered.push(tx);
                    seen.add(tx.id);
                }
            }

            for (const group of splitGroups.values()) {
                if (group.parent) {
                    group.parent.splitMeta = {
                        role: 'parent',
                        childCount: group.children.length,
                    };
                    if (group.children.length > 0) {
                        group.parent.splitSummary = buildSplitSummary(
                            group.children,
                        );
                    }
                }

                group.children.forEach((child, index) => {
                    child.splitMeta = {
                        role: 'child',
                        childIndex: index,
                        childCount: group.children.length,
                        isLastChild: index === group.children.length - 1,
                    };
                });
            }

            return ordered;
        },
    });

    return query;
};
