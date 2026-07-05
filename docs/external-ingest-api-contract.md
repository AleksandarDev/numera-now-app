# External Receipts and Invoices Ingestion API Contract

Parent epic: #158

Issue: #160

## Purpose

Numera needs a stable server-to-server API for external systems that create
receipt and invoice records. The API must not require a signed-in browser
session. It must be authenticated by API key, idempotent, auditable, and
documented well enough for generated clients.

This document defines the public contract that later implementation issues
should build against.

## Current State Reviewed

The contract was checked against these existing application concepts:

- `transactions`: stores the financial record, date, payee, amount in
  miliunits, status, account fields, split fields, Stripe/GoCardless references,
  and soft-delete lifecycle metadata.
- `documents`: stores uploaded document metadata, owner, storage path,
  document type, soft-delete metadata, and optional legacy `transactionId`.
- `document_transaction_links`: supports attaching one document to multiple
  transactions without relying only on `documents.transactionId`.
- `documentTypes`: user-owned document categories such as invoice or receipt.
- `customers` and `customerIbans`: store counterparties, VAT numbers, addresses,
  and IBANs that can be matched during ingestion.
- `audit_events`: supports `actorType = "integration"` and JSON source metadata,
  which should be used for external API writes.

Existing UI routes under `app/api/[[...route]]` use Clerk session auth and are
not suitable as the external API surface. Existing invoice ZIP import logic is
browser-side orchestration and should be moved behind shared server services
before the external API is implemented.

## Base URL and Versioning

All endpoints are versioned under:

```text
/api/external/v1
```

Rules:

- Breaking changes require a new major path, for example `/api/external/v2`.
- Additive fields may be added to requests or responses in v1.
- Clients must ignore unknown response fields.
- Removed enum values, renamed fields, changed required fields, and changed
  idempotency semantics are breaking changes.
- The OpenAPI specification for this contract should live under `docs/openapi`
  when #164 is implemented.

## Authentication

External requests use API keys from #159.

```http
Authorization: Bearer nn_live_...
```

Requirements:

- API keys are scoped to one Numera user.
- Write endpoints require the `ingest:write` scope.
- The authenticated route context must expose `userId`, `apiKeyId`, scopes, and
  key metadata needed for audit and rate limiting.
- Plaintext API keys must never be stored or written to audit metadata.

## Common Headers

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Bearer API key. |
| `Idempotency-Key` | Yes for write endpoints | Unique key for safe retries, scoped to API key, method, and path. |
| `Content-Type` | Yes | `application/json` for API requests. Azure upload URLs use the file MIME type. |
| `X-Request-Id` | No | Caller-provided request ID for audit and support correlation. |
| `User-Agent` | Recommended | Caller application identity. |

## Resource Model

