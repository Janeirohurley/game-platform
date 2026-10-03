CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"wallet_id" text,
	"account" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_amount_non_zero" CHECK ("ledger_entries"."amount_minor" <> 0),
	CONSTRAINT "ledger_entries_currency_format" CHECK (char_length("ledger_entries"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "provider_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"account_type" text DEFAULT 'other' NOT NULL,
	"display_name" text,
	"currency" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_accounts_type_valid" CHECK ("provider_accounts"."account_type" in ('mobile_money', 'bank', 'card', 'digital_wallet', 'other')),
	CONSTRAINT "provider_accounts_status_valid" CHECK ("provider_accounts"."status" in ('active', 'disconnected', 'expired', 'error')),
	CONSTRAINT "provider_accounts_currency_format" CHECK ("provider_accounts"."currency" is null or char_length("provider_accounts"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "provider_configs" (
	"provider" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_name" text,
	"environment" text DEFAULT 'sandbox' NOT NULL,
	"capabilities" text[],
	"supported_currencies" text[],
	"supported_countries" text[],
	"minimum_amount" bigint,
	"maximum_amount" bigint,
	"fees" jsonb,
	"configuration" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_configs_environment_valid" CHECK ("provider_configs"."environment" in ('sandbox', 'production')),
	CONSTRAINT "provider_configs_limits_ordered" CHECK ("provider_configs"."minimum_amount" is null or "provider_configs"."maximum_amount" is null or "provider_configs"."minimum_amount" <= "provider_configs"."maximum_amount"),
	CONSTRAINT "provider_configs_limits_non_negative" CHECK ("provider_configs"."minimum_amount" is null or "provider_configs"."minimum_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reconciliation_records" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"transaction_id" text,
	"provider_transaction_id" text,
	"issue_type" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"details" jsonb,
	"dedupe_key" text NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	CONSTRAINT "reconciliation_records_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "reconciliation_records_issue_valid" CHECK ("reconciliation_records"."issue_type" in ('missing_provider_transaction', 'missing_ledger_transaction', 'duplicate_transaction', 'amount_mismatch', 'currency_mismatch', 'status_mismatch', 'ledger_imbalance', 'negative_balance')),
	CONSTRAINT "reconciliation_records_severity_valid" CHECK ("reconciliation_records"."severity" in ('info', 'warning', 'critical')),
	CONSTRAINT "reconciliation_records_status_valid" CHECK ("reconciliation_records"."status" in ('open', 'acknowledged', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"currency" text NOT NULL,
	"gross_amount" bigint NOT NULL,
	"provider_fee" bigint DEFAULT 0 NOT NULL,
	"platform_fee" bigint DEFAULT 0 NOT NULL,
	"net_amount" bigint NOT NULL,
	"provider" text,
	"provider_account_id" text,
	"provider_transaction_id" text,
	"idempotency_key" text,
	"original_transaction_id" text,
	"failure_reason" text,
	"metadata" jsonb,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_transactions_currency_format" CHECK (char_length("wallet_transactions"."currency") = 3),
	CONSTRAINT "wallet_transactions_type_valid" CHECK ("wallet_transactions"."type" in ('deposit', 'withdrawal', 'payment', 'refund', 'reversal')),
	CONSTRAINT "wallet_transactions_status_valid" CHECK ("wallet_transactions"."status" in ('created', 'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded', 'reversed')),
	CONSTRAINT "wallet_transactions_gross_positive" CHECK ("wallet_transactions"."gross_amount" > 0),
	CONSTRAINT "wallet_transactions_net_positive" CHECK ("wallet_transactions"."net_amount" >= 0),
	CONSTRAINT "wallet_transactions_fees_non_negative" CHECK ("wallet_transactions"."provider_fee" >= 0 and "wallet_transactions"."platform_fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_currency_format" CHECK (char_length("wallets"."currency") = 3),
	CONSTRAINT "wallets_status_valid" CHECK ("wallets"."status" in ('active', 'frozen', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_txn_account_uq" ON "ledger_entries" USING btree ("transaction_id","account","wallet_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_wallet_time_idx" ON "ledger_entries" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_accounts_wallet_provider_account_uq" ON "provider_accounts" USING btree ("wallet_id","provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "provider_accounts_wallet_idx" ON "provider_accounts" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "provider_accounts_provider_idx" ON "provider_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "reconciliation_records_status_idx" ON "reconciliation_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reconciliation_records_provider_idx" ON "reconciliation_records" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "reconciliation_records_detected_idx" ON "reconciliation_records" USING btree ("detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_transactions_idem_uq" ON "wallet_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_transactions_provider_txn_uq" ON "wallet_transactions" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_wallet_time_idx" ON "wallet_transactions" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_status_idx" ON "wallet_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wallet_transactions_provider_idx" ON "wallet_transactions" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "wallet_transactions_created_idx" ON "wallet_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_currency_uq" ON "wallets" USING btree ("user_id","currency");--> statement-breakpoint
CREATE INDEX "wallets_user_idx" ON "wallets" USING btree ("user_id");