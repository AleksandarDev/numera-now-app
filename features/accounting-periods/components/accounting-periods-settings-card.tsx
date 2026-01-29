'use client';

import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Table } from '@signalco/ui-primitives/Table';
import { format } from 'date-fns';
import { CalendarClock, Loader2, MoreHorizontal, Trash } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteAccountingPeriod } from '@/features/accounting-periods/api/use-delete-accounting-period';
import { useGetAccountingPeriods } from '@/features/accounting-periods/api/use-get-accounting-periods';
import { useYearClosingWizard } from '@/features/accounting-periods/hooks/use-year-closing-wizard';
import { useConfirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';

export const AccountingPeriodsSettingsCard = () => {
    const { data: periods, isLoading } = useGetAccountingPeriods();
    const deleteMutation = useDeleteAccountingPeriod();
    const { onOpen } = useYearClosingWizard();
    const [ConfirmDialog, confirm] = useConfirm(
        'Delete Accounting Period?',
        'This will permanently delete this accounting period. This action cannot be undone.',
    );

    const handleDelete = async (id: string) => {
        const ok = await confirm();
        if (ok) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <>
            <ConfirmDialog />
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Accounting Periods</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage your fiscal year closing periods
                            </p>
                        </div>
                        <Button onClick={onOpen} size="sm">
                            <CalendarClock className="size-4 mr-2" />
                            Close Year
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex h-32 w-full items-center justify-center">
                            <Loader2 className="size-6 animate-spin text-slate-300" />
                        </div>
                    ) : !periods || periods.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            No accounting periods yet. Click "Close Year" to
                            create your first closing period.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>Period</Table.Head>
                                        <Table.Head>Status</Table.Head>
                                        <Table.Head>Closed</Table.Head>
                                        <Table.Head className="w-[50px]"></Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {periods.map((period) => (
                                        <Table.Row key={period.id}>
                                            <Table.Cell>
                                                <div className="font-medium">
                                                    {format(
                                                        new Date(
                                                            period.startDate,
                                                        ),
                                                        'MMM d, yyyy',
                                                    )}{' '}
                                                    -{' '}
                                                    {format(
                                                        new Date(
                                                            period.endDate,
                                                        ),
                                                        'MMM d, yyyy',
                                                    )}
                                                </div>
                                                {period.notes && (
                                                    <div className="text-sm text-muted-foreground">
                                                        {period.notes}
                                                    </div>
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                                        period.status ===
                                                            'closed'
                                                            ? 'bg-slate-100 text-slate-800'
                                                            : 'bg-amber-100 text-amber-800',
                                                    )}
                                                >
                                                    {period.status === 'closed'
                                                        ? 'Closed'
                                                        : 'Open'}
                                                </span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {period.closedAt
                                                    ? format(
                                                          new Date(
                                                              period.closedAt,
                                                          ),
                                                          'MMM d, yyyy',
                                                      )
                                                    : '-'}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="plain"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {period.status ===
                                                            'open' && (
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        period.id,
                                                                    )
                                                                }
                                                            >
                                                                <Trash className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        )}
                                                        {period.status ===
                                                            'closed' && (
                                                            <DropdownMenuItem
                                                                disabled
                                                            >
                                                                Closed periods
                                                                cannot be
                                                                deleted
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
};
