import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    pgTable,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const accounts = pgTable(
    'accounts',
    {
        id: text('id').primaryKey(),
        plaidId: text('plaid_id'),
        name: text('name').notNull(),
        userId: text('user_id').notNull(),
        code: text('code'),
        isOpen: boolean('is_open').notNull().default(true),
        isReadOnly: boolean('is_read_only').notNull().default(false),
        accountType: text('account_type', {
            enum: ['credit', 'debit', 'neutral'],
        })
            .notNull()
            .default('neutral'),
    },
    (table) => [
        index('accounts_userid_idx').on(table.userId),
        index('accounts_isopen_idx').on(table.isOpen),
        index('accounts_code_idx').on(table.code),
    ],
);

export const accountsRelations = relations(accounts, ({ many }) => ({
    transactions: many(transactions, {
        relationName: 'transactionsAccounts',
    }),
    creditTransactions: many(transactions, {
        relationName: 'transactionsCreditAccounts',
    }),
    debitTransactions: many(transactions, {
        relationName: 'transactionsDebitAccounts',
    }),
}));

export const insertAccountSchema = createInsertSchema(accounts, {
    accountType: z.enum(['credit', 'debit', 'neutral']).default('neutral'),
});

// Tags table - flexible multi-select labeling system
export const tags = pgTable(
    'tags',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        color: text('color'), // Optional hex color for visual distinction
        userId: text('user_id').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('tags_userid_idx').on(table.userId),
        index('tags_name_idx').on(table.name),
    ],
);

export const tagsRelations = relations(tags, ({ many }) => ({
    transactionTags: many(transactionTags),
}));

export const insertTagSchema = createInsertSchema(tags);

// Junction table for many-to-many relationship between transactions and tags
export const transactionTags = pgTable(
    'transaction_tags',
    {
        id: text('id').primaryKey(),
        transactionId: text('transaction_id')
            .notNull()
            .references(() => transactions.id, { onDelete: 'cascade' }),
        tagId: text('tag_id')
            .notNull()
            .references(() => tags.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('transaction_tags_transactionid_idx').on(table.transactionId),
        index('transaction_tags_tagid_idx').on(table.tagId),
    ],
);

export const transactionTagsRelations = relations(
    transactionTags,
    ({ one }) => ({
        transaction: one(transactions, {
            fields: [transactionTags.transactionId],
            references: [transactions.id],
        }),
        tag: one(tags, {
            fields: [transactionTags.tagId],
            references: [tags.id],
        }),
    }),
);

export const insertTransactionTagSchema = createInsertSchema(transactionTags);

export const customers = pgTable(
    'customers',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        pin: text('pin'),
        vatNumber: text('vat_number'),
        address: text('address'),
        contactEmail: text('contact_email'),
        contactTelephone: text('contact_telephone'),
        userId: text('user_id').notNull(),
        isComplete: boolean('is_complete').notNull().default(false),
        // Flag to mark this customer as the user's own firm/company
        isOwnFirm: boolean('is_own_firm').notNull().default(false),
    },
    (table) => [
        index('customers_userid_idx').on(table.userId),
        index('customers_name_idx').on(table.name),
        index('customers_pin_idx').on(table.pin),
        index('customers_iscomplete_idx').on(table.isComplete),
        index('customers_isownfirm_idx').on(table.isOwnFirm),
    ],
);

export const customersRelations = relations(customers, ({ many }) => ({
    transactions: many(transactions),
    ibans: many(customerIbans),
}));

export const insertCustomerSchema = createInsertSchema(customers);

// Customer IBANs table - stores multiple IBANs per customer for matching during import
export const customerIbans = pgTable(
    'customer_ibans',
    {
        id: text('id').primaryKey(),
        customerId: text('customer_id')
            .notNull()
            .references(() => customers.id, {
                onDelete: 'cascade',
            }),
        iban: text('iban').notNull(),
        bankName: text('bank_name'), // Optional bank name for this IBAN
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('customer_ibans_customerid_idx').on(table.customerId),
        index('customer_ibans_iban_idx').on(table.iban),
    ],
);

