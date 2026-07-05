# External Receipt and Invoice Ingestion API

This guide covers the implemented server-to-server API for submitting receipts
and invoices into Numera.

OpenAPI specification:

- [`docs/openapi/external-ingest.json`](openapi/external-ingest.json)

Base path:

```text
/api/external/v1
```

## Create an API Key

1. Open Numera.
2. Go to Settings -> Integrations -> API Keys.
3. Create a key for the external system, for example `ERP production`.
4. Copy the key when it is shown. The full key is only shown once.

External ingest keys use the `ingest:write` scope. Send the key as a bearer
token:

```http
Authorization: Bearer nn_live_...
```

## Upload Documents

Large files are uploaded directly to storage. First request an upload URL:

```bash
curl -X POST "https://app.example.com/api/external/v1/uploads" \
  -H "Authorization: Bearer $NUMERA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "invoice-2026-0001.pdf",
    "mimeType": "application/pdf",
    "fileSize": 482113
  }'
```

The response contains an `uploadUrl`, `uploadId`, expiry, and required upload
headers. Upload the file bytes to `uploadUrl`, then pass `uploadId` as an
attachment in an invoice or receipt request.

Allowed MIME types:

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/webp`
- `application/xml`
- `text/xml`

The default maximum file size is 10 MiB.

## Submit an Invoice

`POST /invoices` and `POST /receipts` use the same body shape. The endpoint path
sets whether the document is an invoice or receipt. If `document.kind` is
included, it must match the endpoint.

```bash
curl -X POST "https://app.example.com/api/external/v1/invoices" \
  -H "Authorization: Bearer $NUMERA_API_KEY" \
  -H "Idempotency-Key: invoice-2026-0001" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: erp-request-0001" \
  -d '{
    "externalId": "erp-invoice-2026-0001",
    "sourceSystem": "acme-erp",
    "document": {
      "kind": "invoice",
      "number": "2026-0001",
      "issueDate": "2026-07-05",
      "currency": "EUR",
      "totalAmount": "125.40",
      "paymentReference": "HR00 2026-0001"
    },
    "counterparty": {
      "name": "Example Supplier d.o.o.",
      "vatNumber": "HR12345678901",
      "createIfMissing": false
    },
    "transaction": {
      "mode": "createDraft",
      "payee": "Example Supplier d.o.o."
    },
    "matching": {
      "strategy": "none"
    },
    "attachments": [
      {
        "uploadId": "users/user_123/standalone/invoice-2026-0001.pdf",
        "fileName": "invoice-2026-0001.pdf",
        "mimeType": "application/pdf",
        "fileSize": 482113
      }
    ]
  }'
```

Successful create responses return `201` with stable Numera IDs:

```json
{
  "data": {
    "ingestEventId": "ing_123",
    "idempotentReplay": false,
    "outcome": "created",
    "transaction": {
      "id": "txn_123",
      "status": "draft"
    },
    "documents": [
      {
        "id": "doc_123",
        "fileName": "invoice-2026-0001.pdf",
        "mimeType": "application/pdf",
        "fileSize": 482113,
        "documentTypeId": "doctype_invoice"
      }
    ],
    "skippedDuplicateDocuments": 0
  }
}
```

## Idempotency

Invoice and receipt writes require `Idempotency-Key`.

- Retrying the same key with the same body returns the stored result and sets
  `data.idempotentReplay` to `true`.
- Reusing the same key with a different body returns `409
  idempotency_conflict`.
- Reusing the same `externalId` for the same `sourceSystem`, user, method, and
  endpoint returns the existing compatible result or `409 duplicate_external_id`
  for incompatible bodies.

Upload URL responses include signed URLs and are not stored in idempotency
records. Apply idempotency to the final `/invoices` or `/receipts` write.

## Errors

Errors use:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed.",
    "requestId": "req_123",
    "details": [
      {
        "path": "document.totalAmount",
        "message": "Expected a positive decimal amount."
      }
    ]
  }
}
```

Common status codes:

| Status | Example code | Meaning |
| --- | --- | --- |
| `400` | `invalid_request` | Malformed JSON, missing idempotency key, or endpoint/body mismatch. |
| `401` | `missing_api_key`, `invalid_api_key` | API key is missing or invalid. |
| `403` | `insufficient_scope` | API key does not include `ingest:write`. |
| `404` | `not_found` | Referenced transaction, account, or document type was not found. |
| `409` | `idempotency_conflict`, `duplicate_external_id` | Retry key or external ID conflict. |
| `413` | `file_too_large` | File exceeds the configured limit. |
| `415` | `unsupported_media_type` | File MIME type is not allowed. |
| `422` | `validation_failed` | JSON body failed field validation. |
| `429` | `rate_limited` | Per-key or per-user rate limit exceeded. |

Rate-limit responses include `Retry-After`, `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, and `X-RateLimit-Reset`.

## Generate a Client

Example TypeScript client generation with OpenAPI Generator:

```bash
npx @openapitools/openapi-generator-cli generate \
  -i docs/openapi/external-ingest.json \
  -g typescript-fetch \
  -o generated/numera-external-ingest
```

For type-only TypeScript generation:

```bash
npx openapi-typescript docs/openapi/external-ingest.json \
  -o generated/numera-external-ingest.d.ts
```

Regenerate clients after changing the OpenAPI spec.
