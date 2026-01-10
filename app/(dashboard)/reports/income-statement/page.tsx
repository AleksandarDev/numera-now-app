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
import { Loader2 } from 'lucide-react';

import { useGetIncomeStatement } from '@/features/reports/api/use-get-income-statement';
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

export default function IncomeStatementPage() {
    const incomeStatement = useGetIncomeStatement();

    if (incomeStatement.isLoading) {
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

    if (incomeStatement.isError) {
        return (
            <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <p className="text-red-600">
                            Failed to load income statement
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const data = incomeStatement.data;

    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
            <Card>
                <CardHeader>
                    <CardTitle>Income Statement</CardTitle>
                    {data && (
                        <p className="text-sm text-muted-foreground">
                            {format(new Date(data.startDate), 'MMM dd, yyyy')} -{' '}
                            {format(new Date(data.endDate), 'MMM dd, yyyy')}
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    {data && (
                        <Stack spacing={4}>
                            {/* Income Section */}
                            <div>
                                <Typography
                                    level="h4"
                                    className="font-semibold mb-3"
                                >
                                    Income
                                </Typography>
                                <div className="space-y-2">
                                    {data.incomeAccounts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground pl-4">
                                            No income accounts
                                        </p>
                                    ) : (
                                        buildAccountHierarchy(
                                            data.incomeAccounts,
                                        ).map((node) => renderAccountNode(node))
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-900 font-semibold">
                                        <Typography
                                            level="body1"
                                            className="font-bold"
                                        >
                                            Total Income
                                        </Typography>
                                        <Typography
                                            level="body1"
                                            mono
                                            className={cn(
                                                'font-bold',
                                                data.totalIncome < 0 &&
                                                    'text-red-600',
                                            )}
                                        >
                                            {formatCurrency(data.totalIncome)}
                                        </Typography>
                                    </div>
                                </div>
                            </div>

                            {/* Expenses Section */}
                            <div>
                                <Typography
                                    level="h4"
                                    className="font-semibold mb-3"
                                >
                                    Expenses
                                </Typography>
                                <div className="space-y-2">
                                    {data.expenseAccounts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground pl-4">
                                            No expense accounts
                                        </p>
                                    ) : (
                                        buildAccountHierarchy(
                                            data.expenseAccounts,
                                        ).map((node) => renderAccountNode(node))
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-900 font-semibold">
                                        <Typography
                                            level="body1"
                                            className="font-bold"
                                        >
                                            Total Expenses
                                        </Typography>
                                        <Typography
                                            level="body1"
                                            mono
                                            className={cn(
                                                'font-bold',
                                                data.totalExpenses < 0 &&
                                                    'text-red-600',
                                            )}
                                        >
                                            {formatCurrency(data.totalExpenses)}
                                        </Typography>
                                    </div>
                                </div>
                            </div>

                            {/* Net Income Section */}
                            <div className="pt-4 border-t-4 border-gray-900">
                                <div className="flex justify-between items-center">
                                    <Typography
                                        level="h3"
                                        className="font-bold text-lg"
                                    >
                                        Net Income
                                    </Typography>
                                    <Typography
                                        level="h3"
                                        mono
                                        className={cn(
                                            'font-bold text-lg',
                                            data.netIncome < 0
                                                ? 'text-red-600'
                                                : 'text-green-600',
                                        )}
                                    >
                                        {formatCurrency(data.netIncome)}
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
