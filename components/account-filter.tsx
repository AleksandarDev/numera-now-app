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
            className="min-w-72 h-9 rounded-md border-none bg-white/10 px-3 font-normal text-white outline-none transition hover:bg-white/30 hover:text-white focus:bg-white/30 focus:ring-transparent focus:ring-offset-0 md:w-auto text-left"
        />
    );
};
