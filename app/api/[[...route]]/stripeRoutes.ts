import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import {
    accounts,
    customers,
    stripeSettings,
    tags,
    transactionStatusHistory,
    transactions,
    transactionTags,
} from '@/db/schema';
import { encrypt, safeDecrypt } from '@/lib/crypto';

// Helper to mask sensitive data
const _maskSecretKey = (key: string | null) => {
    if (!key) return null;
    if (key.length <= 8) return '****';
    return `${key.substring(0, 4)}****${key.substring(key.length - 4)}`;
};

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
        .where(
            and(eq(customers.userId, userId), eq(customers.isOwnFirm, true)),
        );

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
        payeeCustomerId: ownFirmCustomer?.id,
        status: 'pending',
        statusChangedAt: now,
        statusChangedBy: userId,
        stripePaymentId: charge.id,
        stripePaymentUrl: getStripePaymentUrl(charge.id, isLiveMode),
    });

    // Add default tag if configured
    if (settings.defaultTagId) {
        await db.insert(transactionTags).values({
            id: createId(),
            transactionId,
            tagId: settings.defaultTagId,
        });
    }

    await recordStatusChange(
        transactionId,
        null,
        'pending',
        userId,
        'Transaction created from Stripe sync',
    );

    return { id: transactionId, created: true };
};

