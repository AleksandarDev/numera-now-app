'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const useOpenAccount = () => {
    const [accountSheetId, setAccountSheetId] = useQueryState(
        'accountSheetId',
        parseAsString,
    );

    return {
        id: accountSheetId ?? undefined,
        isOpen: Boolean(accountSheetId),
        onOpen: (id: string) => setAccountSheetId(id),
        onClose: () => setAccountSheetId(null),
    };
};
