import { createId } from '@paralleldrive/cuid2';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { ApiKeyAuthContext } from '../../../lib/api-keys.ts';
import { generateStandaloneUploadUrl } from '../../../lib/azure-storage.ts';
import { createExternalApiAuthMiddleware } from '../../../lib/external-api-auth.ts';
import {
    buildExternalIngestSourceContext,
    createExternalIngestRateLimitMiddleware,
    type ExternalIngestIdempotencyStore,
    type ExternalIngestRateLimitStore,
    type ExternalIngestResponseSnapshot,
    withExternalIngestIdempotency,
} from '../../../lib/external-ingest-controls.ts';
import {
    ingestReceiptInvoice,
    type ReceiptInvoiceDocumentKind,
    type ReceiptInvoiceIngestionPorts,
    type ReceiptInvoiceIngestionResult,
} from '../../../lib/services/receipt-invoice-ingestion.ts';

export const EXTERNAL_INGEST_BASE_PATH = '/api/external/v1';
export const EXTERNAL_INGEST_UPLOAD_EXPIRES_MINUTES = 30;
export const EXTERNAL_INGEST_MAX_FILE_SIZE_BYTES = Number(
    process.env.EXTERNAL_INGEST_MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024,
);
export const EXTERNAL_INGEST_ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/xml',
    'text/xml',
] as const;

type ExternalIngestAllowedMimeType =
    (typeof EXTERNAL_INGEST_ALLOWED_MIME_TYPES)[number];

type UploadUrlGenerator = (input: {
    userId: string;
    fileName: string;
    mimeType: ExternalIngestAllowedMimeType;
    fileSize: number;
    now: Date;
}) => {
    uploadUrl: string;
    storagePath: string;
    expiresAt?: Date;
};

type ExternalIngestRouteDependencies = {
    authMiddleware?: MiddlewareHandler;
    rateLimitMiddleware?: MiddlewareHandler;
    rateLimitStore?: ExternalIngestRateLimitStore;
    idempotencyStore?: ExternalIngestIdempotencyStore;
    ingestionPorts?: ReceiptInvoiceIngestionPorts;
    uploadUrlGenerator?: UploadUrlGenerator;
    now?: () => Date;
};

type ExternalIngestErrorDetail = {
    path: string;
    message: string;
};

type UploadDependencies = {
    uploadUrlGenerator: UploadUrlGenerator;
    now: () => Date;
};

type IngestDependencies = {
    idempotencyStore?: ExternalIngestIdempotencyStore;
    ingestionPorts?: ReceiptInvoiceIngestionPorts;
    now: () => Date;
};

const allowedMimeTypes = new Set<string>(EXTERNAL_INGEST_ALLOWED_MIME_TYPES);
const decimalStringSchema = z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d{1,3})?$/, {
        message: 'Expected a decimal string with up to 3 decimal places.',
    });
const positiveDecimalStringSchema = decimalStringSchema.refine(
    (value) => parseExternalDecimalToMiliunits(value) > 0,
    { message: 'Expected a positive decimal amount.' },
);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Expected an ISO date in YYYY-MM-DD format.',
});
const optionalTextSchema = z.string().trim().min(1).max(1000).optional();
const optionalNullableTextSchema = z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .nullable()
    .optional();
const fileNameSchema = z.string().trim().min(1).max(255);
const sha256Schema = z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/, {
        message: 'Expected a lowercase SHA-256 hex digest.',
    })
    .optional();

const uploadRequestSchema = z.object({
    fileName: fileNameSchema,
    mimeType: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive(),
    sha256: sha256Schema,
});

const attachmentSchema = uploadRequestSchema.extend({
    uploadId: z.string().trim().min(1),
    documentTypeId: z.string().trim().min(1).nullable().optional(),
});

