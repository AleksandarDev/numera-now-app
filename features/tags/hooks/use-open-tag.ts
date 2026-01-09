'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const useOpenTag = () => {
    const [tagSheetId, setTagSheetId] = useQueryState(
        'tagSheetId',
        parseAsString,
    );

    return {
        id: tagSheetId ?? undefined,
        isOpen: Boolean(tagSheetId),
        onOpen: (id: string) => setTagSheetId(id),
        onClose: () => setTagSheetId(null),
    };
};
