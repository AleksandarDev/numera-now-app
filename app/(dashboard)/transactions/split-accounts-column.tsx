import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

type SplitAccount = {
    id: string;
    name: string;
    code?: string | null;
};

type SplitAccountsColumnProps = {
    creditAccounts: SplitAccount[];
    debitAccounts: SplitAccount[];
    singleAccounts: SplitAccount[];
    amount?: number | null;
};

export const SplitAccountsColumn = ({
    creditAccounts,
    debitAccounts,
    singleAccounts,
    amount,
}: SplitAccountsColumnProps) => {
    const hasAccounts =
        creditAccounts.length > 0 ||
        debitAccounts.length > 0 ||
        singleAccounts.length > 0;

    if (!hasAccounts) {
        return (
            <span className="text-muted-foreground text-sm">
                Split accounts
            </span>
        );
    }

    const creditLabels = creditAccounts.map(
        (account) => account.code ?? account.name,
    );
    const debitLabels = debitAccounts.map(
        (account) => account.code ?? account.name,
    );
    const singleLabels = singleAccounts.map(
        (account) => account.code ?? account.name,
    );

    const rightLabels = debitLabels.length > 0 ? debitLabels : singleLabels;

    return (
        <div className="flex items-center gap-2 whitespace-nowrap">
            {creditLabels.length > 0 ? (
                <span
                    className="text-xs font-mono text-foreground/60 truncate"
                    title={creditLabels.join(', ')}
                >
                    {creditLabels.join(', ')}
                </span>
            ) : (
                <span className="text-xs text-muted-foreground">—</span>
            )}
            <ChevronRight className="size-4 min-w-4 text-muted-foreground" />
            {typeof amount === 'number' ? (
                <Badge
                    variant={amount < 0 ? 'destructive' : 'primary'}
                    className="px-3 py-2 text-sm"
                >
                    {formatCurrency(amount)}
                </Badge>
            ) : (
                <span className="text-xs text-muted-foreground">—</span>
            )}
            <ChevronRight className="size-4 min-w-4 text-muted-foreground" />
            {rightLabels.length > 0 ? (
                <span
                    className="text-xs font-mono text-foreground/60 truncate"
                    title={rightLabels.join(', ')}
                >
                    {rightLabels.join(', ')}
                </span>
            ) : (
                <span className="text-xs text-muted-foreground">—</span>
            )}
        </div>
    );
};
