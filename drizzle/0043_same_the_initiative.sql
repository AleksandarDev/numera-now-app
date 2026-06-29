CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_user_id" text,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_label" text,
	"before" jsonb,
	"after" jsonb,
	"field_delta" jsonb,
	"source_metadata" jsonb,
	"request_id" text,
	"reverted_from_event_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_actor_type_check" CHECK ("audit_events"."actor_type" in ('user', 'system', 'integration')),
	CONSTRAINT "audit_events_action_check" CHECK ("audit_events"."action" in ('create', 'update', 'delete', 'restore', 'purge', 'import', 'sync', 'status_change', 'link', 'unlink', 'settings_update', 'integration_event'))
);
--> statement-breakpoint
CREATE INDEX "audit_events_userid_idx" ON "audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_actoruserid_idx" ON "audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_events_createdat_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_requestid_idx" ON "audit_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_events_revertedfromeventid_idx" ON "audit_events" USING btree ("reverted_from_event_id");