const ingestRequestSchema = z.object({
    externalId: z.string().trim().min(1).max(255),
    sourceSystem: z.string().trim().min(1).max(255),
    document: z.object({
        kind: z.enum(['invoice', 'receipt']).optional(),
        documentTypeId: z.string().trim().min(1).nullable().optional(),
        number: optionalNullableTextSchema,
        issueDate: isoDateSchema,
        dueDate: isoDateSchema.optional().nullable(),
        currency: z.string().trim().length(3).optional().default('EUR'),
        totalAmount: positiveDecimalStringSchema,
        taxAmount: decimalStringSchema.optional().nullable(),
        netAmount: decimalStringSchema.optional().nullable(),
        paymentReference: optionalNullableTextSchema,
        notes: optionalNullableTextSchema,
    }),
    counterparty: z
        .object({
            name: optionalTextSchema,
            vatNumber: optionalNullableTextSchema,
            iban: optionalNullableTextSchema,
            address: optionalNullableTextSchema,
            country: z.string().trim().length(2).optional().nullable(),
            externalId: optionalNullableTextSchema,
            createIfMissing: z.boolean().optional().default(false),
        })
        .optional(),
    transaction: z.object({
        mode: z.enum(['createDraft', 'attachToExisting', 'matchOrCreateDraft']),
        transactionId: z.string().trim().min(1).nullable().optional(),
        date: isoDateSchema.optional(),
        amount: decimalStringSchema.optional(),
        payee: optionalNullableTextSchema,
        notes: optionalNullableTextSchema,
        accountId: z.string().trim().min(1).nullable().optional(),
        creditAccountId: z.string().trim().min(1).nullable().optional(),
        debitAccountId: z.string().trim().min(1).nullable().optional(),
        status: z
            .enum(['draft', 'pending', 'completed', 'reconciled'])
            .optional(),
        tagIds: z.array(z.string().trim().min(1)).optional().default([]),
    }),
    matching: z
        .object({
            strategy: z
                .enum(['none', 'dateAmountCounterparty', 'externalId'])
                .optional()
                .default('none'),
        })
        .optional()
        .default({ strategy: 'none' }),
    attachments: z.array(attachmentSchema).max(10).optional().default([]),
});

export const parseExternalDecimalToMiliunits = (value: string) => {
    const trimmed = value.trim();
    const sign = trimmed.startsWith('-') ? -1 : 1;
    const unsigned = trimmed.replace(/^-/, '');
    const [whole = '0', fraction = ''] = unsigned.split('.');
    const normalizedFraction = `${fraction}000`.slice(0, 3);

    return sign * (Number(whole) * 1000 + Number(normalizedFraction));
};

const parseIsoDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const getRequestId = (ctx: Context) =>
    ctx.req.header('x-request-id')?.trim() || createId();

const getExternalApiAuth = (ctx: Context) =>
    ctx.get('externalApiAuth') as ApiKeyAuthContext | undefined;

