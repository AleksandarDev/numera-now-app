'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const useNewCategory = () => {
    const [newCategoryParam, setNewCategoryParam] = useQueryState(
        'newCategory',
        parseAsString,
    );

    return {
        isOpen: newCategoryParam === '1',
        onOpen: () => setNewCategoryParam('1'),
        onClose: () => setNewCategoryParam(null),
    };
};
