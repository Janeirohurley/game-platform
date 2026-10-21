CREATE TABLE "wallet_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"currency" text DEFAULT 'BIF' NOT NULL,
	"buy_points_per_unit" integer DEFAULT 100 NOT NULL,
	"sell_minor_per_point" integer DEFAULT 10 NOT NULL,
	"min_withdrawal_points" bigint DEFAULT 1000 NOT NULL,
	"min_stake_points" bigint DEFAULT 10 NOT NULL,
	"max_stake_points" bigint DEFAULT 100000 NOT NULL,
	"contact_instructions" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_settings_singleton" CHECK ("wallet_settings"."id" = 'default'),
	CONSTRAINT "wallet_settings_currency_format" CHECK (char_length("wallet_settings"."currency") = 3),
	CONSTRAINT "wallet_settings_buy_rate_valid" CHECK ("wallet_settings"."buy_points_per_unit" > 0 and "wallet_settings"."buy_points_per_unit" <= 1000000),
	CONSTRAINT "wallet_settings_sell_rate_valid" CHECK ("wallet_settings"."sell_minor_per_point" > 0 and "wallet_settings"."sell_minor_per_point" <= 1000000),
	CONSTRAINT "wallet_settings_min_withdrawal_positive" CHECK ("wallet_settings"."min_withdrawal_points" > 0),
	CONSTRAINT "wallet_settings_min_stake_positive" CHECK ("wallet_settings"."min_stake_points" > 0),
	CONSTRAINT "wallet_settings_max_stake_valid" CHECK ("wallet_settings"."max_stake_points" >= "wallet_settings"."min_stake_points")
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'PTS' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"user_note" text,
	"admin_note" text,
	"debit_transaction_id" text,
	"refund_transaction_id" text,
	"decided_by" text,
	"decided_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawal_requests_amount_positive" CHECK ("withdrawal_requests"."amount_minor" > 0),
	CONSTRAINT "withdrawal_requests_currency_format" CHECK (char_length("withdrawal_requests"."currency") = 3),
	CONSTRAINT "withdrawal_requests_status_valid" CHECK ("withdrawal_requests"."status" in ('pending', 'approved', 'paid', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "wallet_transactions" DROP CONSTRAINT "wallet_transactions_type_valid";--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_debit_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("debit_transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_refund_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("refund_transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "withdrawal_requests_idem_uq" ON "withdrawal_requests" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "withdrawal_requests_user_idx" ON "withdrawal_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_type_valid" CHECK ("wallet_transactions"."type" in ('deposit', 'withdrawal', 'payment', 'refund', 'reversal', 'stake', 'payout', 'adjustment'));