'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { AccountSelect } from './account-select';

export const AccountFilter = () => {
    const [accountId, setAccountId] = useQueryState(
        'accountId',
        parseAsString.withDefault('all'),
    );

    const onChange = (newValue: string) => {
        void setAccountId(newValue === 'all' ? null : newValue);
    };

    return (
        <AccountSelect
            value={accountId}
            onChange={onChange}
            selectAll
            className="min-w-72 h-9 px-3 md:w-auto text-left hover:bg-muted"
        />
    );
};
