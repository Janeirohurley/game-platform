ALTER TABLE "bot" ADD COLUMN "mode" text DEFAULT 'pool' NOT NULL;--> statement-breakpoint
ALTER TABLE "bot" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "bot" ADD COLUMN "config" jsonb;--> statement-breakpoint
ALTER TABLE "bot" ADD COLUMN "created_by_admin_id" text;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_created_by_admin_id_user_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_mode_valid" CHECK ("bot"."mode" in ('pool', 'attached'));