const normalizeExternalPath = (path: string) => {
    if (path.startsWith(EXTERNAL_INGEST_BASE_PATH)) {
        return path;
    }

    return `${EXTERNAL_INGEST_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
};

const toValidationDetails = (error: z.ZodError): ExternalIngestErrorDetail[] =>
    error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
    }));

const buildErrorBody = ({
    code,
    message,
    requestId,
    details,
}: {
    code: string;
    message: string;
    requestId: string;
    details?: ExternalIngestErrorDetail[];
}) => ({
    error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
    },
});

const jsonError = (
    ctx: Context,
    status: ContentfulStatusCode,
    code: string,
    message: string,
    requestId: string,
    details?: ExternalIngestErrorDetail[],
) => ctx.json(buildErrorBody({ code, message, requestId, details }), status);

const jsonSnapshot = (ctx: Context, snapshot: ExternalIngestResponseSnapshot) =>
    ctx.json(
        snapshot.body as Record<string, unknown>,
        snapshot.status as ContentfulStatusCode,
    );

const readJsonPayload = async (ctx: Context, requestId: string) => {
    try {
        return {
            ok: true as const,
            payload: await ctx.req.json(),
        };
    } catch {
        return {
            ok: false as const,
            response: jsonError(
                ctx,
                400,
                'invalid_request',
                'Malformed JSON body.',
                requestId,
            ),
        };
    }
};

const validateFilePolicy = (
    file: {
        fileName: string;
        mimeType: string;
        fileSize: number;
    },
    requestId: string,
):
    | { ok: true }
    | {
          ok: false;
          status: ContentfulStatusCode;
          body: ReturnType<typeof buildErrorBody>;
      } => {
    if (!allowedMimeTypes.has(file.mimeType)) {
        return {
            ok: false,
            status: 415,
            body: buildErrorBody({
                code: 'unsupported_media_type',
                message: `Unsupported file type: ${file.mimeType}.`,
                requestId,
                details: [
                    {
                        path: 'mimeType',
                        message: `Allowed MIME types: ${EXTERNAL_INGEST_ALLOWED_MIME_TYPES.join(', ')}`,
                    },
                ],
            }),
        };
    }

    if (file.fileSize > EXTERNAL_INGEST_MAX_FILE_SIZE_BYTES) {
        return {
            ok: false,
            status: 413,
            body: buildErrorBody({
                code: 'file_too_large',
                message: `File exceeds the ${EXTERNAL_INGEST_MAX_FILE_SIZE_BYTES} byte limit.`,
                requestId,
                details: [
                    {
                        path: 'fileSize',
                        message: `Maximum file size is ${EXTERNAL_INGEST_MAX_FILE_SIZE_BYTES} bytes.`,
                    },
                ],
            }),
        };
    }

    return { ok: true };
};

const buildDefaultNotes = ({
    documentKind,
    document,
    transactionNotes,
}: {
    documentKind: ReceiptInvoiceDocumentKind;
    document: z.infer<typeof ingestRequestSchema>['document'];
    transactionNotes?: string | null;
}) => {
    if (transactionNotes) {
        return transactionNotes;
    }

    const noteParts = [];
    if (document.number) {
        noteParts.push(
            `${documentKind === 'invoice' ? 'Invoice' : 'Receipt'} #${document.number}`,
        );
    }
    if (document.paymentReference) {
        noteParts.push(`Ref: ${document.paymentReference}`);
    }
    if (document.notes) {
        noteParts.push(document.notes);
    }

    return noteParts.join(' | ') || null;
};

const defaultUploadUrlGenerator: UploadUrlGenerator = ({
    userId,
    fileName,
    now,
}) => {
    const { uploadUrl, storagePath } = generateStandaloneUploadUrl(
        userId,
        fileName,
        EXTERNAL_INGEST_UPLOAD_EXPIRES_MINUTES,
    );

    return {
        uploadUrl,
        storagePath,
        expiresAt: new Date(
            now.getTime() + EXTERNAL_INGEST_UPLOAD_EXPIRES_MINUTES * 60 * 1000,
        ),
    };
};

const toExternalIngestResponse = ({
    result,
    ingestEventId,
}: {
    result: ReceiptInvoiceIngestionResult;
    ingestEventId: string;
}): ExternalIngestResponseSnapshot => {
    if (!result.ok) {
        return {
            status: result.status,
            body: {
                error: {
                    code:
                        result.status === 404
                            ? 'not_found'
                            : 'validation_failed',
                    message: result.error,
                    requestId: null,
                },
            },
        };
    }

    return {
        status: result.data.outcome === 'created' ? 201 : 200,
        body: {
            data: {
                ingestEventId,
                idempotentReplay: false,
                outcome: result.data.outcome,
                transaction: {
                    id: result.data.transaction.id,
                    status: result.data.transaction.status,
                },
                documents: result.data.documents.map((document) => ({
                    id: document.id,
                    fileName: document.fileName,
                    mimeType: document.mimeType,
                    fileSize: document.fileSize,
                    documentTypeId: document.documentTypeId,
                })),
                skippedDuplicateDocuments:
                    result.data.skippedDuplicateDocuments,
            },
        },
    };
};

