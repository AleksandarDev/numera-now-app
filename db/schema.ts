import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const accounts = pgTable("accounts", {
    id: text("id").primaryKey(),
    plaidId: text("plaid_id"),
    name: text("name").notNull(),
    userId: text("user_id").notNull(),
    code: text("code"),
    isOpen: boolean("is_open").notNull().default(true),
    isReadOnly: boolean("is_read_only").notNull().default(false),
    accountType: text("account_type", { enum: ["credit", "debit", "neutral"] }).notNull().default("neutral"),
}, (table) => [
    index('accounts_userid_idx').on(table.userId),
    index('accounts_isopen_idx').on(table.isOpen),
    index('accounts_code_idx').on(table.code),
]);

export const accountsRelations = relations(accounts, ({ many }) => ({
    transactions: many(transactions, {
        relationName: "transactionsAccounts",
    }),
    creditTransactions: many(transactions, {
        relationName: "transactionsCreditAccounts",
    }),
    debitTransactions: many(transactions, {
        relationName: "transactionsDebitAccounts",
    }),
}));

export const insertAccountSchema = createInsertSchema(accounts, {
    accountType: z.enum(["credit", "debit", "neutral"]).default("neutral"),
});

export const categories = pgTable("categories", {
    id: text("id").primaryKey(),
    plaidId: text("plaid_id"),
    name: text("name").notNull(),
    userId: text("user_id").notNull(),
}, (table) => [
    index('categories_userid_idx').on(table.userId),
]);

export const categoriesRelations = relations(categories, ({ many }) => ({
    transactions: many(transactions),
}));

export const insertCategorySchema = createInsertSchema(categories);

export const customers = pgTable("customers", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    pin: text("pin"),
    vatNumber: text("vat_number"),
    address: text("address"),
    contactEmail: text("contact_email"),
    contactTelephone: text("contact_telephone"),
    userId: text("user_id").notNull(),
    isComplete: boolean("is_complete").notNull().default(false),
}, (table) => [
    index('customers_userid_idx').on(table.userId),
    index('customers_name_idx').on(table.name),
    index('customers_pin_idx').on(table.pin),
    index('customers_iscomplete_idx').on(table.isComplete),
]);

export const customersRelations = relations(customers, ({ many }) => ({
    transactions: many(transactions),
}));

export const insertCustomerSchema = createInsertSchema(customers);

export const settings = pgTable("settings", {
    userId: text("user_id").primaryKey(),
    doubleEntryMode: boolean("double_entry_mode").notNull().default(false),
    // Reconciliation conditions - JSON array of conditions
    // e.g., ["hasReceipt", "isReviewed", "isApproved"]
    reconciliationConditions: text("reconciliation_conditions").notNull().default('["hasReceipt"]'),
    // Minimum number of required document types that must be attached before completing a transaction
    // 0 means all required document types must be attached, 1 or more means at least N
    minRequiredDocuments: integer("min_required_documents").notNull().default(0),
}, (table) => [
    index('settings_userid_idx').on(table.userId)
]);

export const insertSettingsSchema = createInsertSchema(settings);

// Document types table - predefined types for documents
export const documentTypes = pgTable("document_types", {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // e.g., "Receipt", "Invoice", "Contract"
    description: text("description"),
    userId: text("user_id").notNull(),
    isRequired: boolean("is_required").notNull().default(false), // Whether this type is required for reconciliation
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
    index('document_types_userid_idx').on(table.userId),
    index('document_types_isrequired_idx').on(table.isRequired),
    index('document_types_name_idx').on(table.name),
]);

export const insertDocumentTypeSchema = createInsertSchema(documentTypes);

