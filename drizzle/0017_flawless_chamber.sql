CREATE TABLE "document_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" text NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"document_type_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "reconciliation_conditions" text DEFAULT '["hasReceipt"]' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_types_userid_idx" ON "document_types" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_transactionid_idx" ON "documents" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "documents_documenttypeid_idx" ON "documents" USING btree ("document_type_id");--> statement-breakpoint
CREATE INDEX "documents_uploadedby_idx" ON "documents" USING btree ("uploaded_by");