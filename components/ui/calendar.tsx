'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

// Button variant styles (inline since signalco doesn't export buttonVariants)
const buttonOutlineClasses = 'cursor-default inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground';
const buttonGhostClasses = 'cursor-default inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn('p-3', className)}
            classNames={{
                months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 relative',
                month: 'space-y-4',
                month_caption:
                    'flex justify-center pt-1 relative items-center h-7',
                caption_label: 'text-sm font-medium',
                nav: 'flex items-center gap-1 absolute top-0 right-0 left-0 justify-between z-10 px-1',
                button_previous: cn(
                    buttonOutlineClasses,
                    'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                ),
                button_next: cn(
                    buttonOutlineClasses,
                    'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                ),
                month_grid: 'w-full border-collapse space-y-1',
                weekdays: 'flex',
                weekday:
                    'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
                week: 'flex w-full mt-2',
                day: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                day_button: cn(
                    buttonGhostClasses,
                    'h-9 w-9 p-0 font-normal rounded-md aria-selected:opacity-100 focus-visible:ring-0 focus-visible:ring-offset-0',
                ),
                range_end: 'day-range-end',
                range_start: 'day-range-start',
                selected:
                    'bg-primary text-primary-foreground rounded-md hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground outline-none',
                today: 'bg-accent text-accent-foreground rounded-md',
                outside:
                    'day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
                disabled: 'text-muted-foreground opacity-50',
                range_middle:
                    'aria-selected:bg-accent aria-selected:text-accent-foreground rounded-none',
                hidden: 'invisible',
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation, className, ...props }) =>
                    orientation === 'left' ? (
                        <ChevronLeft
                            className={cn('h-4 w-4', className)}
                            {...props}
                        />
                    ) : (
                        <ChevronRight
                            className={cn('h-4 w-4', className)}
                            {...props}
                        />
                    ),
            }}
            {...props}
        />
    );
}
Calendar.displayName = 'Calendar';

export { Calendar };