// Documents table - stores metadata about uploaded documents
export const documents = pgTable("documents", {
    id: text("id").primaryKey(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(), // in bytes
    mimeType: text("mime_type").notNull(),
    documentTypeId: text("document_type_id").notNull().references(() => documentTypes.id, {
        onDelete: "restrict",
    }),
    // Primary transaction this document is attached to
    transactionId: text("transaction_id").notNull().references(() => transactions.id, {
        onDelete: "cascade",
    }),
    // Azure Blob Storage path
    storagePath: text("storage_path").notNull(),
    // Uploader user ID
    uploadedBy: text("uploaded_by").notNull(),
    uploadedAt: timestamp("uploaded_at", { mode: "date" }).notNull().defaultNow(),
    // For managing document lifecycle
    isDeleted: boolean("is_deleted").notNull().default(false),
}, (table) => [
    index('documents_transactionid_idx').on(table.transactionId),
    index('documents_documenttypeid_idx').on(table.documentTypeId),
    index('documents_uploadedby_idx').on(table.uploadedBy),
    index('documents_isdeleted_idx').on(table.isDeleted),
]);

export const documentRelations = relations(documents, ({ one }) => ({
    documentType: one(documentTypes, {
        fields: [documents.documentTypeId],
        references: [documentTypes.id],
    }),
    transaction: one(transactions, {
        fields: [documents.transactionId],
        references: [transactions.id],
        relationName: "documents",
    }),
}));

export const insertDocumentSchema = createInsertSchema(documents);

export const transactions = pgTable("transactions", {
    id: text("id").primaryKey(),
    amount: integer("amount").notNull(),
    payee: text("payee"), // Made nullable for backward compatibility
    payeeCustomerId: text("payee_customer_id").references(() => customers.id, {
        onDelete: "set null",
    }),
    notes: text("notes"),
    date: timestamp("date", { mode: "date" }).notNull(),
    accountId: text("account_id").references(() => accounts.id, {
        onDelete: "set null",
    }),
    creditAccountId: text("credit_account_id").references(() => accounts.id, {
        onDelete: "set null",
    }),
    debitAccountId: text("debit_account_id").references(() => accounts.id, {
        onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, {
        onDelete: "set null",
    }),
    // Transaction status fields
    status: text("status").notNull().default("pending"), // draft, pending, completed, reconciled
    statusChangedAt: timestamp("status_changed_at", { mode: "date" }).notNull().defaultNow(),
    statusChangedBy: text("status_changed_by"),
    // Split transaction fields
    splitGroupId: text("split_group_id"), // Groups related split transactions together
    splitType: text("split_type"), // 'parent' or 'child' - parent is the main transaction
}, (table) => [
    index('transactions_accountid_idx').on(table.accountId),
    index('transactions_creditaccountid_idx').on(table.creditAccountId),
    index('transactions_debutaccountid_idx').on(table.debitAccountId),
    index('transactions_categoryid_idx').on(table.categoryId),
    index('transactions_payeecustomerid_idx').on(table.payeeCustomerId),
    index('transactions_date_idx').on(table.date),
    index('transactions_status_idx').on(table.status),
    index('transactions_splitgroupid_idx').on(table.splitGroupId),
    index('transactions_splittype_idx').on(table.splitType),
]);

// Update transactions relations to include documents
export const transactionsRelations = relations(transactions, ({ one, many }) => ({
    account: one(accounts, {
        fields: [transactions.accountId],
        references: [accounts.id],
        relationName: "transactionsAccounts",
    }),
    creditAccount: one(accounts, {
        fields: [transactions.creditAccountId],
        references: [accounts.id],
        relationName: "transactionsCreditAccounts",
    }),
    debitAccount: one(accounts, {
        fields: [transactions.debitAccountId],
        references: [accounts.id],
        relationName: "transactionsDebitAccounts",
    }),
    categories: one(categories, {
        fields: [transactions.categoryId],
        references: [categories.id],
    }),
    payeeCustomer: one(customers, {
        fields: [transactions.payeeCustomerId],
        references: [customers.id],
    }),
    documents: many(documents, {
        relationName: "documents",
    }),
}));

export const insertTransactionSchema = createInsertSchema(transactions, {
    date: z.coerce.date(),
    status: z.enum(["draft", "pending", "completed", "reconciled"]).default("draft").optional(),
    splitType: z.enum(["parent", "child"]).optional(),
});

export const createTransactionSchema = insertTransactionSchema.omit({
    id: true,
    statusChangedAt: true,
    statusChangedBy: true,
}).refine((data) => {
    // For draft transactions, allow missing fields
    if (data.status === "draft") {
        return true;
    }
    // For non-draft transactions, ensure at least payee or payeeCustomerId is provided
    return !!data.payee || !!data.payeeCustomerId;
}, {
    message: "Please select a payee or customer to complete the transaction.",
});

// Transaction status history table
export const transactionStatusHistory = pgTable("transaction_status_history", {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").notNull().references(() => transactions.id, {
        onDelete: "cascade",
    }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedAt: timestamp("changed_at", { mode: "date" }).notNull().defaultNow(),
    changedBy: text("changed_by").notNull(),
    notes: text("notes"),
}, (table) => [
    index('transaction_status_history_transactionid_idx').on(table.transactionId),
    index('transaction_status_history_changedat_idx').on(table.changedAt),
]);

export const transactionStatusHistoryRelations = relations(transactionStatusHistory, ({ one }) => ({
    transaction: one(transactions, {
        fields: [transactionStatusHistory.transactionId],
        references: [transactions.id],
    }),
}));

export const insertTransactionStatusHistorySchema = createInsertSchema(transactionStatusHistory);