The API exposes separate receipt and invoice write endpoints because those are
the integration concepts external systems understand. Internally both endpoints
feed the same ingestion service.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/external/v1/uploads` | Create a short-lived upload URL for a document file. |
| `POST /api/external/v1/invoices` | Ingest one invoice and optional uploaded files. |
| `POST /api/external/v1/receipts` | Ingest one receipt and optional uploaded files. |
| `GET /api/external/v1/ingest-events/{id}` | Fetch the status/result of a prior ingest request. |

Bulk ingestion is intentionally out of scope for v1. Callers should submit one
receipt or invoice per request so idempotency and audit records stay precise.

## Upload Flow

Large files should not be proxied through the application server. v1 uses a
two-step upload flow that mirrors the existing Azure blob upload pattern.

1. The external client calls `POST /uploads` with file metadata.
2. Numera returns an upload URL and an `uploadId`.
3. The client uploads the file bytes directly to the returned URL.
4. The client references `uploadId` from `POST /invoices` or `POST /receipts`.

### Create Upload

```http
POST /api/external/v1/uploads
Authorization: Bearer nn_live_...
Idempotency-Key: upload-2026-0001
Content-Type: application/json
```

```json
{
  "fileName": "invoice-2026-0001.pdf",
  "mimeType": "application/pdf",
  "fileSize": 482113,
  "sha256": "optional-lowercase-hex-digest"
}
```

Response:

```json
{
  "data": {
    "uploadId": "upl_01JZ...",
    "uploadUrl": "https://storage.example/signed-url",
    "expiresAt": "2026-07-05T10:30:00.000Z",
    "requiredHeaders": {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": "application/pdf"
    }
  }
}
```

The final ingest endpoint must verify that each `uploadId` belongs to the
authenticated user/API key, is not expired, and has not already been consumed by
an incompatible request.

## Ingest Invoice or Receipt

`POST /invoices` and `POST /receipts` use the same schema. The endpoint path
sets `document.kind` to `invoice` or `receipt`; callers may also include the
same value in the body for client-side clarity.

### Request Body

```json
{
  "externalId": "erp-invoice-2026-0001",
  "sourceSystem": "acme-erp",
  "document": {
    "kind": "invoice",
    "documentTypeId": "optional-numera-document-type-id",
    "number": "2026-0001",
    "issueDate": "2026-07-05",
    "dueDate": "2026-07-20",
    "currency": "EUR",
    "totalAmount": "125.40",
    "taxAmount": "25.08",
    "netAmount": "100.32",
    "paymentReference": "HR00 2026-0001",
    "notes": "Optional external note"
  },
  "counterparty": {
    "name": "Example Supplier d.o.o.",
    "vatNumber": "HR12345678901",
    "iban": "HR1210010051863000160",
    "address": "Ulica 1, Zagreb",
    "country": "HR",
    "externalId": "supplier-123",
    "createIfMissing": false
  },
  "transaction": {
    "mode": "createDraft",
    "transactionId": null,
    "date": "2026-07-05",
    "amount": "125.40",
    "payee": "Example Supplier d.o.o.",
    "notes": "Invoice #2026-0001",
    "accountId": null,
    "creditAccountId": null,
    "debitAccountId": null,
    "tagIds": []
  },
  "matching": {
    "strategy": "none"
  },
  "attachments": [
    {
      "uploadId": "upl_01JZ...",
      "fileName": "invoice-2026-0001.pdf",
      "mimeType": "application/pdf",
      "fileSize": 482113,
      "sha256": "optional-lowercase-hex-digest"
    }
  ]
}
```

### Required Fields

| Field | Required | Notes |
| --- | --- | --- |
| `externalId` | Yes | Unique within `sourceSystem`, authenticated user, and document kind. |
| `sourceSystem` | Yes | Stable integration/source name. |
| `document.issueDate` | Yes | ISO date. |
| `document.totalAmount` | Yes | Decimal string in major currency units. |
| `transaction.mode` | Yes | See transaction behavior. |
| `attachments` | No | Metadata-only ingestion is allowed, but attached evidence is recommended. |

Amounts are decimal strings in the public API. The server converts them to
integer miliunits before writing `transactions.amount`.

### Transaction Behavior

`transaction.mode` controls how the ingest maps to financial records:

| Mode | Behavior |
| --- | --- |
| `createDraft` | Always create a new draft transaction and attach documents. This is the default recommendation. |
| `attachToExisting` | Require `transaction.transactionId`; only attach documents and update notes/source metadata if the transaction belongs to the authenticated user. |
| `matchOrCreateDraft` | Try to match an existing non-deleted draft/pending transaction by configured strategy. If no match is found, create a draft transaction. |

Allowed `matching.strategy` values:

- `none`: no matching.
- `dateAmountCounterparty`: match by date, amount, and counterparty name/VAT/IBAN.
- `externalId`: match a prior ingest record with the same `externalId`.

Completed or reconciled transactions must not have financial fields changed by
external ingestion. If matching finds a completed or reconciled transaction, v1
may attach documents but must not change amount, date, accounts, or status.

### Accounting Defaults

Callers may omit account fields. If omitted, Numera creates a draft transaction
with missing account assignments for later review.

Validation must follow existing app rules:

- Closed accounting periods reject transaction creation or financial edits.
- Read-only accounts cannot be used by external ingest.
- In double-entry mode, non-draft transactions require both credit and debit
  accounts. v1 should create drafts unless the contract later allows status
  promotion.
- `accountId` is mutually exclusive with `creditAccountId`/`debitAccountId`.
- Tags must belong to the authenticated user.

### Counterparty Mapping

Counterparty data maps to `customers` and `customerIbans`:

- `name` maps to `customers.name`.
- `vatNumber` maps to `customers.vatNumber`.
- `address` and `country` map to matching customer fields.
- `iban` maps to `customerIbans.iban`.
- `externalId` should be stored in ingestion metadata until a dedicated external
  customer mapping table exists.

Default behavior is conservative: match existing customers where possible, but
do not auto-create customers unless `createIfMissing` is true.

### Document Mapping

Attachments map to `documents`:

- `fileName`, `fileSize`, and `mimeType` map directly.
- `uploadId` resolves to a verified `storagePath`.
- `documentTypeId`, when provided, must belong to the authenticated user.
- If `documentTypeId` is omitted, the ingestion service should try the existing
  document categorization logic and prefer user document types whose names match
  invoice or receipt.
- Every attached document should be linked through `document_transaction_links`;
  `documents.transactionId` may be set for legacy compatibility.

## Response Model

Successful create response:

```json
{
  "data": {
    "ingestEventId": "ing_01JZ...",
    "idempotentReplay": false,
    "outcome": "created",
    "transaction": {
      "id": "txn_01JZ...",
      "status": "draft"
    },
    "documents": [
      {
        "id": "doc_01JZ...",
        "fileName": "invoice-2026-0001.pdf"
      }
    ],
    "customer": {
      "id": "cus_01JZ...",
      "matched": true,
      "created": false
    }
  }
}
```

Allowed `outcome` values:

- `created`
- `updated`
- `attached`
- `duplicate`
- `rejected`

Idempotent replays should return the original response body with
`idempotentReplay: true`.

## Error Model

All errors use the same JSON shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed.",
    "requestId": "req_...",
    "details": [
      {
        "path": "document.totalAmount",
        "message": "Expected a positive decimal amount."
      }
    ]
  }
}
```

