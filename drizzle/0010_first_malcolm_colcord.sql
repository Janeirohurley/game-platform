CREATE TABLE "bot" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"game_id" text NOT NULL,
	"difficulty" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"lease_room_id" text,
	"leased_at" timestamp,
	"origin" text DEFAULT 'generated' NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_game_id_valid" CHECK ("bot"."game_id" in ('ludo', 'checkers', 'rally')),
	CONSTRAINT "bot_difficulty_valid" CHECK ("bot"."difficulty" in ('easy', 'normal', 'hard')),
	CONSTRAINT "bot_status_valid" CHECK ("bot"."status" in ('idle', 'in_match', 'disabled')),
	CONSTRAINT "bot_lease_consistent" CHECK (("bot"."lease_room_id" is null and "bot"."leased_at" is null) or ("bot"."lease_room_id" is not null and "bot"."leased_at" is not null)),
	CONSTRAINT "bot_status_lease_consistent" CHECK (("bot"."status" = 'in_match' and "bot"."lease_room_id" is not null) or ("bot"."status" <> 'in_match' and "bot"."lease_room_id" is null))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_user_uq" ON "bot" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bot_pool_idx" ON "bot" USING btree ("game_id","status");--> statement-breakpoint
CREATE INDEX "bot_lease_idx" ON "bot" USING btree ("lease_room_id");