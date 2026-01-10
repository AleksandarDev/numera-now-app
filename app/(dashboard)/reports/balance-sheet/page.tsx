'use client';

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { format } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { DateFilter } from '@/components/date-filter';
import { useGetBalanceSheet } from '@/features/reports/api/use-get-balance-sheet';
import { cn, formatCurrency } from '@/lib/utils';

type Account = {
    id: string;
    name: string;
    code: string | null;
    balance: number;
    isReadOnly?: boolean;
};

type AccountNode = Account & {
    level: number;
    children: AccountNode[];
};

function buildAccountHierarchy(accounts: Account[]): AccountNode[] {
    const accountMap = new Map<string, AccountNode>();
    const rootNodes: AccountNode[] = [];

    // Create nodes for all accounts
    accounts.forEach((account) => {
        if (account.code) {
            accountMap.set(account.code, {
                ...account,
                level: account.code.length - 1,
                children: [],
            });
        }
    });

    // Build parent-child relationships
    accounts.forEach((account) => {
        if (!account.code) return;

        const node = accountMap.get(account.code);
        if (!node) return;

        if (account.code.length === 1) {
            // Top-level account
            rootNodes.push(node);
        } else {
            // Find parent (code with one less digit)
            const parentCode = account.code.slice(0, -1);
            const parent = accountMap.get(parentCode);
            if (parent) {
                parent.children.push(node);
            } else {
                // If parent not found, treat as root
                rootNodes.push(node);
            }
        }
    });

    return rootNodes;
}

function renderAccountNode(node: AccountNode): React.ReactElement {
    const indent = node.level * 16; // 16px per level

    return (
        <div key={node.id}>
            <div
                className="flex justify-between items-center py-1"
                style={{ paddingLeft: `${indent + 16}px` }}
            >
                <div className="flex items-center gap-2">
                    <Typography level="body1" className="font-medium">
                        {node.name}
                    </Typography>
                    {node.code && (
                        <Typography
                            level="body2"
                            mono
                            className="text-muted-foreground"
                        >
                            {node.code}
                        </Typography>
                    )}
                </div>
                <Typography
                    level="body1"
                    mono
                    className={cn(
                        'font-medium',
                        node.balance < 0 && 'text-red-600',
                    )}
                >
                    {formatCurrency(node.balance)}
                </Typography>
            </div>
            {node.children.map((child) => renderAccountNode(child))}
        </div>
    );
}

export default function BalanceSheetPage() {
    const balanceSheet = useGetBalanceSheet();

    if (balanceSheet.isLoading) {
        return (
            <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <Loader2 className="size-6 animate-spin text-slate-300" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (balanceSheet.isError) {
        return (
            <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <p className="text-red-600">
                            Failed to load balance sheet
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const data = balanceSheet.data;

    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
            <Card>
                <CardHeader>
                    <CardTitle>Balance Sheet</CardTitle>
                    {data && (
                        <p className="text-sm text-muted-foreground">
                            As of{' '}
                            {format(new Date(data.asOfDate), 'MMM dd, yyyy')}
                        </p>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <DateFilter />
                    {data && (
                        <Stack spacing={4}>
                            {/* Warning if unbalanced */}
                            {!data.isBalanced && (
                                <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <AlertTriangle className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <Typography
                                            level="body1"
                                            className="font-semibold text-yellow-900"
                                        >
                                            Balance Sheet is Unbalanced
                                        </Typography>
                                        <Typography
                                            level="body2"
                                            className="text-yellow-800"
                                        >
                                            Assets do not equal Liabilities +
                                            Equity. Difference:{' '}
                                            {formatCurrency(data.difference)}
                                        </Typography>
                                    </div>
                                </div>
                            )}

                            {/* Assets Section */}
                            <div>
                                <Typography
                                    level="h4"
                                    className="font-semibold mb-3"
                                >
                                    Assets
                                </Typography>
                                <div className="space-y-2">
                                    {data.assetAccounts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground pl-4">
                                            No asset accounts
                                        </p>
                                    ) : (
                                        buildAccountHierarchy(
                                            data.assetAccounts,
                                        ).map((node) => renderAccountNode(node))
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-900 font-semibold">
                                        <Typography
                                            level="body1"
                                            className="font-bold"
                                        >
                                            Total Assets
                                        </Typography>
                                        <Typography
                                            level="body1"
                                            mono
                                            className={cn(
                                                'font-bold',
                                                data.totalAssets < 0 &&
                                                    'text-red-600',
                                            )}
                                        >
                                            {formatCurrency(data.totalAssets)}
                                        </Typography>
                                    </div>
                                </div>
                            </div>

                            {/* Liabilities Section */}
                            <div>
                                <Typography
                                    level="h4"
                                    className="font-semibold mb-3"
                                >
                                    Liabilities
                                </Typography>
                                <div className="space-y-2">
                                    {data.liabilityAccounts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground pl-4">
                                            No liability accounts
                                        </p>
                                    ) : (
                                        buildAccountHierarchy(
                                            data.liabilityAccounts,
                                        ).map((node) => renderAccountNode(node))
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-900 font-semibold">
                                        <Typography
                                            level="body1"
                                            className="font-bold"
                                        >
                                            Total Liabilities
                                        </Typography>
                                        <Typography
                                            level="body1"
                                            mono
                                            className={cn(
                                                'font-bold',
                                                data.totalLiabilities < 0 &&
                                                    'text-red-600',
                                            )}
                                        >
                                            {formatCurrency(
                                                data.totalLiabilities,
                                            )}
                                        </Typography>
                                    </div>
                                </div>
                            </div>

                            {/* Equity Section */}
                            <div>
                                <Typography
                                    level="h4"
                                    className="font-semibold mb-3"
                                >
                                    Equity
                                </Typography>
                                <div className="space-y-2">
                                    {data.equityAccounts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground pl-4">
                                            No equity accounts
                                        </p>
                                    ) : (
                                        buildAccountHierarchy(
                                            data.equityAccounts,
                                        ).map((node) => renderAccountNode(node))
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-900 font-semibold">
                                        <Typography
                                            level="body1"
                                            className="font-bold"
                                        >
                                            Total Equity
                                        </Typography>
                                        <Typography
                                            level="body1"
                                            mono
                                            className={cn(
                                                'font-bold',
                                                data.totalEquity < 0 &&
                                                    'text-red-600',
                                            )}
                                        >
                                            {formatCurrency(data.totalEquity)}
                                        </Typography>
                                    </div>
                                </div>
                            </div>

                            {/* Total Liabilities and Equity Section */}
                            <div className="pt-4 border-t-4 border-gray-900">
                                <div className="flex justify-between items-center">
                                    <Typography
                                        level="h3"
                                        className="font-bold text-lg"
                                    >
                                        Total Liabilities and Equity
                                    </Typography>
                                    <Typography
                                        level="h3"
                                        mono
                                        className={cn(
                                            'font-bold text-lg',
                                            data.liabilitiesAndEquity < 0 &&
                                                'text-red-600',
                                        )}
                                    >
                                        {formatCurrency(
                                            data.liabilitiesAndEquity,
                                        )}
                                    </Typography>
                                </div>
                            </div>
                        </Stack>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
