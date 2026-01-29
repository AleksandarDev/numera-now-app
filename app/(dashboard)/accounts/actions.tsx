'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { BookOpen, Edit, MoreHorizontal, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteAccount } from '@/features/accounts/api/use-delete-account';
import { useOpenAccount } from '@/features/accounts/hooks/use-open-account';
import { useConfirm } from '@/hooks/use-confirm';

type Props = {
    id: string;
    disabled?: boolean;
};

export const Actions = ({ id, disabled }: Props) => {
    const router = useRouter();
    const [ConfirmationDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to delete this account.',
    );
    const deleteMutation = useDeleteAccount(id);
    const { onOpen } = useOpenAccount();

    const handleDelete = async () => {
        const ok = await confirm();

        if (ok) {
            deleteMutation.mutate();
        }
    };

    const handleViewLedger = () => {
        router.push(`/accounts/${id}`);
    };

    return (
        <>
            <ConfirmationDialog />
            <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={disabled}>
                    <Button
                        variant="plain"
                        className="size-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        disabled={disabled}
                        onClick={handleViewLedger}
                    >
                        <BookOpen className="size-4 mr-2" />
                        View Ledger
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={deleteMutation.isPending}
                        onClick={() => onOpen(id)}
                    >
                        <Edit className="size-4 mr-2" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={deleteMutation.isPending}
                        onClick={handleDelete}
                    >
                        <Trash className="size-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
};

// TODO: FUCK SHIT UP
