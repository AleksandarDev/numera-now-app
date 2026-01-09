import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { db } from '@/db/drizzle';
import {
    customers,
    stripeSettings,
    transactionStatusHistory,
    transactions,
} from '@/db/schema';
import { safeDecrypt } from '@/lib/crypto';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

// Helper function to record status change
const recordStatusChange = async (
    transactionId: string,
    fromStatus: string | null,
    toStatus: string,
    changedBy: string,
    notes?: string,
) => {
    await db.insert(transactionStatusHistory).values({
        id: createId(),
        transactionId,
        fromStatus,
        toStatus,
        changedBy,
        notes,
    });
};

// Build the Stripe dashboard URL for a payment
const getStripePaymentUrl = (
    paymentId: string,
    isLiveMode: boolean,
): string => {
    const baseUrl = isLiveMode
        ? 'https://dashboard.stripe.com'
        : 'https://dashboard.stripe.com/test';

    return `${baseUrl}/payments/${paymentId}`;
};

// Process a Stripe charge and create a transaction if it doesn't exist
const processStripeCharge = async (
    charge: Stripe.Charge,
    settings: typeof stripeSettings.$inferSelect,
): Promise<{ id: string; created: boolean }> => {
    const userId = settings.userId;

    // Check if transaction already exists for this payment
    const [existingTransaction] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.stripePaymentId, charge.id));

    if (existingTransaction) {
        return { id: existingTransaction.id, created: false };
    }

    // Look up the own firm customer for this user
    const [ownFirmCustomer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.userId, userId), eq(customers.isOwnFirm, true)));

    // Convert amount from Stripe cents to milliunits (app stores amounts * 1000)
    // Stripe: 100 cents = 1.00 EUR
    // App: 1000 milliunits = 1.00 EUR
    // So we multiply by 10
    const amount = charge.amount * 10;
    const isLiveMode = charge.livemode;

    // Get payee name from charge metadata or description
    const payee =
        charge.billing_details?.name || charge.description || 'Stripe Payment';

    // Create transaction
    const transactionId = createId();
    const now = new Date();

    await db.insert(transactions).values({
        id: transactionId,
        amount: amount,
        payee: payee,
        notes: `Stripe payment: ${charge.description || charge.id}${charge.receipt_url ? `\nReceipt: ${charge.receipt_url}` : ''}`,
        date: new Date(charge.created * 1000),
        creditAccountId: settings.defaultCreditAccountId,
        debitAccountId: settings.defaultDebitAccountId,
        categoryId: settings.defaultCategoryId,
        payeeCustomerId: ownFirmCustomer?.id,
        status: 'pending',
        statusChangedAt: now,
        statusChangedBy: userId,
        stripePaymentId: charge.id,
        stripePaymentUrl: getStripePaymentUrl(charge.id, isLiveMode),
    });

    await recordStatusChange(
        transactionId,
        null,
        'pending',
        userId,
        'Transaction created from Stripe hourly sync',
    );

    return { id: transactionId, created: true };
};

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        console.error('[Stripe Cron] Unauthorized request');
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 },
        );
    }

    console.log('[Stripe Cron] Starting hourly sync...');

    try {
        // Get all enabled Stripe integrations that DON'T have webhook configured
        // (users with webhooks rely on real-time updates)
        const allSettings = await db
            .select()
            .from(stripeSettings)
            .where(eq(stripeSettings.isEnabled, true));

        // Filter to only those without webhook secret (polling mode)
        const pollingSettings = allSettings.filter(
            (s) => s.stripeSecretKey && !s.webhookSecret,
        );

        if (pollingSettings.length === 0) {
            console.log('[Stripe Cron] No integrations in polling mode');
            return NextResponse.json({
                success: true,
                message: 'No integrations in polling mode',
                processed: 0,
            });
        }

        let totalCreated = 0;
        let totalSkipped = 0;
        let usersProcessed = 0;

        for (const settings of pollingSettings) {
            if (!settings.stripeSecretKey) {
                console.error(
                    `[Stripe Cron] No secret key for user ${settings.userId}`,
                );
                continue;
            }

            const decryptedKey = safeDecrypt(settings.stripeSecretKey);
            if (!decryptedKey) {
                console.error(
                    `[Stripe Cron] Failed to decrypt key for user ${settings.userId}`,
                );
                continue;
            }

            try {
                const stripe = new Stripe(decryptedKey);

                // Determine the start date for syncing:
                // 1. Always use lastSyncAt if available
                // 2. Use syncFromDate if set (for first sync)
                // 3. Default to 2 hours ago (with buffer)
                let syncStartTime: number;
                const shouldUpdateSyncFromDate = !settings.syncFromDate;

                if (settings.lastSyncAt) {
                    syncStartTime = Math.floor(
                        new Date(settings.lastSyncAt).getTime() / 1000,
                    );
                } else if (settings.syncFromDate) {
                    syncStartTime = Math.floor(
                        new Date(settings.syncFromDate).getTime() / 1000,
                    );
                } else {
                    syncStartTime = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
                }

                let created = 0;
                let skipped = 0;

                // Fetch all charges created since the sync start time using pagination
                for await (const charge of stripe.charges.list({
                    created: { gte: syncStartTime },
                    limit: 100,
                })) {
                    if (charge.status !== 'succeeded') {
                        skipped++;
                        continue;
                    }

                    const result = await processStripeCharge(charge, settings);
                    if (result.created) {
                        created++;
                    } else {
                        skipped++;
                    }
                }

                // Update last sync timestamp and syncFromDate if it wasn't set
                const updateData: { lastSyncAt: Date; syncFromDate?: Date } = {
                    lastSyncAt: new Date(),
                };

                if (shouldUpdateSyncFromDate) {
                    updateData.syncFromDate = new Date(syncStartTime * 1000);
                }

                await db
                    .update(stripeSettings)
                    .set(updateData)
                    .where(eq(stripeSettings.userId, settings.userId));

                totalCreated += created;
                totalSkipped += skipped;
                usersProcessed++;

                console.log(
                    `[Stripe Cron] User ${settings.userId}: created ${created}, skipped ${skipped}`,
                );
            } catch (error) {
                console.error(
                    `[Stripe Cron] Error processing user ${settings.userId}:`,
                    error,
                );
            }
        }

        console.log(
            `[Stripe Cron] Completed: ${usersProcessed} users, ${totalCreated} created, ${totalSkipped} skipped`,
        );

        return NextResponse.json({
            success: true,
            usersProcessed,
            totalCreated,
            totalSkipped,
        });
    } catch (error) {
        console.error('[Stripe Cron] Error:', error);
        return NextResponse.json(
            {
                error: 'Cron job failed',
                details:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
