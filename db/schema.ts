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
}, (table) => [
    index('accounts_userid_idx').on(table.userId)
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

export const insertAccountSchema = createInsertSchema(accounts);

export const categories = pgTable("categories", {
    id: text("id").primaryKey(),
    plaidId: text("plaid_id"),
    name: text("name").notNull(),
    userId: text("user_id").notNull(),
});

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
]);

export const customersRelations = relations(customers, ({ many }) => ({
    transactions: many(transactions),
}));

export const insertCustomerSchema = createInsertSchema(customers);

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
}, (table) => [
    index('transactions_accountid_idx').on(table.accountId),
    index('transactions_creditaccountid_idx').on(table.creditAccountId),
    index('transactions_debutaccountid_idx').on(table.debitAccountId),
    index('transactions_categoryid_idx').on(table.categoryId),
    index('transactions_payeecustomerid_idx').on(table.payeeCustomerId),
    index('transactions_date_idx').on(table.date),
]);

export const transactionsRelations = relations(transactions, ({ one }) => ({
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
}));

export const insertTransactionSchema = createInsertSchema(transactions, {
    date: z.coerce.date(),
});

export const createTransactionSchema = insertTransactionSchema.omit({
    id: true,
}).refine((data) => {
    // Ensure either payee or payeeCustomerId is provided, but not both
    return (data.payee && !data.payeeCustomerId) || (!data.payee && data.payeeCustomerId);
}, {
    message: "Either payee or payeeCustomerId must be provided, but not both",
});