export const customerIbansRelations = relations(customerIbans, ({ one }) => ({
    customer: one(customers, {
        fields: [customerIbans.customerId],
        references: [customers.id],
    }),
}));

export const insertCustomerIbanSchema = createInsertSchema(customerIbans);

export const settings = pgTable(
    'settings',
    {
        userId: text('user_id').primaryKey(),
        doubleEntryMode: boolean('double_entry_mode').notNull().default(false),
        autoDraftToPending: boolean('auto_draft_to_pending')
            .notNull()
            .default(false),
        // Reconciliation conditions - JSON array of conditions
        // e.g., ["hasReceipt", "isReviewed", "isApproved"]
        reconciliationConditions: text('reconciliation_conditions')
            .notNull()
            .default('["hasReceipt"]'),
        // Minimum number of required document types that must be attached before reconciling a transaction
        // 0 means all required document types must be attached, 1 or more means at least N
        minRequiredDocuments: integer('min_required_documents')
            .notNull()
            .default(0),
        // List of document type IDs that are required for reconciliation
        // JSON array of document type IDs, e.g., ["doctype1", "doctype2"]
        requiredDocumentTypeIds: text('required_document_type_ids')
            .notNull()
            .default('[]'),
    },
    (table) => [index('settings_userid_idx').on(table.userId)],
);

export const insertSettingsSchema = createInsertSchema(settings);

// Document types table - predefined types for documents
export const documentTypes = pgTable(
    'document_types',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(), // e.g., "Receipt", "Invoice", "Contract"
        description: text('description'),
        userId: text('user_id').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('document_types_userid_idx').on(table.userId),
        index('document_types_name_idx').on(table.name),
    ],
);

export const insertDocumentTypeSchema = createInsertSchema(documentTypes);

