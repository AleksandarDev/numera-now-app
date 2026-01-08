'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const useOpenCategory = () => {
    const [categorySheetId, setCategorySheetId] = useQueryState(
        'categorySheetId',
        parseAsString,
    );

    return {
        id: categorySheetId ?? undefined,
        isOpen: Boolean(categorySheetId),
        onOpen: (id: string) => setCategorySheetId(id),
        onClose: () => setCategorySheetId(null),
    };
};
