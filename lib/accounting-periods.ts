import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db/drizzle';
import { accountingPeriods } from '@/db/schema';

/**
 * Check if a date falls within any closed accounting period for a user
 * @param date The date to check
 * @param userId The user ID to check periods for
 * @returns The closed period if found, null otherwise
 */
export async function getClosedPeriodForDate(
    date: Date,
    userId: string,
): Promise<{ id: string; startDate: Date; endDate: Date } | null> {
    const [closedPeriod] = await db
        .select({
            id: accountingPeriods.id,
            startDate: accountingPeriods.startDate,
            endDate: accountingPeriods.endDate,
        })
        .from(accountingPeriods)
        .where(
            and(
                eq(accountingPeriods.userId, userId),
                eq(accountingPeriods.status, 'closed'),
                lte(accountingPeriods.startDate, date),
                gte(accountingPeriods.endDate, date),
            ),
        )
        .limit(1);

    return closedPeriod || null;
}

/**
 * Check if a date is in a closed period and return an error if it is
 * @param date The date to check
 * @param userId The user ID to check periods for
 * @returns Error message if date is in a closed period, null otherwise
 */
export async function validateDateNotInClosedPeriod(
    date: Date,
    userId: string,
): Promise<string | null> {
    const closedPeriod = await getClosedPeriodForDate(date, userId);

    if (closedPeriod) {
        const startStr = closedPeriod.startDate.toISOString().split('T')[0];
        const endStr = closedPeriod.endDate.toISOString().split('T')[0];
        return `This date falls within a closed accounting period (${startStr} to ${endStr}). Transactions in closed periods cannot be created or modified.`;
    }

    return null;
}
