import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/db';

const {
    buildReceiptInvoiceTransactionValues,
    getDocumentKey,
    ingestReceiptInvoice,
} = await import('../lib/services/receipt-invoice-ingestion.ts');

const userId = 'user_123';
const sourceContext = {
    source: 'test_ingest',
    actorUserId: userId,
    actorType: 'user',
    externalId: 'invoice-1',
};

const createBaseTransaction = (overrides = {}) => ({
    mode: 'createDraft',
    date: new Date('2026-07-05T00:00:00.000Z'),
    amount: 12_500,
    payee: 'Supplier',
    notes: 'Invoice #1',
    accountId: null,
    creditAccountId: null,
    debitAccountId: null,
    status: 'draft',
    ...overrides,
});

const createAttachment = (overrides = {}) => ({
    fileName: 'invoice.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    storagePath: `users/${userId}/transactions/txn_1/invoice.pdf`,
    documentTypeId: 'invoice_type',
    ...overrides,
});

const createPorts = (overrides = {}) => {
    const calls = [];
    const matchingTransaction = overrides.matchingTransaction ?? null;
    const existingTransaction = overrides.existingTransaction ?? null;
    const existingDocumentKeys = overrides.existingDocumentKeys ?? new Set();
    const documentTypes = overrides.documentTypes ?? [
        { id: 'invoice_type', name: 'Invoice' },
    ];
    const accounts = overrides.accounts ?? [];

    const ports = {
        validateDateNotInClosedPeriod: async () =>
            overrides.closedPeriodError ?? null,
        getSettings: async () => ({ doubleEntryMode: false }),
        getAccounts: async () => accounts,
        findMatchingTransaction: async () => matchingTransaction,
        getTransaction: async () => existingTransaction,
        createTransaction: async ({ values }) => {
            calls.push({ name: 'createTransaction', values });
            return {
                id: 'txn_created',
                date: values.date,
                amount: values.amount,
                payee: values.payee ?? null,
                notes: values.notes ?? null,
                accountId: values.accountId ?? null,
                creditAccountId: values.creditAccountId ?? null,
                debitAccountId: values.debitAccountId ?? null,
                status: values.status ?? 'draft',
                splitType: null,
            };
        },
        updateTransaction: async ({ transaction, values }) => {
            calls.push({ name: 'updateTransaction', values });
            return {
                ...transaction,
                ...values,
                status: values.status ?? transaction.status,
            };
        },
        getDocumentTypes: async () => documentTypes,
        getExistingDocumentKeys: async () => new Set(existingDocumentKeys),
        createDocument: async ({ attachment, documentTypeId }) => {
            calls.push({ name: 'createDocument', attachment, documentTypeId });
            return {
                id: `doc_${calls.length}`,
                fileName: attachment.fileName,
                fileSize: attachment.fileSize,
                mimeType: attachment.mimeType,
                storagePath: attachment.storagePath,
                documentTypeId,
            };
        },
        createDocumentLink: async ({ documentId, transactionId }) => {
            calls.push({
                name: 'createDocumentLink',
                documentId,
                transactionId,
            });
        },
    };

    return { calls, ports };
};

const createInput = (overrides = {}) => ({
    userId,
    documentKind: 'invoice',
    transaction: createBaseTransaction(overrides.transaction),
    matching: { strategy: 'none', ...overrides.matching },
    attachments: overrides.attachments ?? [createAttachment()],
    sourceContext,
});

