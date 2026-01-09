import { type ClassValue, clsx } from 'clsx';
import { eachDayOfInterval, format, isSameDay, subDays } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function convertAmountFromMiliunits(amount: number) {
    return amount / 1000;
}

export function convertAmountToMiliunits(amount: number) {
    return Math.round(amount * 1000);
}

export function formatCurrency(value: number) {
    return Intl.NumberFormat('en-us', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(value);
}

export function calculatePercentageChange(current: number, previous: number) {
    if (previous === 0) {
        return previous === current ? 0 : 100;
    }

    return ((current - previous) / previous) * 100;
}

export function fillMissingDays(
    activeDays: {
        date: Date;
        income: number;
        expenses: number;
    }[],
    startDate: Date,
    endDate: Date,
) {
    if (activeDays.length === 0) return [];

    const allDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const transactionsByDay = allDays.map((day) => {
        const found = activeDays.find((d) => isSameDay(d.date, day));

        if (found) return found;
        else {
            return {
                date: day,
                income: 0,
                expenses: 0,
            };
        }
    });

    return transactionsByDay;
}

type Period = {
    from: string | Date | undefined;
    to: string | Date | undefined;
};

export function formatDateRange(period?: Period) {
    const defaultTo = new Date();
    const defaultFrom = subDays(defaultTo, 30);

    if (!period?.from) {
        return `${format(defaultFrom, 'LLL dd')} - ${format(
            defaultTo,
            'LLL dd, y',
        )}`;
    }

    if (period?.to) {
        return `${format(period.from, 'LLL dd')} - ${format(
            period.to,
            'LLL dd, y',
        )}`;
    }

    return format(period.from, 'LLL dd, y');
}

export function formatPercentage(
    value: number,
    options: { addPrefix?: boolean } = { addPrefix: false },
) {
    const result = new Intl.NumberFormat('en-US', {
        style: 'percent',
    }).format(value / 100);

    if (options.addPrefix && value > 0) return `+${result}`;

    return result;
}

/**
 * Calculate contrasting text color (black or white) based on background color
 * Uses relative luminance calculation from WCAG guidelines
 */
export function getContrastingTextColor(hexColor: string): string {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Calculate relative luminance
    const luminance = (c: number) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

    const L =
        0.2126 * luminance(r) + 0.7152 * luminance(g) + 0.0722 * luminance(b);

    // Return black for light backgrounds, white for dark backgrounds
    return L > 0.5 ? '#000000' : '#FFFFFF';
}
