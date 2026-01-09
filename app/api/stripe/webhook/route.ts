import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { db } from '@/db/drizzle';
import {
    stripeSettings,
    transactionStatusHistory,
    transactions,
} from '@/db/schema';
import { safeDecrypt } from '@/lib/crypto';

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

    // Determine if it's a payment intent or charge
    if (paymentId.startsWith('pi_')) {
        return `${baseUrl}/payments/${paymentId}`;
    }
    if (paymentId.startsWith('ch_')) {
        return `${baseUrl}/payments/${paymentId}`;
    }
    return `${baseUrl}/payments/${paymentId}`;
};

// Process a Stripe payment and create a transaction
const processStripePayment = async (
    charge: Stripe.Charge,
    settings: typeof stripeSettings.$inferSelect,
) => {
    const userId = settings.userId;

    // Check if transaction already exists for this payment
    const [existingTransaction] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.stripePaymentId, charge.id));

    if (existingTransaction) {
        console.log(
            `[Stripe Webhook] Transaction already exists for payment ${charge.id}`,
        );
        return existingTransaction;
    }

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
        date: new Date(charge.created * 1000), // Stripe timestamps are in seconds
        creditAccountId: settings.defaultCreditAccountId,
        debitAccountId: settings.defaultDebitAccountId,
        categoryId: settings.defaultCategoryId,
        status: 'pending',
        statusChangedAt: now,
        statusChangedBy: userId,
        stripePaymentId: charge.id,
        stripePaymentUrl: getStripePaymentUrl(charge.id, isLiveMode),
    });

    // Record status history
    await recordStatusChange(
        transactionId,
        null,
        'pending',
        userId,
        'Transaction created from Stripe payment',
    );

    console.log(
        `[Stripe Webhook] Created transaction ${transactionId} for payment ${charge.id}`,
    );

    return { id: transactionId };
};

export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
        console.error('[Stripe Webhook] Missing stripe-signature header');
        return NextResponse.json(
            { error: 'Missing stripe-signature header' },
            { status: 400 },
        );
    }

    // We need to find the user's settings based on the webhook
    // Since Stripe webhooks don't include user context, we need to match by account
    // First, let's try to extract the account from the event

    let event: Stripe.Event;

    // We'll need to verify the webhook against all registered users' webhook secrets
    // In a production app, you might want to use a single webhook secret per environment
    // or use Stripe Connect with connected accounts

    // Get all stripe settings that have webhook secrets configured
    const allSettings = await db
        .select()
        .from(stripeSettings)
        .where(eq(stripeSettings.isEnabled, true));

    if (allSettings.length === 0) {
        console.error('[Stripe Webhook] No enabled Stripe integrations found');
        return NextResponse.json(
            { error: 'No enabled Stripe integrations' },
            { status: 400 },
        );
    }

    // Try to verify the webhook with each user's webhook secret
    let verifiedSettings: (typeof allSettings)[0] | null = null;
    let decryptedSecretKey: string | null = null;
    let decryptedWebhookSecret: string | null = null;

    for (const settings of allSettings) {
        if (!settings.webhookSecret || !settings.stripeSecretKey) continue;

        // Decrypt the secrets
        const secretKey = safeDecrypt(settings.stripeSecretKey);
        const webhookSecret = safeDecrypt(settings.webhookSecret);

        if (!secretKey || !webhookSecret) continue;

        try {
            const stripe = new Stripe(secretKey);
            event = stripe.webhooks.constructEvent(
                body,
                signature,
                webhookSecret,
            );
            verifiedSettings = settings;
            decryptedSecretKey = secretKey;
            decryptedWebhookSecret = webhookSecret;
            break;
        } catch {}
    }

    if (!verifiedSettings) {
        console.error(
            '[Stripe Webhook] Failed to verify webhook signature with any configured secret',
        );
        return NextResponse.json(
            { error: 'Webhook signature verification failed' },
            { status: 400 },
        );
    }

    // Now we have verified settings and decrypted credentials
    // Use the already decrypted values
    if (!decryptedSecretKey || !decryptedWebhookSecret) {
        console.error('[Stripe Webhook] Missing decrypted credentials');
        return NextResponse.json(
            { error: 'Failed to decrypt credentials' },
            { status: 500 },
        );
    }

    const stripe = new Stripe(decryptedSecretKey);

    // Re-construct the event to get the typed version
    event = stripe.webhooks.constructEvent(
        body,
        signature,
        decryptedWebhookSecret,
    );

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    try {
        switch (event.type) {
            case 'charge.succeeded': {
                const charge = event.data.object as Stripe.Charge;
                await processStripePayment(charge, verifiedSettings);
                break;
            }

            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;

                // Get the latest charge for this payment intent
                if (paymentIntent.latest_charge) {
                    const chargeId =
                        typeof paymentIntent.latest_charge === 'string'
                            ? paymentIntent.latest_charge
                            : paymentIntent.latest_charge.id;

                    const charge = await stripe.charges.retrieve(chargeId);
                    await processStripePayment(charge, verifiedSettings);
                }
                break;
            }

            case 'charge.refunded': {
                const charge = event.data.object as Stripe.Charge;

                // Check if we have a transaction for this payment
                const [existingTransaction] = await db
                    .select()
                    .from(transactions)
                    .where(eq(transactions.stripePaymentId, charge.id));

                if (existingTransaction) {
                    // Create a refund transaction
                    // Convert from Stripe cents to milliunits (* 10)
                    const refundAmount = charge.amount_refunded * 10;
                    const transactionId = createId();
                    const now = new Date();

                    await db.insert(transactions).values({
                        id: transactionId,
                        amount: -refundAmount, // Negative amount for refund
                        payee: existingTransaction.payee,
                        notes: `Stripe refund for payment ${charge.id}`,
                        date: now,
                        // Reverse the accounts for refund
                        creditAccountId: verifiedSettings.defaultDebitAccountId,
                        debitAccountId: verifiedSettings.defaultCreditAccountId,
                        categoryId: verifiedSettings.defaultCategoryId,
                        status: 'pending',
                        statusChangedAt: now,
                        statusChangedBy: verifiedSettings.userId,
                        stripePaymentId: `refund_${charge.id}`,
                        stripePaymentUrl: getStripePaymentUrl(
                            charge.id,
                            charge.livemode,
                        ),
                    });

                    await recordStatusChange(
                        transactionId,
                        null,
                        'pending',
                        verifiedSettings.userId,
                        'Refund transaction created from Stripe',
                    );

                    console.log(
                        `[Stripe Webhook] Created refund transaction ${transactionId} for payment ${charge.id}`,
                    );
                }
                break;
            }

            default:
                console.log(
                    `[Stripe Webhook] Unhandled event type: ${event.type}`,
                );
        }

        // Update last sync timestamp
        await db
            .update(stripeSettings)
            .set({ lastSyncAt: new Date() })
            .where(eq(stripeSettings.userId, verifiedSettings.userId));

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Stripe Webhook] Error processing webhook:', error);
        return NextResponse.json(
            {
                error: 'Webhook processing failed',
                details:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
