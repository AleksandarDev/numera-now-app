'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const useNewTag = () => {
    const [newTagParam, setNewTagParam] = useQueryState(
        'newTag',
        parseAsString,
    );

    return {
        isOpen: newTagParam === '1',
        onOpen: () => setNewTagParam('1'),
        onClose: () => setNewTagParam(null),
    };
};
