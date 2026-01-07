DROP INDEX "document_types_isrequired_idx";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "required_document_type_ids" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_types" DROP COLUMN "is_required";