'use client';

import { useMountedState } from 'react-use';
import { EditAccountSheet } from '@/features/accounts/components/edit-account-sheet';
import { NewAccountSheet } from '@/features/accounts/components/new-account-sheet';
import { EditCustomerSheet } from '@/features/customers/components/edit-customer-sheet';
import { NewCustomerSheet } from '@/features/customers/components/new-customer-sheet';
import { EditTagSheet } from '@/features/tags/components/edit-tag-sheet';
import { NewTagSheet } from '@/features/tags/components/new-tag-sheet';
import { EditTransactionSheet } from '@/features/transactions/components/edit-transaction-sheet';
import { NewTransactionSheet } from '@/features/transactions/components/new-transaction-sheet';

export const SheetProvider = () => {
    const isMounted = useMountedState();

    if (!isMounted) return null;

    return (
        <>
            <NewAccountSheet />
            <EditAccountSheet />

            <NewTagSheet />
            <EditTagSheet />

            <NewTransactionSheet />
            <EditTransactionSheet />

            <NewCustomerSheet />
            <EditCustomerSheet />
        </>
    );
};
