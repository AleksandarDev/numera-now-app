'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { CustomerSelect } from './customer-select';

export const CustomerFilter = () => {
    const [customerId, setCustomerId] = useQueryState(
        'customerId',
        parseAsString.withDefault('all'),
    );

    const onChange = (newValue?: string) => {
        void setCustomerId(!newValue || newValue === 'all' ? null : newValue);
    };

    return (
        <CustomerSelect
            value={customerId}
            onChange={onChange}
            selectAll
            className="min-w-72 px-3 md:w-auto text-left hover:bg-muted"
        />
    );
};
