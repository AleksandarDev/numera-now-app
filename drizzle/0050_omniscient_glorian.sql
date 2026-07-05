CREATE TABLE "external_ingest_idempotency_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"api_key_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"source_system" text,
	"external_id" text,
	"request_id" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_ingest_status_check" CHECK ("external_ingest_idempotency_records"."status" in ('processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "external_ingest_idempotency_scope_idx" ON "external_ingest_idempotency_records" USING btree ("api_key_id","method","path","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "external_ingest_externalid_idx" ON "external_ingest_idempotency_records" USING btree ("user_id","source_system","external_id","method","path");--> statement-breakpoint
CREATE INDEX "external_ingest_userid_idx" ON "external_ingest_idempotency_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "external_ingest_apikeyid_idx" ON "external_ingest_idempotency_records" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "external_ingest_expiresat_idx" ON "external_ingest_idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "external_ingest_requestid_idx" ON "external_ingest_idempotency_records" USING btree ("request_id");