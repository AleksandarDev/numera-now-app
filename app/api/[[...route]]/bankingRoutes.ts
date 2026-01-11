import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import {
    accounts,
    bankAccounts,
    bankConnections,
    gocardlessSettings,
    tags,
    transactionStatusHistory,
    transactions,
    transactionTags,
} from '@/db/schema';
import {
    ENABLE_BANKING_API_BASE,
    getEnableBankingHeaders,
} from '@/lib/banking/enablebanking';
import { bankingProviderConfig } from '@/lib/banking/provider-config';
import { encrypt, safeDecrypt } from '@/lib/crypto';

const SUPPORTED_COUNTRIES = bankingProviderConfig.supportedCountries.map(
    (country) => country.code,
);

interface EnableBankingAspsp {
    name: string;
    country: string;
    logo?: string;
    bic?: string;
    maximum_consent_validity?: number;
}

interface EnableBankingAspspsResponse {
    aspsps: EnableBankingAspsp[];
}

interface EnableBankingStartAuthorizationResponse {
    url: string;
    authorization_id: string;
    psu_id_hash: string;
}

interface EnableBankingSessionAccountId {
    iban?: string;
}

interface EnableBankingSessionAccount {
    uid?: string;
    currency?: string;
    name?: string;
    details?: string;
    account_id?: EnableBankingSessionAccountId;
}

interface EnableBankingSessionResponse {
    session_id: string;
    accounts: EnableBankingSessionAccount[];
    aspsp: {
        name: string;
        country: string;
    };
    access?: {
        valid_until?: string;
    };
}

interface EnableBankingParty {
    name?: string;
}

interface EnableBankingTransaction {
    entry_reference?: string;
    transaction_id?: string;
    transaction_amount: {
        amount: string;
        currency: string;
    };
    credit_debit_indicator: 'CRDT' | 'DBIT';
    status?: 'BOOK' | 'PDNG' | 'OTHR' | 'CNCL' | 'RJCT' | 'SCHD' | 'HOLD';
    booking_date?: string;
    value_date?: string;
    transaction_date?: string;
    debtor?: EnableBankingParty;
    creditor?: EnableBankingParty;
    remittance_information?: string[];
    reference_number?: string;
}

interface EnableBankingTransactionsResponse {
    transactions: EnableBankingTransaction[];
    continuation_key?: string | null;
}

const getEnableBankingCredentials = (
    settings: typeof gocardlessSettings.$inferSelect | null | undefined,
): { applicationId: string; privateKey: string } | null => {
    if (!settings?.secretId || !settings.secretKey) {
        return null;
    }

    const decryptedId = safeDecrypt(settings.secretId) ?? settings.secretId;
    const decryptedKey = safeDecrypt(settings.secretKey) ?? settings.secretKey;

    if (!decryptedId || !decryptedKey) {
        return null;
    }

    return {
        applicationId: decryptedId,
        privateKey: decryptedKey,
    };
};

