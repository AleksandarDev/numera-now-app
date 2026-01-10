import { type ClassValue, clsx } from 'clsx';
import { eachDayOfInterval, format, isSameDay, startOfYear } from 'date-fns';
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
    const defaultFrom = startOfYear(defaultTo);

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
 * Convert hex color to HSL components
 */
function hexToHsl(hexColor: string): { h: number; s: number; l: number } {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (h >= 300 && h < 360) {
        r = c;
        g = 0;
        b = x;
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate pastel badge colors based on the hue of the input color
 * Returns colors matching the app's badge style (light bg, dark text, medium border)
 */
export function getTagBadgeColors(hexColor: string): {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
} {
    const { h } = hexToHsl(hexColor);

    // Create pastel/light background (high lightness, low saturation)
    const backgroundColor = hslToHex(h, 70, 92);
    // Create dark text color (same hue, low lightness)
    const textColor = hslToHex(h, 60, 30);
    // Create medium border color
    const borderColor = hslToHex(h, 50, 80);

    return { backgroundColor, textColor, borderColor };
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

/**
 * Accumulate transaction data over time periods
 * @param data - Array of daily transaction data
 * @param period - Accumulation period ('none', 'week', or 'month')
 * @returns Accumulated data
 */
export function accumulateData(
    data: { date: string; income: number; expenses: number }[],
    period: 'none' | 'week' | 'month' = 'none',
): { date: string; income: number; expenses: number }[] {
    if (period === 'none' || data.length === 0) {
        return data;
    }

    const accumulated: { date: string; income: number; expenses: number }[] =
        [];
    let currentPeriod: Date | null = null;
    let periodIncome = 0;
    let periodExpenses = 0;
    let periodStartDate = '';

    for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        const entryDate = new Date(entry.date);

        // Determine if we're in a new period
        let isNewPeriod = false;
        if (!currentPeriod) {
            isNewPeriod = true;
        } else if (period === 'week') {
            // New week starts on Monday
            const currentWeek = Math.floor(
                (entryDate.getTime() -
                    new Date(entryDate.getFullYear(), 0, 1).getTime()) /
                    (7 * 24 * 60 * 60 * 1000),
            );
            const lastWeek = Math.floor(
                (currentPeriod.getTime() -
                    new Date(currentPeriod.getFullYear(), 0, 1).getTime()) /
                    (7 * 24 * 60 * 60 * 1000),
            );
            isNewPeriod = currentWeek !== lastWeek;
        } else if (period === 'month') {
            isNewPeriod =
                entryDate.getMonth() !== currentPeriod.getMonth() ||
                entryDate.getFullYear() !== currentPeriod.getFullYear();
        }

        if (isNewPeriod && currentPeriod) {
            // Save previous period
            accumulated.push({
                date: periodStartDate,
                income: periodIncome,
                expenses: periodExpenses,
            });
            periodIncome = 0;
            periodExpenses = 0;
        }

        if (isNewPeriod) {
            currentPeriod = entryDate;
            periodStartDate = entry.date;
        }

        // Accumulate values
        periodIncome += entry.income;
        periodExpenses += entry.expenses;
    }

    // Don't forget the last period
    if (currentPeriod) {
        accumulated.push({
            date: periodStartDate,
            income: periodIncome,
            expenses: periodExpenses,
        });
    }

    return accumulated;
}
