CREATE TABLE "match_stake_holds" (
	"match_stake_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"transaction_id" text,
	"status" text DEFAULT 'held' NOT NULL,
	CONSTRAINT "match_stake_holds_match_stake_id_user_id_pk" PRIMARY KEY("match_stake_id","user_id"),
	CONSTRAINT "match_stake_holds_amount_positive" CHECK ("match_stake_holds"."amount_minor" > 0),
	CONSTRAINT "match_stake_holds_status_valid" CHECK ("match_stake_holds"."status" in ('held', 'released', 'forfeited', 'paid'))
);
--> statement-breakpoint
CREATE TABLE "match_stakes" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"game_id" text NOT NULL,
	"currency" text NOT NULL,
	"stake_minor" bigint NOT NULL,
	"rake_bps" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"winner_user_id" text,
	"pot_minor" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_stakes_game_id_valid" CHECK ("match_stakes"."game_id" in ('ludo', 'checkers', 'rally', 'tetris')),
	CONSTRAINT "match_stakes_currency_format" CHECK (char_length("match_stakes"."currency") = 3),
	CONSTRAINT "match_stakes_stake_positive" CHECK ("match_stakes"."stake_minor" > 0),
	CONSTRAINT "match_stakes_pot_non_negative" CHECK ("match_stakes"."pot_minor" >= 0),
	CONSTRAINT "match_stakes_rake_bps_valid" CHECK ("match_stakes"."rake_bps" >= 0 and "match_stakes"."rake_bps" <= 10000),
	CONSTRAINT "match_stakes_status_valid" CHECK ("match_stakes"."status" in ('open', 'funded', 'playing', 'settled', 'void'))
);
--> statement-breakpoint
ALTER TABLE "match_stake_holds" ADD CONSTRAINT "match_stake_holds_match_stake_id_match_stakes_id_fk" FOREIGN KEY ("match_stake_id") REFERENCES "public"."match_stakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stake_holds" ADD CONSTRAINT "match_stake_holds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stake_holds" ADD CONSTRAINT "match_stake_holds_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_stake_holds_user_id_idx" ON "match_stake_holds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_stake_holds_status_idx" ON "match_stake_holds" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "match_stakes_room_id_uq" ON "match_stakes" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "match_stakes_status_idx" ON "match_stakes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "match_stakes_game_id_idx" ON "match_stakes" USING btree ("game_id");