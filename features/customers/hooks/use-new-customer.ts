'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const useNewCustomer = () => {
    const [newCustomerParam, setNewCustomerParam] = useQueryState(
        'newCustomer',
        parseAsString,
    );

    return {
        isOpen: newCustomerParam === '1',
        onOpen: () => setNewCustomerParam('1'),
        onClose: () => setNewCustomerParam(null),
    };
};
