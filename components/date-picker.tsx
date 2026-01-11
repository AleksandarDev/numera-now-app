import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { SelectSingleEventHandler } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DatePickerProps = {
    value?: Date;
    onChange?: SelectSingleEventHandler;
    disabled?: boolean;
    placeholder?: string;
};

export const DatePicker = ({
    value,
    onChange,
    disabled,
    placeholder,
}: DatePickerProps) => {
    const placeholderText = placeholder ?? 'Pick a date';

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    disabled={disabled}
                    variant="outline"
                    className={cn(
                        'w-full justify-start text-left font-normal',
                        !value && 'text-muted-foreground',
                    )}
                >
                    <CalendarIcon className="mr-2 size-4" />
                    {value ? (
                        format(value, 'PPP')
                    ) : (
                        <span>{placeholderText}</span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent>
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={onChange}
                    disabled={disabled}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
};
