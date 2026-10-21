ALTER TABLE "provider_assets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provider_configs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provider_credentials" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "providers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provider_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provider_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reconciliation_records" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "provider_assets" CASCADE;--> statement-breakpoint
DROP TABLE "provider_configs" CASCADE;--> statement-breakpoint
DROP TABLE "provider_credentials" CASCADE;--> statement-breakpoint
DROP TABLE "providers" CASCADE;--> statement-breakpoint
DROP TABLE "provider_accounts" CASCADE;--> statement-breakpoint
DROP TABLE "provider_events" CASCADE;--> statement-breakpoint
DROP TABLE "reconciliation_records" CASCADE;--> statement-breakpoint
DROP INDEX "wallet_transactions_provider_txn_uq";--> statement-breakpoint
DROP INDEX "wallet_transactions_provider_idx";--> statement-breakpoint
ALTER TABLE "wallet_transactions" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "wallet_transactions" DROP COLUMN "provider_account_id";--> statement-breakpoint
ALTER TABLE "wallet_transactions" DROP COLUMN "provider_transaction_id";