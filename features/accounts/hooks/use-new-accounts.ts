'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const useNewAccount = () => {
    const [newAccountParam, setNewAccountParam] = useQueryState(
        'newAccount',
        parseAsString,
    );

    return {
        isOpen: newAccountParam === '1',
        onOpen: () => setNewAccountParam('1'),
        onClose: () => setNewAccountParam(null),
    };
};
