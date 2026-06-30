CREATE TABLE "document_transaction_links" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_transaction_links" ADD CONSTRAINT "document_transaction_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_transaction_links" ADD CONSTRAINT "document_transaction_links_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_transaction_links_unique_idx" ON "document_transaction_links" USING btree ("document_id","transaction_id");--> statement-breakpoint
CREATE INDEX "document_transaction_links_documentid_idx" ON "document_transaction_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_transaction_links_transactionid_idx" ON "document_transaction_links" USING btree ("transaction_id");--> statement-breakpoint
INSERT INTO "document_transaction_links" ("id", "document_id", "transaction_id", "created_at")
SELECT
	'legacy_' || "id" || '_' || "transaction_id",
	"id",
	"transaction_id",
	"uploaded_at"
FROM "documents"
WHERE "transaction_id" IS NOT NULL
ON CONFLICT ("document_id", "transaction_id") DO NOTHING;
