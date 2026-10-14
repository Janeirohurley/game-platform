ALTER TABLE "achievements" DROP CONSTRAINT "achievements_game_id_valid";--> statement-breakpoint
ALTER TABLE "game_matches" DROP CONSTRAINT "game_matches_game_id_valid";--> statement-breakpoint
ALTER TABLE "game_stats" DROP CONSTRAINT "game_stats_game_id_valid";--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_game_id_valid" CHECK ("achievements"."game_id" is null or "achievements"."game_id" in ('ludo', 'checkers', 'rally', 'tetris'));--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_game_id_valid" CHECK ("game_matches"."game_id" in ('ludo', 'checkers', 'rally', 'tetris'));--> statement-breakpoint
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_game_id_valid" CHECK ("game_stats"."game_id" in ('ludo', 'checkers', 'rally', 'tetris'));