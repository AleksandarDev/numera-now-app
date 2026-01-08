'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const useOpenCustomer = () => {
    const [customerSheetId, setCustomerSheetId] = useQueryState(
        'customerSheetId',
        parseAsString,
    );

    return {
        id: customerSheetId ?? undefined,
        isOpen: Boolean(customerSheetId),
        onOpen: (id: string) => setCustomerSheetId(id),
        onClose: () => setCustomerSheetId(null),
    };
};