const getEnableBankingAuthHeaders = (
    settings: typeof gocardlessSettings.$inferSelect | null | undefined,
): HeadersInit | null => {
    const credentials = getEnableBankingCredentials(settings);
    if (!credentials) {
        return null;
    }

    return getEnableBankingHeaders(credentials);
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

// Process a bank transaction and create a local transaction if it doesn't exist
const processEnableBankingTransaction = async (
    transaction: EnableBankingTransaction,
    bankAccount: typeof bankAccounts.$inferSelect & {
        institutionName?: string;
    },
    settings: typeof gocardlessSettings.$inferSelect,
): Promise<{ id: string; created: boolean }> => {
    const userId = settings.userId;
    const transactionIdFromProvider =
        transaction.entry_reference || transaction.transaction_id;

    if (!transactionIdFromProvider || !bankAccount.gocardlessAccountId) {
        return { id: '', created: false };
    }

    const providerTransactionId = `${bankAccount.gocardlessAccountId}:${transactionIdFromProvider}`;

    // Check if transaction already exists
    const [existingTransaction] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.gocardlessTransactionId, providerTransactionId));

    if (existingTransaction) {
        return { id: existingTransaction.id, created: false };
    }

    // Parse amount - Enable Banking provides amounts as strings
    // Convert to milliunits (app stores amounts * 1000)
    const amountFloat = Number.parseFloat(
        transaction.transaction_amount.amount,
    );
    const amount = Math.round(Math.abs(amountFloat) * 1000);
    const isCredit = transaction.credit_debit_indicator === 'CRDT';

    // Determine payee name
    const payee = isCredit
        ? transaction.debtor?.name || 'Bank Transfer In'
        : transaction.creditor?.name || 'Bank Transfer Out';

    // Build notes from remittance information
    const remittanceInfoParts = [...(transaction.remittance_information || [])];
    if (transaction.reference_number) {
        remittanceInfoParts.push(`Reference: ${transaction.reference_number}`);
    }
    const remittanceInfo = remittanceInfoParts.join(' ').trim();
    const notes = remittanceInfo
        ? `${remittanceInfo}\n\nBank: ${bankAccount.name || bankAccount.iban}`
        : `Bank: ${bankAccount.name || bankAccount.iban}`;

    // Parse date
    const transactionDate = transaction.booking_date
        ? new Date(transaction.booking_date)
        : transaction.value_date
          ? new Date(transaction.value_date)
          : transaction.transaction_date
            ? new Date(transaction.transaction_date)
            : new Date();

    // Create transaction
    const transactionId = createId();
    const now = new Date();

    // Determine credit/debit accounts based on transaction direction
    let creditAccountId = settings.defaultCreditAccountId;
    let debitAccountId = settings.defaultDebitAccountId;

    // If bank account is linked to a local account, use that
    if (bankAccount.linkedAccountId) {
        if (isCredit) {
            // Money coming in - credit the linked bank account
            creditAccountId = bankAccount.linkedAccountId;
        } else {
            // Money going out - debit the linked bank account
            debitAccountId = bankAccount.linkedAccountId;
        }
    }

    await db.insert(transactions).values({
        id: transactionId,
        amount: amount, // Store as positive, direction determined by accounts
        payee: payee,
        notes: notes,
        date: transactionDate,
        creditAccountId: creditAccountId,
        debitAccountId: debitAccountId,
        status: 'pending',
        statusChangedAt: now,
        statusChangedBy: userId,
        gocardlessTransactionId: providerTransactionId,
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
        `Transaction imported from bank (${bankAccount.institutionName || 'Bank'})`,
    );

    return { id: transactionId, created: true };
};

