# Auditability Rollout

## Migration Order

Production deployments must apply the auditability migrations in this order:

1. `0043_same_the_initiative` creates `audit_events`.
2. `0044_quick_spiral` adds transaction lifecycle columns.
3. `0045_misty_sauron` adds document lifecycle columns.
4. `0046_colorful_rumiko_fujikawa` adds customer and customer IBAN lifecycle columns.

The route/UI changes depend on those columns existing first. Existing rows stay visible because lifecycle columns default to active state (`is_deleted = false` or `deleted_at is null`).

## Backfill

- Do not synthesize historical audit events for changes made before `audit_events` existed.
- Existing transactions, documents, customers, and customer IBANs remain active after migration.
- Records hard-deleted before the soft-delete migrations cannot be recovered by backfill.
- Existing document blobs are retained as-is. Blob deletion happens only through explicit document purge.

## Retention

- Keep `audit_events` for at least seven years for finance traceability.
- Keep soft-deleted transactions, documents, customers, and customer IBANs until an explicit purge path removes them.
- Keep blobs while documents are soft-deleted. Delete blobs only on explicit purge and retain the purge audit event.
- Future archival jobs may move old audit events to cold storage only if events remain queryable by user, resource, action, and date.

## Verification Matrix

| Area | Required evidence |
| --- | --- |
| Reports | Income statement, balance sheet, summary, open finances, and account balances include only `transactions.deleted_at is null`. |
| Reconciliation | Reconciliation ignores soft-deleted transactions and documents. |
| Imports and sync | Banking and Stripe sync dedupe against active and soft-deleted provider IDs. |
| Recovery | Transaction, document, customer, and IBAN restore routes write explicit restore audit events. |
| Customer revert | Customer profile and IBAN revert reject conflicts when current state no longer matches the audit event after snapshot. |
| Authorization | Audit log queries scope to `audit_events.user_id`; restore/revert routes reuse resource ownership checks. |

## Manual End-to-End Checks

Run these checks in preview before promoting:

1. Delete a transaction, confirm it leaves normal transaction lists and reports, restore it from Audit > Trash, then confirm it returns.
2. Delete a document, confirm it leaves normal document lists and reconciliation checks, restore it from Audit > Trash, then confirm the blob download still works.
3. Edit a customer profile, open the customer History tab, revert the update, then confirm a revert audit event is written.
4. Edit the same customer after an audited update, attempt to revert the older event, and confirm the UI shows the conflict response.
5. Add and delete a customer IBAN, open customer History, restore/revert the IBAN event, and confirm lookup by IBAN only uses active rows.
6. Trigger Stripe or banking sync against a provider transaction that has a soft-deleted local row and confirm it is not recreated.
7. Filter Audit by resource type, resource id, action, and source, and confirm only the signed-in user's events appear.

## Operational Notes

- `audit_events` has indexes for user, actor, action, resource, request id, revert source, and created time.
- Soft-delete metadata indexes exist on transactions, documents, customers, and customer IBANs for trash views and recovery queries.
- Audit payloads are redacted by key pattern before storage. Do not add secrets to `sourceMetadata` under non-sensitive names.
- Purge operations are destructive and must stay explicit. Do not run automated purge jobs until archival, export, and customer support requirements are defined.
