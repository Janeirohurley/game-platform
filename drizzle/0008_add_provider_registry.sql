-- Providers registry (admin CRUD): `providers` (slug/type/status/logo/
-- priority/configuration), `provider_assets` (asset x network x contract x
-- decimals x tokenStandard), `provider_credentials` (secrets, never listed),
-- + the `provider_id` FK on the legacy `provider_configs` rows.
-- Purely additive: no existing financial data is touched or dropped.
CREATE TABLE "provider_assets" (
	"provider_id" text NOT NULL,
	"asset" text NOT NULL,
	"network" text,
	"chain_id" text,
	"contract_address" text,
	"decimals" integer,
	"token_standard" text,
	"supported" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_assets_token_standard_valid" CHECK ("provider_assets"."token_standard" is null or "provider_assets"."token_standard" in ('ERC-20', 'TRC-20', 'BEAM', 'ERC-721', 'ERC-1155'))
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"provider_id" text PRIMARY KEY NOT NULL,
	"api_key" text,
	"api_secret" text,
	"private_token" text,
	"webhook_secret" text,
	"client_secret" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_credentials_type_valid" CHECK ("provider_credentials"."provider_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'PAYMENT_GATEWAY' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text,
	"currency" text,
	"logo_prefix" text,
	"environment" text DEFAULT 'production' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"configuration" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "providers_slug_unique" UNIQUE("slug"),
	CONSTRAINT "providers_type_valid" CHECK ("providers"."type" in ('PAYMENT_GATEWAY', 'MOBILE_MONEY', 'BANK', 'CARD', 'EXCHANGE', 'BLOCKCHAIN', 'CRYPTO_CUSTODY', 'CRYPTO_PAYMENT', 'CUSTOM')),
	CONSTRAINT "providers_status_valid" CHECK ("providers"."status" in ('active', 'inactive', 'disabled')),
	CONSTRAINT "providers_environment_valid" CHECK ("providers"."environment" in ('sandbox', 'production'))
);
--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "supported_operations" text[];--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "blockchain_network" text;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "blockchain_chain_id" text;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "blockchain_contract_address" text;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "blockchain_decimals" integer;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "blockchain_token_standard" text;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "provider_accounts" text[];--> statement-breakpoint
ALTER TABLE "provider_assets" ADD CONSTRAINT "provider_assets_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_assets_provider_asset_network_chain_contract_uq" ON "provider_assets" USING btree ("provider_id","asset","network","chain_id","contract_address");--> statement-breakpoint
CREATE INDEX "provider_assets_provider_idx" ON "provider_assets" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "provider_assets_asset_idx" ON "provider_assets" USING btree ("asset");--> statement-breakpoint
CREATE INDEX "provider_assets_supported_idx" ON "provider_assets" USING btree ("supported");--> statement-breakpoint
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_blockchain_chain_id_format" CHECK ("provider_configs"."blockchain_chain_id" is null or "provider_configs"."blockchain_chain_id" ~ '^[0-9]+$');--> statement-breakpoint
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_blockchain_decimals_non_negative" CHECK ("provider_configs"."blockchain_decimals" is null or "provider_configs"."blockchain_decimals" >= 0);