const app = new Hono()
    // Get Stripe settings for the current user
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [data] = await db
            .select({
                userId: stripeSettings.userId,
                stripeAccountId: stripeSettings.stripeAccountId,
                hasSecretKey: stripeSettings.stripeSecretKey,
                hasWebhookSecret: stripeSettings.webhookSecret,
                defaultCreditAccountId: stripeSettings.defaultCreditAccountId,
                defaultDebitAccountId: stripeSettings.defaultDebitAccountId,
                defaultTagId: stripeSettings.defaultTagId,
                isEnabled: stripeSettings.isEnabled,
                syncFromDate: stripeSettings.syncFromDate,
                lastSyncAt: stripeSettings.lastSyncAt,
                createdAt: stripeSettings.createdAt,
                updatedAt: stripeSettings.updatedAt,
            })
            .from(stripeSettings)
            .where(eq(stripeSettings.userId, auth.userId));

        if (!data) {
            return ctx.json({
                data: {
                    userId: auth.userId,
                    stripeAccountId: null,
                    hasSecretKey: false,
                    hasWebhookSecret: false,
                    defaultCreditAccountId: null,
                    defaultDebitAccountId: null,
                    defaultTagId: null,
                    isEnabled: false,
                    syncFromDate: null,
                    lastSyncAt: null,
                    createdAt: null,
                    updatedAt: null,
                },
            });
        }

        // Transform to hide actual secret key but indicate if it's set
        return ctx.json({
            data: {
                ...data,
                hasSecretKey: !!data.hasSecretKey,
                hasWebhookSecret: !!data.hasWebhookSecret,
            },
        });
    })

    // Update Stripe settings
    .patch(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                stripeSecretKey: z.string().optional(),
                webhookSecret: z.string().optional(),
                defaultCreditAccountId: z.string().nullable().optional(),
                defaultDebitAccountId: z.string().nullable().optional(),
                defaultTagId: z.string().nullable().optional(),
                isEnabled: z.boolean().optional(),
                syncFromDate: z.string().datetime().nullable().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Validate the secret key if provided
            if (values.stripeSecretKey) {
                try {
                    const stripe = new Stripe(values.stripeSecretKey);
                    // Use balance.retrieve() as it works with restricted keys
                    // that have "Read" access to Balance resource
                    // This is more permissive than accounts.retrieve('self')
                    await stripe.balance.retrieve();

                    // Try to get account ID if the key has permission
                    // This is optional - restricted keys may not have this permission
                    try {
                        const account = await stripe.accounts.retrieve('self');
                        (values as Record<string, unknown>).stripeAccountId =
                            account.id;
                    } catch {
                        // Restricted key doesn't have account access - that's OK
                        // We'll leave stripeAccountId as null
                        (values as Record<string, unknown>).stripeAccountId =
                            null;
                    }
                } catch (error) {
                    const stripeError = error as {
                        type?: string;
                        message?: string;
                    };
                    // Provide more specific error messages
                    if (stripeError.type === 'StripeAuthenticationError') {
                        return ctx.json(
                            {
                                error: 'Invalid Stripe API key. Please check your key and try again.',
                            },
                            400,
                        );
                    }
                    if (stripeError.type === 'StripePermissionError') {
                        return ctx.json(
                            {
                                error: 'Stripe key missing required permissions. Please ensure the key has "Read" access to Balance and Charges.',
                            },
                            400,
                        );
                    }
                    return ctx.json(
                        {
                            error: `Failed to validate Stripe key: ${stripeError.message || 'Unknown error'}`,
                        },
                        400,
                    );
                }
            }

            // Validate account IDs if provided
            if (values.defaultCreditAccountId) {
                const [account] = await db
                    .select()
                    .from(accounts)
                    .where(eq(accounts.id, values.defaultCreditAccountId));
                if (!account || account.userId !== auth.userId) {
                    return ctx.json(
                        { error: 'Invalid credit account ID.' },
                        400,
                    );
                }
            }

            if (values.defaultDebitAccountId) {
                const [account] = await db
                    .select()
                    .from(accounts)
                    .where(eq(accounts.id, values.defaultDebitAccountId));
                if (!account || account.userId !== auth.userId) {
                    return ctx.json(
                        { error: 'Invalid debit account ID.' },
                        400,
                    );
                }
            }

            // Validate tag ID if provided
            if (values.defaultTagId) {
                const [tag] = await db
                    .select()
                    .from(tags)
                    .where(eq(tags.id, values.defaultTagId));
                if (!tag || tag.userId !== auth.userId) {
                    return ctx.json({ error: 'Invalid tag ID.' }, 400);
                }
            }

            const [existingSettings] = await db
                .select()
                .from(stripeSettings)
                .where(eq(stripeSettings.userId, auth.userId));

            const updateValues: Partial<typeof stripeSettings.$inferInsert> = {
                updatedAt: new Date(),
            };

            if (values.stripeSecretKey !== undefined) {
                // Encrypt the secret key before storing
                updateValues.stripeSecretKey = encrypt(values.stripeSecretKey);
                updateValues.stripeAccountId = (
                    values as Record<string, unknown>
                ).stripeAccountId as string;
            }
            if (values.webhookSecret !== undefined) {
                // Encrypt the webhook secret before storing
                updateValues.webhookSecret = encrypt(values.webhookSecret);
            }
            if (values.defaultCreditAccountId !== undefined) {
                updateValues.defaultCreditAccountId =
                    values.defaultCreditAccountId;
            }
            if (values.defaultDebitAccountId !== undefined) {
                updateValues.defaultDebitAccountId =
                    values.defaultDebitAccountId;
            }
            if (values.defaultTagId !== undefined) {
                updateValues.defaultTagId = values.defaultTagId;
            }
            if (values.isEnabled !== undefined) {
                updateValues.isEnabled = values.isEnabled;
            }
            if (values.syncFromDate !== undefined) {
                updateValues.syncFromDate = values.syncFromDate
                    ? new Date(values.syncFromDate)
                    : null;
            }

            let data: typeof existingSettings;

            if (existingSettings) {
                [data] = await db
                    .update(stripeSettings)
                    .set(updateValues)
                    .where(eq(stripeSettings.userId, auth.userId))
                    .returning();
            } else {
                [data] = await db
                    .insert(stripeSettings)
                    .values({
                        userId: auth.userId,
                        // Encrypt secrets before storing
                        stripeSecretKey: values.stripeSecretKey
                            ? encrypt(values.stripeSecretKey)
                            : null,
                        webhookSecret: values.webhookSecret
                            ? encrypt(values.webhookSecret)
                            : null,
                        stripeAccountId:
                            ((values as Record<string, unknown>)
                                .stripeAccountId as string) || null,
                        defaultCreditAccountId:
                            values.defaultCreditAccountId || null,
                        defaultDebitAccountId:
                            values.defaultDebitAccountId || null,
                        defaultTagId: values.defaultTagId || null,
                        isEnabled: values.isEnabled ?? false,
                        syncFromDate: values.syncFromDate
                            ? new Date(values.syncFromDate)
                            : null,
                    })
                    .returning();
            }

            return ctx.json({
                data: {
                    ...data,
                    stripeSecretKey: undefined,
                    webhookSecret: undefined,
                    hasSecretKey: !!data.stripeSecretKey,
                    hasWebhookSecret: !!data.webhookSecret,
                },
            });
        },
    )

    // Disconnect Stripe (remove secret key)
    .delete('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        await db
            .update(stripeSettings)
            .set({
                stripeSecretKey: null,
                webhookSecret: null,
                stripeAccountId: null,
                isEnabled: false,
                updatedAt: new Date(),
            })
            .where(eq(stripeSettings.userId, auth.userId));

        return ctx.json({ success: true });
    })

    // Test Stripe connection
    .post('/test', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [settings] = await db
            .select()
            .from(stripeSettings)
            .where(eq(stripeSettings.userId, auth.userId));

        if (!settings?.stripeSecretKey) {
            return ctx.json({ error: 'Stripe is not configured.' }, 400);
        }

        // Decrypt the secret key before using
        const decryptedKey = safeDecrypt(settings.stripeSecretKey);
        if (!decryptedKey) {
            return ctx.json(
                { error: 'Failed to decrypt Stripe credentials.' },
                500,
            );
        }

        try {
            const stripe = new Stripe(decryptedKey);

            // Use balance.retrieve() which works with restricted keys
            const balance = await stripe.balance.retrieve();

            // Try to get account details if permission allows
            let accountId: string | null = settings.stripeAccountId;
            let businessName: string | null = null;
            let email: string | null = null;

            try {
                const account = await stripe.accounts.retrieve('self');
                accountId = account.id;
                businessName =
                    account.business_profile?.name ||
                    account.settings?.dashboard?.display_name ||
                    null;
                email = account.email || null;
            } catch {
                // Restricted key doesn't have account access - that's OK
            }

            return ctx.json({
                data: {
                    connected: true,
                    accountId: accountId,
                    businessName: businessName,
                    email: email,
                    // Include balance info to show the connection works
                    availableBalance: balance.available?.[0]?.amount ?? 0,
                    currency: balance.available?.[0]?.currency ?? 'usd',
                },
            });
        } catch (error) {
            const stripeError = error as { type?: string; message?: string };
            return ctx.json(
                {
                    error: 'Failed to connect to Stripe.',
                    details: stripeError.message || 'Unknown error',
                },
                400,
            );
        }
    })

    // Manual sync - fetch recent payments from Stripe
    .post('/sync', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [settings] = await db
            .select()
            .from(stripeSettings)
            .where(eq(stripeSettings.userId, auth.userId));

        if (!settings?.stripeSecretKey) {
            return ctx.json({ error: 'Stripe is not configured.' }, 400);
        }

        if (!settings.isEnabled) {
            return ctx.json(
                { error: 'Stripe integration is not enabled.' },
                400,
            );
        }

        // Decrypt the secret key before using
        const decryptedKey = safeDecrypt(settings.stripeSecretKey);
        if (!decryptedKey) {
            return ctx.json(
                { error: 'Failed to decrypt Stripe credentials.' },
                500,
            );
        }

        try {
            const stripe = new Stripe(decryptedKey);

            // Determine the start date for syncing:
            // 1. Always use lastSyncAt if available (for subsequent syncs)
            // 2. Use syncFromDate if set (for first sync)
            // 3. Default to 30 days ago if neither is set
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
                // Default to 30 days ago
                syncStartTime =
                    Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
            }

            let created = 0;
            let skipped = 0;

            // Fetch all charges created since the sync start time using pagination
            // Stripe's list method returns an iterable that automatically handles pagination
            for await (const charge of stripe.charges.list({
                created: { gte: syncStartTime },
                limit: 100, // Fetch 100 at a time for efficiency
            })) {
                // Only process successful charges
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
                .where(eq(stripeSettings.userId, auth.userId));

            return ctx.json({
                data: {
                    success: true,
                    created,
                    skipped,
                    total: created + skipped,
                    lastSyncAt: new Date().toISOString(),
                },
            });
        } catch (error) {
            const stripeError = error as { type?: string; message?: string };
            console.error('[Stripe Sync] Error:', stripeError);
            return ctx.json(
                {
                    error: 'Failed to sync with Stripe.',
                    details: stripeError.message || 'Unknown error',
                },
                400,
            );
        }
    });

export default app;