// Documents table - stores metadata about uploaded documents
export const documents = pgTable(
    'documents',
    {
        id: text('id').primaryKey(),
        fileName: text('file_name').notNull(),
        fileSize: integer('file_size').notNull(), // in bytes
        mimeType: text('mime_type').notNull(),
        documentTypeId: text('document_type_id')
            .notNull()
            .references(() => documentTypes.id, {
                onDelete: 'restrict',
            }),
        // Primary transaction this document is attached to (nullable for standalone documents)
        transactionId: text('transaction_id').references(
            () => transactions.id,
            {
                onDelete: 'set null',
            },
        ),
        // Azure Blob Storage path
        storagePath: text('storage_path').notNull(),
        // Uploader user ID
        uploadedBy: text('uploaded_by').notNull(),
        uploadedAt: timestamp('uploaded_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        // For managing document lifecycle
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('documents_transactionid_idx').on(table.transactionId),
        index('documents_documenttypeid_idx').on(table.documentTypeId),
        index('documents_uploadedby_idx').on(table.uploadedBy),
        index('documents_isdeleted_idx').on(table.isDeleted),
    ],
);

export const documentRelations = relations(documents, ({ one }) => ({
    documentType: one(documentTypes, {
        fields: [documents.documentTypeId],
        references: [documentTypes.id],
    }),
    transaction: one(transactions, {
        fields: [documents.transactionId],
        references: [transactions.id],
        relationName: 'documents',
    }),
}));

export const insertDocumentSchema = createInsertSchema(documents);

export const transactions = pgTable(
    'transactions',
    {
        id: text('id').primaryKey(),
        amount: integer('amount').notNull(),
        payee: text('payee'), // Made nullable for backward compatibility
        payeeCustomerId: text('payee_customer_id').references(
            () => customers.id,
            {
                onDelete: 'set null',
            },
        ),
        notes: text('notes'),
        date: timestamp('date', { mode: 'date' }).notNull(),
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        creditAccountId: text('credit_account_id').references(
            () => accounts.id,
            {
                onDelete: 'set null',
            },
        ),
        debitAccountId: text('debit_account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        // Transaction status fields
        status: text('status').notNull().default('pending'), // draft, pending, completed, reconciled
        statusChangedAt: timestamp('status_changed_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        statusChangedBy: text('status_changed_by'),
        // Split transaction fields
        splitGroupId: text('split_group_id'), // Groups related split transactions together
        splitType: text('split_type'), // 'parent' or 'child' - parent is the main transaction
        // Stripe integration fields
        stripePaymentId: text('stripe_payment_id'), // Stripe payment intent or charge ID
        stripePaymentUrl: text('stripe_payment_url'), // URL to Stripe dashboard for this payment
    },
    (table) => [
        index('transactions_accountid_idx').on(table.accountId),
        index('transactions_creditaccountid_idx').on(table.creditAccountId),
        index('transactions_debutaccountid_idx').on(table.debitAccountId),
        index('transactions_payeecustomerid_idx').on(table.payeeCustomerId),
        index('transactions_date_idx').on(table.date),
        index('transactions_status_idx').on(table.status),
        index('transactions_splitgroupid_idx').on(table.splitGroupId),
        index('transactions_splittype_idx').on(table.splitType),
        index('transactions_stripepaymentid_idx').on(table.stripePaymentId),
    ],
);

// Update transactions relations to include documents
export const transactionsRelations = relations(
    transactions,
    ({ one, many }) => ({
        account: one(accounts, {
            fields: [transactions.accountId],
            references: [accounts.id],
            relationName: 'transactionsAccounts',
        }),
        creditAccount: one(accounts, {
            fields: [transactions.creditAccountId],
            references: [accounts.id],
            relationName: 'transactionsCreditAccounts',
        }),
        debitAccount: one(accounts, {
            fields: [transactions.debitAccountId],
            references: [accounts.id],
            relationName: 'transactionsDebitAccounts',
        }),
        payeeCustomer: one(customers, {
            fields: [transactions.payeeCustomerId],
            references: [customers.id],
        }),
        documents: many(documents, {
            relationName: 'documents',
        }),
        transactionTags: many(transactionTags),
    }),
);

export const insertTransactionSchema = createInsertSchema(transactions, {
    date: z.coerce.date(),
    status: z
        .enum(['draft', 'pending', 'completed', 'reconciled'])
        .default('draft')
        .optional(),
    splitType: z.enum(['parent', 'child']).optional(),
});

export const createTransactionSchema = insertTransactionSchema
    .omit({
        id: true,
        statusChangedAt: true,
        statusChangedBy: true,
    })
    .refine(
        (data) => {
            // For draft transactions, allow missing fields
            if (data.status === 'draft') {
                return true;
            }
            // For non-draft transactions, ensure at least payee or payeeCustomerId is provided
            return !!data.payee || !!data.payeeCustomerId;
        },
        {
            message:
                'Please select a payee or customer to complete the transaction.',
        },
    );

// Transaction status history table
export const transactionStatusHistory = pgTable(
    'transaction_status_history',
    {
        id: text('id').primaryKey(),
        transactionId: text('transaction_id')
            .notNull()
            .references(() => transactions.id, {
                onDelete: 'cascade',
            }),
        fromStatus: text('from_status'),
        toStatus: text('to_status').notNull(),
        changedAt: timestamp('changed_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        changedBy: text('changed_by').notNull(),
        notes: text('notes'),
    },
    (table) => [
        index('transaction_status_history_transactionid_idx').on(
            table.transactionId,
        ),
        index('transaction_status_history_changedat_idx').on(table.changedAt),
    ],
);

export const transactionStatusHistoryRelations = relations(
    transactionStatusHistory,
    ({ one }) => ({
        transaction: one(transactions, {
            fields: [transactionStatusHistory.transactionId],
            references: [transactions.id],
        }),
    }),
);

export const insertTransactionStatusHistorySchema = createInsertSchema(
    transactionStatusHistory,
);

// Stripe integration settings table - stores per-user Stripe configuration
export const stripeSettings = pgTable(
    'stripe_settings',
    {
        userId: text('user_id').primaryKey(),
        // Stripe account ID (from Connect or just API key usage)
        stripeAccountId: text('stripe_account_id'),
        // Encrypted Stripe secret key (for API access)
        stripeSecretKey: text('stripe_secret_key'),
        // Webhook signing secret for verifying webhook events
        webhookSecret: text('webhook_secret'),
        // Default accounts for Stripe transactions
        defaultCreditAccountId: text('default_credit_account_id').references(
            () => accounts.id,
            { onDelete: 'set null' },
        ),
        defaultDebitAccountId: text('default_debit_account_id').references(
            () => accounts.id,
            { onDelete: 'set null' },
        ),
        // Default tag for Stripe transactions
        defaultTagId: text('default_tag_id').references(() => tags.id, {
            onDelete: 'set null',
        }),
        // Whether the integration is enabled
        isEnabled: boolean('is_enabled').notNull().default(false),
        // Date from which to start syncing payments (for initial import)
        syncFromDate: timestamp('sync_from_date', { mode: 'date' }),
        // Last sync timestamp
        lastSyncAt: timestamp('last_sync_at', { mode: 'date' }),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('stripe_settings_userid_idx').on(table.userId),
        index('stripe_settings_stripeaccountid_idx').on(table.stripeAccountId),
    ],
);

export const stripeSettingsRelations = relations(stripeSettings, ({ one }) => ({
    defaultCreditAccount: one(accounts, {
        fields: [stripeSettings.defaultCreditAccountId],
        references: [accounts.id],
        relationName: 'stripeCreditAccount',
    }),
    defaultDebitAccount: one(accounts, {
        fields: [stripeSettings.defaultDebitAccountId],
        references: [accounts.id],
        relationName: 'stripeDebitAccount',
    }),
    defaultTag: one(tags, {
        fields: [stripeSettings.defaultTagId],
        references: [tags.id],
    }),
}));

export const insertStripeSettingsSchema = createInsertSchema(stripeSettings);

// Open Finances settings table - stores per-user configuration for public financial transparency page
export const openFinancesSettings = pgTable(
    'open_finances_settings',
    {
        userId: text('user_id').primaryKey(),
        // Whether the open finances page is enabled for this user
        isEnabled: boolean('is_enabled').notNull().default(false),
        // JSON object containing which metrics to expose and their custom labels
        // e.g., {"revenue": {"enabled": true, "label": "Total Revenue"}, "expenses": {"enabled": false}}
        exposedMetrics: text('exposed_metrics').notNull().default('{}'),
        // Optional custom title for the public page
        pageTitle: text('page_title'),
        // Optional custom description
        pageDescription: text('page_description'),
        // Date range for displaying data
        dateFrom: timestamp('date_from', { mode: 'date' }),
        dateTo: timestamp('date_to', { mode: 'date' }),
        // Whether to allow embedding in iframes
        allowEmbedding: boolean('allow_embedding').notNull().default(true),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    (table) => [index('open_finances_settings_userid_idx').on(table.userId)],
);

export const insertOpenFinancesSettingsSchema =
    createInsertSchema(openFinancesSettings);

// Dashboard layout table - stores user's customized dashboard widget layout
export const dashboardLayouts = pgTable(
    'dashboard_layouts',
    {
        userId: text('user_id').primaryKey(),
        // JSON string containing the array of widget configurations
        // Each widget has: id, type, and type-specific config (refreshRate, etc.)
        widgetsConfig: text('widgets_config').notNull().default('[]'),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    (table) => [index('dashboard_layouts_userid_idx').on(table.userId)],
);

export const insertDashboardLayoutSchema = createInsertSchema(dashboardLayouts);