test('buildReceiptInvoiceTransactionValues maps invoice metadata to draft transaction values', () => {
    const values = buildReceiptInvoiceTransactionValues({
        documentKind: 'invoice',
        metadata: {
            invoiceNumber: '2026-1',
            issueDate: new Date('2026-07-05T00:00:00.000Z'),
            supplierName: 'Supplier',
            payeeIban: 'HR1210010051863000160',
            paymentReference: 'HR00 2026-1',
            totalAmount: 125.4,
        },
    });

    assert.equal(values.mode, 'createDraft');
    assert.equal(values.status, 'draft');
    assert.equal(values.amount, 125_400);
    assert.match(values.notes, /Invoice #2026-1/);
    assert.match(values.notes, /IBAN: HR1210010051863000160/);
});

test('ingestReceiptInvoice creates a draft transaction and attaches documents', async () => {
    const { calls, ports } = createPorts();
    const result = await ingestReceiptInvoice(createInput(), ports);

    assert.equal(result.ok, true);
    assert.equal(result.data.outcome, 'created');
    assert.equal(result.data.transaction.id, 'txn_created');
    assert.equal(result.data.documents.length, 1);
    assert.deepEqual(
        calls.map((call) => call.name),
        ['createTransaction', 'createDocument', 'createDocumentLink'],
    );
});

test('ingestReceiptInvoice updates a matching transaction when requested', async () => {
    const matchingTransaction = {
        id: 'txn_match',
        date: new Date('2026-07-05T00:00:00.000Z'),
        amount: 12_500,
        payee: 'Existing Supplier',
        notes: 'Existing note',
        accountId: null,
        creditAccountId: null,
        debitAccountId: null,
        status: 'draft',
        splitType: null,
    };
    const { calls, ports } = createPorts({
        matchingTransaction,
        accounts: [
            {
                id: 'account_new',
                name: 'New account',
                isReadOnly: false,
            },
        ],
    });

    const result = await ingestReceiptInvoice(
        createInput({
            transaction: {
                mode: 'matchOrCreateDraft',
                notes: 'Imported note',
            },
            matching: { strategy: 'dateAmountCounterparty' },
        }),
        ports,
    );

    assert.equal(result.ok, true);
    assert.equal(result.data.outcome, 'updated');
    assert.equal(result.data.transaction.id, 'txn_match');
    assert.equal(calls[0].name, 'updateTransaction');
    assert.equal(calls[0].values.notes, 'Existing note | Imported note');
});

test('ingestReceiptInvoice does not change financial fields on completed matches', async () => {
    const matchingTransaction = {
        id: 'txn_completed',
        date: new Date('2026-07-05T00:00:00.000Z'),
        amount: 12_500,
        payee: 'Existing Supplier',
        notes: 'Existing note',
        accountId: 'account_existing',
        creditAccountId: null,
        debitAccountId: null,
        status: 'completed',
        splitType: null,
    };
    const { calls, ports } = createPorts({
        matchingTransaction,
        accounts: [
            {
                id: 'account_new',
                name: 'New account',
                isReadOnly: false,
            },
        ],
    });

    const result = await ingestReceiptInvoice(
        createInput({
            transaction: {
                mode: 'matchOrCreateDraft',
                amount: 99_999,
                accountId: 'account_new',
                notes: 'Imported note',
            },
            matching: { strategy: 'dateAmountCounterparty' },
        }),
        ports,
    );

    assert.equal(result.ok, true);
    assert.equal(calls[0].name, 'updateTransaction');
    assert.deepEqual(calls[0].values, {
        payee: 'Existing Supplier',
        notes: 'Existing note | Imported note',
    });
});

test('ingestReceiptInvoice skips duplicate document attachments', async () => {
    const attachment = createAttachment();
    const { calls, ports } = createPorts({
        existingDocumentKeys: new Set([
            getDocumentKey(attachment.fileName, attachment.fileSize),
        ]),
    });

    const result = await ingestReceiptInvoice(
        createInput({ attachments: [attachment] }),
        ports,
    );

    assert.equal(result.ok, true);
    assert.equal(result.data.documents.length, 0);
    assert.equal(result.data.skippedDuplicateDocuments, 1);
    assert.equal(
        calls.some((call) => call.name === 'createDocument'),
        false,
    );
});

test('ingestReceiptInvoice rejects invalid document types', async () => {
    const { ports } = createPorts();
    const result = await ingestReceiptInvoice(
        createInput({
            attachments: [createAttachment({ documentTypeId: 'missing_type' })],
        }),
        ports,
    );

    assert.deepEqual(result, {
        ok: false,
        status: 400,
        error: 'Document type not found.',
    });
});

test('ingestReceiptInvoice rejects invalid accounts before creating transactions', async () => {
    const { calls, ports } = createPorts();
    const result = await ingestReceiptInvoice(
        createInput({
            transaction: {
                creditAccountId: 'missing_account',
            },
        }),
        ports,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.error, /Account\(s\) not found/);
    assert.equal(calls.length, 0);
});

test('ingestReceiptInvoice rejects closed accounting periods', async () => {
    const { calls, ports } = createPorts({
        closedPeriodError: 'Date falls within a closed accounting period.',
    });
    const result = await ingestReceiptInvoice(createInput(), ports);

    assert.deepEqual(result, {
        ok: false,
        status: 400,
        error: 'Date falls within a closed accounting period.',
    });
    assert.equal(calls.length, 0);
});
