import { AccountFilter } from './account-filter';
import { DateFilter } from './date-filter';

export const Filters = () => {
    return (
        <div className="flex flex-col items-stretch gap-y-2 md:flex-row md:gap-x-2 md:gap-y-0 dark">
            <AccountFilter />
            <DateFilter />
        </div>
    );
};