const handleUploadRequest = async (
    ctx: Context,
    dependencies: UploadDependencies,
) => {
    const requestId = getRequestId(ctx);
    const auth = getExternalApiAuth(ctx);
    if (!auth) {
        return jsonError(
            ctx,
            401,
            'unauthorized',
            'External API authentication is required.',
            requestId,
        );
    }

    const jsonPayload = await readJsonPayload(ctx, requestId);
    if (!jsonPayload.ok) {
        return jsonPayload.response;
    }

    const parsed = uploadRequestSchema.safeParse(jsonPayload.payload);
    if (!parsed.success) {
        return jsonError(
            ctx,
            422,
            'validation_failed',
            'Request validation failed.',
            requestId,
            toValidationDetails(parsed.error),
        );
    }

    const filePolicy = validateFilePolicy(parsed.data, requestId);
    if (!filePolicy.ok) {
        return ctx.json(filePolicy.body, filePolicy.status);
    }

    const now = dependencies.now();
    const upload = dependencies.uploadUrlGenerator({
        userId: auth.userId,
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType as ExternalIngestAllowedMimeType,
        fileSize: parsed.data.fileSize,
        now,
    });
    const expiresAt =
        upload.expiresAt ??
        new Date(
            now.getTime() + EXTERNAL_INGEST_UPLOAD_EXPIRES_MINUTES * 60 * 1000,
        );

    return ctx.json(
        {
            data: {
                uploadId: upload.storagePath,
                uploadUrl: upload.uploadUrl,
                expiresAt: expiresAt.toISOString(),
                requiredHeaders: {
                    'x-ms-blob-type': 'BlockBlob',
                    'Content-Type': parsed.data.mimeType,
                },
            },
        },
        201,
    );
};

