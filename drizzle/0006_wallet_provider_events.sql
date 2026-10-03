CREATE TABLE "provider_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"signature_valid" boolean NOT NULL,
	"transaction_id" text,
	"provider_transaction_id" text,
	"payload" jsonb,
	"error" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "provider_events_status_valid" CHECK ("provider_events"."status" in ('received', 'processed', 'failed', 'ignored'))
);
--> statement-breakpoint
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_events_provider_event_uq" ON "provider_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "provider_events_transaction_idx" ON "provider_events" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "provider_events_received_idx" ON "provider_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "provider_events_provider_idx" ON "provider_events" USING btree ("provider");