const app = new Hono()
    // Get bank integration settings for the current user
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [data] = await db
            .select({
                userId: gocardlessSettings.userId,
                hasSecretId: gocardlessSettings.secretId,
                hasSecretKey: gocardlessSettings.secretKey,
                defaultCreditAccountId:
                    gocardlessSettings.defaultCreditAccountId,
                defaultDebitAccountId: gocardlessSettings.defaultDebitAccountId,
                defaultTagId: gocardlessSettings.defaultTagId,
                isEnabled: gocardlessSettings.isEnabled,
                syncFromDate: gocardlessSettings.syncFromDate,
                lastSyncAt: gocardlessSettings.lastSyncAt,
                createdAt: gocardlessSettings.createdAt,
                updatedAt: gocardlessSettings.updatedAt,
            })
            .from(gocardlessSettings)
            .where(eq(gocardlessSettings.userId, auth.userId));

        if (!data) {
            return ctx.json({
                data: {
                    userId: auth.userId,
                    hasSecretId: false,
                    hasSecretKey: false,
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

        return ctx.json({
            data: {
                ...data,
                hasSecretId: !!data.hasSecretId,
                hasSecretKey: !!data.hasSecretKey,
            },
        });
    })

    // Update bank integration settings
    .patch(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                secretId: z.string().optional(),
                secretKey: z.string().optional(),
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

            // Validate API credentials if provided
            if (values.secretId && values.secretKey) {
                try {
                    const response = await fetch(
                        `${ENABLE_BANKING_API_BASE}/application`,
                        {
                            headers: getEnableBankingHeaders({
                                applicationId: values.secretId,
                                privateKey: values.secretKey,
                            }),
                        },
                    );

                    if (!response.ok) {
                        const errorText = await response.text();
                        return ctx.json(
                            {
                                error: `Invalid Enable Banking credentials: ${errorText}`,
                            },
                            400,
                        );
                    }
                } catch {
                    return ctx.json(
                        {
                            error: 'Failed to validate Enable Banking credentials.',
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
                .from(gocardlessSettings)
                .where(eq(gocardlessSettings.userId, auth.userId));

            const updateValues: Partial<
                typeof gocardlessSettings.$inferInsert
            > = {
                updatedAt: new Date(),
            };

            if (values.secretId !== undefined) {
                updateValues.secretId = values.secretId
                    ? encrypt(values.secretId)
                    : null;
            }
            if (values.secretKey !== undefined) {
                updateValues.secretKey = values.secretKey
                    ? encrypt(values.secretKey)
                    : null;
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
                    .update(gocardlessSettings)
                    .set(updateValues)
                    .where(eq(gocardlessSettings.userId, auth.userId))
                    .returning();
            } else {
                [data] = await db
                    .insert(gocardlessSettings)
                    .values({
                        userId: auth.userId,
                        secretId: values.secretId
                            ? encrypt(values.secretId)
                            : null,
                        secretKey: values.secretKey
                            ? encrypt(values.secretKey)
                            : null,
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
                    secretId: undefined,
                    secretKey: undefined,
                    accessToken: undefined,
                    refreshToken: undefined,
                    hasSecretId: !!data.secretId,
                    hasSecretKey: !!data.secretKey,
                },
            });
        },
    )

    // Disconnect bank integration (remove credentials)
    .delete('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        // Delete all bank connections and accounts for this user
        const connections = await db
            .select({ id: bankConnections.id })
            .from(bankConnections)
            .where(eq(bankConnections.userId, auth.userId));

        if (connections.length > 0) {
            const connectionIds = connections.map((c) => c.id);
            await db
                .delete(bankAccounts)
                .where(inArray(bankAccounts.connectionId, connectionIds));
            await db
                .delete(bankConnections)
                .where(eq(bankConnections.userId, auth.userId));
        }

        await db
            .update(gocardlessSettings)
            .set({
                secretId: null,
                secretKey: null,
                accessToken: null,
                accessTokenExpiresAt: null,
                refreshToken: null,
                refreshTokenExpiresAt: null,
                isEnabled: false,
                updatedAt: new Date(),
            })
            .where(eq(gocardlessSettings.userId, auth.userId));

        return ctx.json({ success: true });
    })

    // Test Enable Banking connection
    .post('/test', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [settings] = await db
            .select()
            .from(gocardlessSettings)
            .where(eq(gocardlessSettings.userId, auth.userId));

        const authHeaders = getEnableBankingAuthHeaders(settings);
        if (!authHeaders) {
            return ctx.json(
                { error: 'Enable Banking is not configured.' },
                400,
            );
        }

        // Test by fetching institutions for Croatia
        try {
            const response = await fetch(
                `${ENABLE_BANKING_API_BASE}/aspsps?country=HR&service=AIS`,
                {
                    headers: authHeaders,
                },
            );

            if (!response.ok) {
                throw new Error('Failed to fetch institutions');
            }

            const institutions =
                (await response.json()) as EnableBankingAspspsResponse;

            return ctx.json({
                data: {
                    connected: true,
                    institutionsCount: institutions.aspsps.length,
                    message: `Successfully connected. Found ${institutions.aspsps.length} Croatian banks.`,
                },
            });
        } catch (error) {
            return ctx.json(
                {
                    error: 'Failed to connect to Enable Banking.',
                    details:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                },
                400,
            );
        }
    })

    // Get available banks/institutions for a country
    .get(
        '/institutions',
        clerkMiddleware(),
        zValidator(
            'query',
            z.object({
                country: z.string().length(2).default('HR'),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { country } = ctx.req.valid('query');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Validate country is supported
            if (!SUPPORTED_COUNTRIES.includes(country.toUpperCase())) {
                return ctx.json(
                    {
                        error: `Country ${country} is not supported. Supported countries: ${SUPPORTED_COUNTRIES.join(', ')}`,
                    },
                    400,
                );
            }

            const [settings] = await db
                .select()
                .from(gocardlessSettings)
                .where(eq(gocardlessSettings.userId, auth.userId));

            const authHeaders = getEnableBankingAuthHeaders(settings);
            if (!authHeaders) {
                return ctx.json(
                    { error: 'Enable Banking is not configured.' },
                    400,
                );
            }

            try {
                const response = await fetch(
                    `${ENABLE_BANKING_API_BASE}/aspsps?country=${country.toUpperCase()}&service=AIS`,
                    {
                        headers: authHeaders,
                    },
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch institutions');
                }

                const institutions =
                    (await response.json()) as EnableBankingAspspsResponse;

                return ctx.json({
                    data: institutions.aspsps.map((inst) => ({
                        id: inst.name,
                        name: inst.name,
                        bic: inst.bic || '',
                        logo: inst.logo || '',
                        transactionTotalDays: inst.maximum_consent_validity
                            ? Math.round(
                                  inst.maximum_consent_validity / 86400,
                              ).toString()
                            : '0',
                        maxAccessValidForDays: inst.maximum_consent_validity
                            ? Math.round(
                                  inst.maximum_consent_validity / 86400,
                              ).toString()
                            : undefined,
                        country: inst.country,
                        countries: [inst.country],
                    })),
                });
            } catch (error) {
                return ctx.json(
                    {
                        error: 'Failed to fetch institutions.',
                        details:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                    },
                    400,
                );
            }
        },
    )

    // Create a bank connection (requisition) - returns link for user to authorize
    .post(
        '/connections',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                institutionId: z.string(),
                institutionName: z.string(),
                institutionLogo: z.string().optional(),
                institutionCountry: z.string().length(2),
                redirectUrl: z.string().url(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [settings] = await db
                .select()
                .from(gocardlessSettings)
                .where(eq(gocardlessSettings.userId, auth.userId));

            const authHeaders = getEnableBankingAuthHeaders(settings);
            if (!authHeaders) {
                return ctx.json(
                    { error: 'Enable Banking is not configured.' },
                    400,
                );
            }

            try {
                const institutionCountry =
                    values.institutionCountry.toUpperCase();
                const connectionId = createId();
                const validUntil = new Date(
                    Date.now() + 90 * 24 * 60 * 60 * 1000,
                );

                const authorizationResponse = await fetch(
                    `${ENABLE_BANKING_API_BASE}/auth`,
                    {
                        method: 'POST',
                        headers: {
                            ...authHeaders,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            aspsp: {
                                name: values.institutionName,
                                country: institutionCountry,
                            },
                            redirect_url: values.redirectUrl,
                            state: connectionId,
                            access: {
                                balances: true,
                                transactions: true,
                                valid_until: validUntil.toISOString(),
                            },
                            language: institutionCountry.toLowerCase(),
                        }),
                    },
                );

                if (!authorizationResponse.ok) {
                    const errorText = await authorizationResponse.text();
                    throw new Error(
                        `Failed to start authorization: ${errorText}`,
                    );
                }

                const authorization =
                    (await authorizationResponse.json()) as EnableBankingStartAuthorizationResponse;

                await db.insert(bankConnections).values({
                    id: connectionId,
                    userId: auth.userId,
                    requisitionId: authorization.authorization_id,
                    institutionId: values.institutionId,
                    institutionName: values.institutionName,
                    institutionLogo: values.institutionLogo || null,
                    agreementId: null,
                    agreementExpiresAt: validUntil,
                    status: 'pending',
                });

                return ctx.json({
                    data: {
                        connectionId,
                        requisitionId: authorization.authorization_id,
                        authorizationLink: authorization.url,
                    },
                });
            } catch (error) {
                console.error(
                    '[Enable Banking] Failed to create connection:',
                    error,
                );
                return ctx.json(
                    {
                        error: 'Failed to create bank connection.',
                        details:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                    },
                    400,
                );
            }
        },
    )

    // Get all bank connections for the user
    .get('/connections', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const connections = await db
            .select()
            .from(bankConnections)
            .where(eq(bankConnections.userId, auth.userId));

        // Get accounts for each connection
        const connectionsWithAccounts = await Promise.all(
            connections.map(async (connection) => {
                const connAccounts = await db
                    .select()
                    .from(bankAccounts)
                    .where(eq(bankAccounts.connectionId, connection.id));

                return {
                    ...connection,
                    accounts: connAccounts,
                };
            }),
        );

        return ctx.json({ data: connectionsWithAccounts });
    })

    // Complete bank connection after user authorization (callback endpoint)
    .post(
        '/connections/:connectionId/complete',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                code: z.string().min(1),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const connectionId = ctx.req.param('connectionId');
            const { code } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [connection] = await db
                .select()
                .from(bankConnections)
                .where(
                    and(
                        eq(bankConnections.id, connectionId),
                        eq(bankConnections.userId, auth.userId),
                    ),
                );

            if (!connection) {
                return ctx.json({ error: 'Connection not found.' }, 404);
            }

            const [settings] = await db
                .select()
                .from(gocardlessSettings)
                .where(eq(gocardlessSettings.userId, auth.userId));

            const authHeaders = settings
                ? getEnableBankingAuthHeaders(settings)
                : null;
            if (!authHeaders) {
                return ctx.json(
                    { error: 'Enable Banking is not configured.' },
                    400,
                );
            }

            try {
                const sessionResponse = await fetch(
                    `${ENABLE_BANKING_API_BASE}/sessions`,
                    {
                        method: 'POST',
                        headers: {
                            ...authHeaders,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ code }),
                    },
                );

                if (!sessionResponse.ok) {
                    const errorText = await sessionResponse.text();
                    throw new Error(
                        `Failed to authorize session: ${errorText}`,
                    );
                }

                const session =
                    (await sessionResponse.json()) as EnableBankingSessionResponse;

                const accountsCreated: string[] = [];

                for (const account of session.accounts) {
                    if (!account.uid) {
                        continue;
                    }

                    // Check if account already exists
                    const [existingAccount] = await db
                        .select()
                        .from(bankAccounts)
                        .where(
                            eq(bankAccounts.gocardlessAccountId, account.uid),
                        );

                    if (existingAccount) {
                        continue;
                    }

                    // Create bank account record
                    const bankAccountId = createId();
                    const iban = account.account_id?.iban || null;
                    const accountName =
                        account.name ||
                        (iban ? `Account ending ${iban.slice(-4)}` : null);
                    await db.insert(bankAccounts).values({
                        id: bankAccountId,
                        connectionId: connectionId,
                        userId: auth.userId,
                        gocardlessAccountId: account.uid,
                        iban: iban,
                        name: accountName || 'Bank Account',
                        ownerName: account.name || null,
                        currency: account.currency || 'EUR',
                        isActive: true,
                    });

                    accountsCreated.push(bankAccountId);
                }

                // Update connection status
                await db
                    .update(bankConnections)
                    .set({
                        status: 'linked',
                        agreementId: session.session_id,
                        agreementExpiresAt: session.access?.valid_until
                            ? new Date(session.access.valid_until)
                            : connection.agreementExpiresAt,
                        institutionName:
                            session.aspsp?.name || connection.institutionName,
                        institutionId:
                            session.aspsp?.name || connection.institutionId,
                        updatedAt: new Date(),
                    })
                    .where(eq(bankConnections.id, connectionId));

                return ctx.json({
                    data: {
                        status: 'linked',
                        accountsCreated: accountsCreated.length,
                        message: `Successfully linked ${accountsCreated.length} bank account(s).`,
                    },
                });
            } catch (error) {
                console.error(
                    '[Enable Banking] Failed to complete connection:',
                    error,
                );

                await db
                    .update(bankConnections)
                    .set({
                        status: 'error',
                        lastError:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                        updatedAt: new Date(),
                    })
                    .where(eq(bankConnections.id, connectionId));

                return ctx.json(
                    {
                        error: 'Failed to complete bank connection.',
                        details:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                    },
                    400,
                );
            }
        },
    )

    // Delete a bank connection
    .delete('/connections/:connectionId', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);
        const connectionId = ctx.req.param('connectionId');

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [connection] = await db
            .select()
            .from(bankConnections)
            .where(
                and(
                    eq(bankConnections.id, connectionId),
                    eq(bankConnections.userId, auth.userId),
                ),
            );

        if (!connection) {
            return ctx.json({ error: 'Connection not found.' }, 404);
        }

        // Delete bank accounts first (cascade should handle this, but being explicit)
        await db
            .delete(bankAccounts)
            .where(eq(bankAccounts.connectionId, connectionId));

        // Delete connection
        await db
            .delete(bankConnections)
            .where(eq(bankConnections.id, connectionId));

        return ctx.json({ success: true });
    })

    // Link a bank account to a local account
    .patch(
        '/accounts/:accountId',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                linkedAccountId: z.string().nullable().optional(),
                isActive: z.boolean().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const accountId = ctx.req.param('accountId');
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [bankAccount] = await db
                .select()
                .from(bankAccounts)
                .where(
                    and(
                        eq(bankAccounts.id, accountId),
                        eq(bankAccounts.userId, auth.userId),
                    ),
                );

            if (!bankAccount) {
                return ctx.json({ error: 'Bank account not found.' }, 404);
            }

            // Validate linked account if provided
            if (values.linkedAccountId) {
                const [localAccount] = await db
                    .select()
                    .from(accounts)
                    .where(eq(accounts.id, values.linkedAccountId));
                if (!localAccount || localAccount.userId !== auth.userId) {
                    return ctx.json(
                        { error: 'Invalid linked account ID.' },
                        400,
                    );
                }
            }

            const [updated] = await db
                .update(bankAccounts)
                .set({
                    linkedAccountId:
                        values.linkedAccountId !== undefined
                            ? values.linkedAccountId
                            : bankAccount.linkedAccountId,
                    isActive:
                        values.isActive !== undefined
                            ? values.isActive
                            : bankAccount.isActive,
                    updatedAt: new Date(),
                })
                .where(eq(bankAccounts.id, accountId))
                .returning();

            return ctx.json({ data: updated });
        },
    )

    // Sync transactions from all linked bank accounts
    .post('/sync', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [settings] = await db
            .select()
            .from(gocardlessSettings)
            .where(eq(gocardlessSettings.userId, auth.userId));

        const authHeaders = settings
            ? getEnableBankingAuthHeaders(settings)
            : null;
        if (!authHeaders) {
            return ctx.json(
                { error: 'Enable Banking is not configured.' },
                400,
            );
        }

        if (!settings) {
            return ctx.json(
                { error: 'Enable Banking settings not found.' },
                400,
            );
        }

        if (!settings.isEnabled) {
            return ctx.json(
                { error: 'Enable Banking integration is not enabled.' },
                400,
            );
        }

        // Get all active bank accounts for the user
        const activeBankAccounts = await db
            .select({
                bankAccount: bankAccounts,
                connection: bankConnections,
            })
            .from(bankAccounts)
            .innerJoin(
                bankConnections,
                eq(bankAccounts.connectionId, bankConnections.id),
            )
            .where(
                and(
                    eq(bankAccounts.userId, auth.userId),
                    eq(bankAccounts.isActive, true),
                    eq(bankConnections.status, 'linked'),
                ),
            );

        if (activeBankAccounts.length === 0) {
            return ctx.json({
                data: {
                    success: true,
                    created: 0,
                    skipped: 0,
                    total: 0,
                    message: 'No active bank accounts to sync.',
                },
            });
        }

        let totalCreated = 0;
        let totalSkipped = 0;
        const errors: string[] = [];
        const shouldUpdateSyncFromDate = !settings.syncFromDate;
        let syncFromDateToPersist: Date | null = null;
        const now = new Date();

        for (const { bankAccount, connection } of activeBankAccounts) {
            try {
                if (
                    connection.agreementExpiresAt &&
                    new Date(connection.agreementExpiresAt) <= now
                ) {
                    await db
                        .update(bankConnections)
                        .set({
                            status: 'expired',
                            lastError:
                                'Authorization expired. Please reconnect.',
                            updatedAt: new Date(),
                        })
                        .where(eq(bankConnections.id, connection.id));

                    errors.push(
                        `Authorization expired for ${connection.institutionName}. Please reconnect.`,
                    );
                    continue;
                }

                // Calculate date range for fetching transactions
                // Fetch since last sync, or from configured syncFromDate, or default to 30 days
                let dateFrom: Date;
                if (bankAccount.lastSyncAt) {
                    dateFrom = new Date(bankAccount.lastSyncAt);
                } else if (settings.syncFromDate) {
                    dateFrom = new Date(settings.syncFromDate);
                } else {
                    dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                }

                if (shouldUpdateSyncFromDate && !syncFromDateToPersist) {
                    syncFromDateToPersist = dateFrom;
                }

                const dateTo = new Date();

                // Fetch transactions from Enable Banking
                const transactionsUrl = new URL(
                    `${ENABLE_BANKING_API_BASE}/accounts/${bankAccount.gocardlessAccountId}/transactions`,
                );
                transactionsUrl.searchParams.set(
                    'date_from',
                    dateFrom.toISOString().split('T')[0],
                );
                transactionsUrl.searchParams.set(
                    'date_to',
                    dateTo.toISOString().split('T')[0],
                );
                transactionsUrl.searchParams.set('transaction_status', 'BOOK');

                const transactionsResponse = await fetch(
                    transactionsUrl.toString(),
                    {
                        headers: authHeaders,
                    },
                );

                if (!transactionsResponse.ok) {
                    const errorText = await transactionsResponse.text();
                    let parsedError:
                        | {
                              error?: string;
                              message?: string;
                              detail?: string | null;
                          }
                        | undefined;
                    try {
                        parsedError = JSON.parse(errorText);
                    } catch {
                        parsedError = undefined;
                    }

                    const isExpiredSession =
                        transactionsResponse.status === 401 ||
                        parsedError?.error === 'EXPIRED_SESSION';

                    if (isExpiredSession) {
                        await db
                            .update(bankConnections)
                            .set({
                                status: 'expired',
                                lastError:
                                    'Authorization expired. Please reconnect.',
                                updatedAt: new Date(),
                            })
                            .where(eq(bankConnections.id, connection.id));

                        errors.push(
                            `Authorization expired for ${connection.institutionName}. Please reconnect.`,
                        );
                    } else {
                        errors.push(
                            `Failed to fetch transactions for ${bankAccount.name}: ${errorText}`,
                        );
                    }
                    continue;
                }

                const transactionsData =
                    (await transactionsResponse.json()) as EnableBankingTransactionsResponse;

                // Process booked transactions
                const bookedTransactions = (
                    transactionsData.transactions || []
                ).filter((transaction) => transaction.status === 'BOOK');

                // Add connection info to bank account for processing
                const bankAccountWithConnection = {
                    ...bankAccount,
                    institutionName: connection.institutionName,
                };

                for (const transaction of bookedTransactions) {
                    const result = await processEnableBankingTransaction(
                        transaction,
                        bankAccountWithConnection,
                        settings,
                    );
                    if (result.created) {
                        totalCreated++;
                    } else {
                        totalSkipped++;
                    }
                }

                // Update last sync timestamp for this bank account
                await db
                    .update(bankAccounts)
                    .set({
                        lastSyncAt: new Date(),
                        lastTransactionDate:
                            bookedTransactions.length > 0
                                ? new Date(
                                      bookedTransactions[0].booking_date ||
                                          bookedTransactions[0].value_date ||
                                          bookedTransactions[0]
                                              .transaction_date ||
                                          new Date(),
                                  )
                                : bankAccount.lastTransactionDate,
                        updatedAt: new Date(),
                    })
                    .where(eq(bankAccounts.id, bankAccount.id));
            } catch (error) {
                console.error(
                    `[Enable Banking] Error syncing account ${bankAccount.id}:`,
                    error,
                );
                errors.push(
                    `Error syncing ${bankAccount.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
            }
        }

        // Update last sync timestamp in settings
        await db
            .update(gocardlessSettings)
            .set({
                lastSyncAt: new Date(),
                syncFromDate: syncFromDateToPersist ?? settings.syncFromDate,
                updatedAt: new Date(),
            })
            .where(eq(gocardlessSettings.userId, auth.userId));

        return ctx.json({
            data: {
                success: errors.length === 0,
                created: totalCreated,
                skipped: totalSkipped,
                total: totalCreated + totalSkipped,
                errors: errors.length > 0 ? errors : undefined,
                lastSyncAt: new Date().toISOString(),
            },
        });
    });

export default app;