Standard status codes:

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_request` | Malformed JSON, missing headers, or unsupported mode. |
| `401` | `unauthorized` | Missing, malformed, revoked, or expired API key. |
| `403` | `forbidden` | API key lacks required scope or resource ownership fails. |
| `404` | `not_found` | Referenced transaction, document type, upload, account, or tag was not found. |
| `409` | `idempotency_conflict` | Same idempotency key used with a different request fingerprint. |
| `409` | `duplicate_external_id` | Different idempotency key attempts to create an already ingested external document. |
| `413` | `file_too_large` | File exceeds configured limit. |
| `415` | `unsupported_media_type` | File MIME type is not allowed. |
| `422` | `validation_failed` | Semantically invalid request. |
| `429` | `rate_limited` | Per-key or per-user rate limit exceeded. |
| `500` | `internal_error` | Unexpected server failure. |

## Idempotency and Duplicate Handling

Write endpoints require `Idempotency-Key`.

Semantics:

- The key is scoped to authenticated API key, HTTP method, and endpoint path.
- The server stores a request fingerprint and the final response summary.
- Retrying the same key with the same request returns the original result.
- Retrying the same key with a different request returns `409 idempotency_conflict`.
- `externalId` prevents duplicate business documents across different
  idempotency keys. If the same `externalId` is submitted again for the same
  `sourceSystem`, authenticated user, and document kind, the API should return
  the existing ingest result or `409 duplicate_external_id` depending on whether
  the payload is compatible.

Retention for idempotency records is implemented in #163. The contract requires
retention long enough for normal external retry windows and support debugging.

## Audit and Source Tracking

Every successful external ingest mutation must write audit events with:

- `actorType: "integration"`
- `actorUserId`: the authenticated user ID, unless a future integration actor ID
  is added.
- `resourceType`: `transaction`, `document`, or `customer`.
- `action`: `create`, `update`, `link`, or `integration_event` as appropriate.
- `sourceMetadata.source`: `external_api`
- `sourceMetadata.apiKeyId`
- `sourceMetadata.sourceSystem`
- `sourceMetadata.externalId`
- `sourceMetadata.ingestEventId`
- `sourceMetadata.requestId`, if provided or generated

Audit metadata must not include plaintext API keys, signed upload URLs, file
contents, or full request bodies.

## Rate Limiting

External ingest must be rate-limited by API key or authenticated user, not only
by IP address. Rate-limit responses should include:

```http
Retry-After: 60
```

and the standard error body with `code: "rate_limited"`.

## Curl Example

```bash
curl -X POST "https://app.example.com/api/external/v1/invoices" \
  -H "Authorization: Bearer nn_live_example" \
  -H "Idempotency-Key: invoice-2026-0001" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "erp-invoice-2026-0001",
    "sourceSystem": "acme-erp",
    "document": {
      "kind": "invoice",
      "number": "2026-0001",
      "issueDate": "2026-07-05",
      "currency": "EUR",
      "totalAmount": "125.40"
    },
    "counterparty": {
      "name": "Example Supplier d.o.o.",
      "vatNumber": "HR12345678901",
      "createIfMissing": false
    },
    "transaction": {
      "mode": "createDraft",
      "date": "2026-07-05",
      "amount": "125.40",
      "payee": "Example Supplier d.o.o.",
      "tagIds": []
    },
    "matching": {
      "strategy": "none"
    },
    "attachments": []
  }'
```

## Implementation Notes for Follow-Up Issues

- #159 provides API key creation, storage, and validation.
- #161 should move invoice/receipt ingestion into shared server services before
  route implementation duplicates browser logic.
- #163 provides idempotency persistence, source tracking, audit metadata, and
  rate limiting.
- #162 implements these versioned routes.
- #164 publishes the machine-readable OpenAPI specification and generated client
  guidance based on the final route implementation.
