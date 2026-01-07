CREATE INDEX "accounts_isopen_idx" ON "accounts" USING btree ("is_open");--> statement-breakpoint
CREATE INDEX "accounts_code_idx" ON "accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "categories_userid_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_iscomplete_idx" ON "customers" USING btree ("is_complete");--> statement-breakpoint
CREATE INDEX "document_types_isrequired_idx" ON "document_types" USING btree ("is_required");--> statement-breakpoint
CREATE INDEX "document_types_name_idx" ON "document_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "documents_isdeleted_idx" ON "documents" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "transactions_splittype_idx" ON "transactions" USING btree ("split_type");