CREATE TABLE "achievements" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT '★' NOT NULL,
	"game_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_game_id_valid" CHECK ("achievements"."game_id" is null or "achievements"."game_id" in ('ludo', 'checkers', 'rally'))
);
--> statement-breakpoint
CREATE TABLE "game_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"game_id" text NOT NULL,
	"seat" integer DEFAULT 0 NOT NULL,
	"outcome" text NOT NULL,
	"rating_before" integer DEFAULT 0 NOT NULL,
	"rating_after" integer DEFAULT 0 NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"player_count" integer DEFAULT 0 NOT NULL,
	"opponent_ids" jsonb,
	"played_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_matches_game_id_valid" CHECK ("game_matches"."game_id" in ('ludo', 'checkers', 'rally')),
	CONSTRAINT "game_matches_outcome_valid" CHECK ("game_matches"."outcome" in ('win', 'loss', 'draw'))
);
--> statement-breakpoint
CREATE TABLE "game_stats" (
	"user_id" text NOT NULL,
	"game_id" text NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"rating" integer DEFAULT 1200 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"total_play_seconds" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_stats_game_id_valid" CHECK ("game_stats"."game_id" in ('ludo', 'checkers', 'rally')),
	CONSTRAINT "game_stats_counts_non_negative" CHECK ("game_stats"."games_played" >= 0 and "game_stats"."wins" >= 0 and "game_stats"."losses" >= 0 and "game_stats"."draws" >= 0),
	CONSTRAINT "game_stats_rating_positive" CHECK ("game_stats"."rating" >= 100)
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "previous_username" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "username_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "languages" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "favorite_games" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "private_visits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "rating" integer DEFAULT 1200 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "games_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "wins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "losses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "draws" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "current_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "best_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "total_play_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "last_played_at" timestamp;--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_code_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_matches_room_user_uq" ON "game_matches" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "game_matches_user_time_idx" ON "game_matches" USING btree ("user_id","played_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_stats_user_game_uq" ON "game_stats" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "user_achievements_user_idx" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_level_idx" ON "profiles" USING btree ("level");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_level_positive" CHECK ("profiles"."level" >= 1);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_xp_non_negative" CHECK ("profiles"."xp" >= 0);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_counts_non_negative" CHECK ("profiles"."games_played" >= 0 and "profiles"."wins" >= 0 and "profiles"."losses" >= 0 and "profiles"."draws" >= 0);