const handleIngestRequest = async ({
    ctx,
    documentKind,
    dependencies,
}: {
    ctx: Context;
    documentKind: ReceiptInvoiceDocumentKind;
    dependencies: IngestDependencies;
}) => {
    const requestId = getRequestId(ctx);
    const auth = getExternalApiAuth(ctx);
    if (!auth) {
        return jsonError(
            ctx,
            401,
            'unauthorized',
            'External API authentication is required.',
            requestId,
        );
    }

    const jsonPayload = await readJsonPayload(ctx, requestId);
    if (!jsonPayload.ok) {
        return jsonPayload.response;
    }

    const parsed = ingestRequestSchema.safeParse(jsonPayload.payload);
    if (!parsed.success) {
        return jsonError(
            ctx,
            422,
            'validation_failed',
            'Request validation failed.',
            requestId,
            toValidationDetails(parsed.error),
        );
    }

    if (
        parsed.data.document.kind &&
        parsed.data.document.kind !== documentKind
    ) {
        return jsonError(
            ctx,
            400,
            'invalid_request',
            `Document kind must match the ${documentKind} endpoint.`,
            requestId,
            [
                {
                    path: 'document.kind',
                    message: `Expected ${documentKind}.`,
                },
            ],
        );
    }

    for (const [index, attachment] of parsed.data.attachments.entries()) {
        const filePolicy = validateFilePolicy(attachment, requestId);
        if (!filePolicy.ok) {
            return ctx.json(filePolicy.body, filePolicy.status);
        }

        if (!attachment.uploadId) {
            return jsonError(
                ctx,
                422,
                'validation_failed',
                'Request validation failed.',
                requestId,
                [
                    {
                        path: `attachments.${index}.uploadId`,
                        message: 'uploadId is required.',
                    },
                ],
            );
        }
    }

    const idempotencyResult = await withExternalIngestIdempotency(
        {
            userId: auth.userId,
            apiKeyId: auth.apiKeyId,
            idempotencyKey: ctx.req.header('idempotency-key') ?? '',
            method: ctx.req.method,
            path: normalizeExternalPath(ctx.req.path),
            body: parsed.data,
            sourceSystem: parsed.data.sourceSystem,
            externalId: parsed.data.externalId,
            requestId,
            now: dependencies.now(),
        },
        async (record) => {
            const document = parsed.data.document;
            const transaction = parsed.data.transaction;
            const counterpartyName = parsed.data.counterparty?.name ?? null;
            const result = await ingestReceiptInvoice(
                {
                    userId: auth.userId,
                    documentKind,
                    transaction: {
                        mode: transaction.mode,
                        transactionId: transaction.transactionId ?? null,
                        date: parseIsoDate(
                            transaction.date ?? document.issueDate,
                        ),
                        amount: parseExternalDecimalToMiliunits(
                            transaction.amount ?? document.totalAmount,
                        ),
                        payee: transaction.payee ?? counterpartyName,
                        notes: buildDefaultNotes({
                            documentKind,
                            document,
                            transactionNotes: transaction.notes,
                        }),
                        accountId: transaction.accountId ?? null,
                        creditAccountId: transaction.creditAccountId ?? null,
                        debitAccountId: transaction.debitAccountId ?? null,
                        status: transaction.status ?? 'draft',
                        tagIds: transaction.tagIds,
                    },
                    matching: {
                        strategy: parsed.data.matching.strategy,
                    },
                    attachments: parsed.data.attachments.map((attachment) => ({
                        fileName: attachment.fileName,
                        fileSize: attachment.fileSize,
                        mimeType: attachment.mimeType,
                        storagePath: attachment.uploadId,
                        documentTypeId:
                            attachment.documentTypeId ??
                            document.documentTypeId ??
                            null,
                    })),
                    sourceContext: buildExternalIngestSourceContext({
                        auth,
                        sourceSystem: parsed.data.sourceSystem,
                        externalId: parsed.data.externalId,
                        ingestEventId: record.id,
                        requestId,
                    }),
                },
                dependencies.ingestionPorts,
            );

            const response = toExternalIngestResponse({
                result,
                ingestEventId: record.id,
            });

            if (
                response.body &&
                typeof response.body === 'object' &&
                'error' in response.body &&
                response.body.error &&
                typeof response.body.error === 'object' &&
                'requestId' in response.body.error
            ) {
                response.body.error.requestId = requestId;
            }

            return response;
        },
        dependencies.idempotencyStore,
    );

    return jsonSnapshot(ctx, idempotencyResult.response);
};

export const createExternalIngestRoutes = ({
    authMiddleware = createExternalApiAuthMiddleware(['ingest:write']),
    rateLimitMiddleware,
    rateLimitStore,
    idempotencyStore,
    ingestionPorts,
    uploadUrlGenerator = defaultUploadUrlGenerator,
    now = () => new Date(),
}: ExternalIngestRouteDependencies = {}) => {
    const app = new Hono();
    const resolvedRateLimitMiddleware =
        rateLimitMiddleware ??
        createExternalIngestRateLimitMiddleware({ store: rateLimitStore });

    app.use('*', authMiddleware);
    app.use('*', resolvedRateLimitMiddleware);

    app.post('/uploads', (ctx) =>
        handleUploadRequest(ctx, {
            uploadUrlGenerator,
            now,
        }),
    );
    app.post('/invoices', (ctx) =>
        handleIngestRequest({
            ctx,
            documentKind: 'invoice',
            dependencies: {
                idempotencyStore,
                ingestionPorts,
                now,
            },
        }),
    );
    app.post('/receipts', (ctx) =>
        handleIngestRequest({
            ctx,
            documentKind: 'receipt',
            dependencies: {
                idempotencyStore,
                ingestionPorts,
                now,
            },
        }),
    );

    return app;
};

export default createExternalIngestRoutes();
