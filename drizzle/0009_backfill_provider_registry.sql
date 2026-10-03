-- Backfill the provider registry created in 0008 from the pre-existing
-- provider_configs rows, and seed the reference mobile-money rail.
-- Additive + idempotent: records are never dropped, only inserted or
-- re-pointed at their registry row.

-- 1. Seed the reference sandbox rail first, so the generic lift below never
--    overwrites it with a lesser "legacy registration" row (idempotent).
INSERT INTO "providers" (
  "id",
  "slug",
  "name",
  "type",
  "status",
  "description",
  "currency",
  "logo_prefix",
  "environment",
  "priority",
  "configuration",
  "created_at",
  "updated_at"
)
VALUES (
  'sandbox-momo',
  'sandbox-momo',
  'Sandbox Mobile Money',
  'MOBILE_MONEY',
  'active',
  'Reference mobile-money rail — full async lifecycle with signed webhooks, no real money.',
  'BIF',
  'sandbox',
  'sandbox',
  100,
  jsonb_build_object(
    'endpoint', 'https://sandbox.mobilemoney.example',
    'expirySeconds', 900,
    'timeoutMs', 15000,
    'webhookUrl', 'https://game-platform.example/api/wallet/webhooks/sandbox-momo'
  ),
  now(),
  now()
)
ON CONFLICT ("id") DO NOTHING;

-- 2. Lift every remaining legacy provider_configs row into the registry.
INSERT INTO "providers" (
  "id",
  "slug",
  "name",
  "type",
  "status",
  "description",
  "environment",
  "priority",
  "created_at",
  "updated_at"
)
SELECT
  "provider",
  "provider",
  COALESCE(NULLIF("display_name", ''), "provider"),
  'PAYMENT_GATEWAY',
  CASE WHEN "enabled" THEN 'active' ELSE 'disabled' END,
  'Legacy registration for provider "' || "provider" || '".',
  COALESCE("environment", 'production'),
  100,
  "created_at",
  "updated_at"
FROM "provider_configs"
ON CONFLICT ("id") DO NOTHING;

-- 3. Its effective configuration row (what listEffectiveProviders reads).
INSERT INTO "provider_configs" (
  "provider",
  "provider_id",
  "enabled",
  "display_name",
  "environment",
  "capabilities",
  "supported_currencies",
  "configuration",
  "created_at",
  "updated_at"
)
VALUES (
  'sandbox-momo',
  'sandbox-momo',
  true,
  'Sandbox Mobile Money',
  'sandbox',
  ARRAY['DEPOSIT','WITHDRAWAL','REFUND','WEBHOOK','BALANCE_CHECK','TRANSACTION_STATUS','RECONCILIATION'],
  ARRAY['BIF','RWF','TZS','KES','UGX','USD'],
  jsonb_build_object(
    'endpoint', 'https://sandbox.mobilemoney.example',
    'expirySeconds', 900,
    'timeoutMs', 15000,
    'webhookUrl', 'https://game-platform.example/api/wallet/webhooks/sandbox-momo'
  ),
  now(),
  now()
)
ON CONFLICT ("provider") DO UPDATE SET
  "provider_id" = EXCLUDED."provider_id",
  "display_name" = EXCLUDED."display_name",
  "environment" = EXCLUDED."environment",
  "capabilities" = EXCLUDED."capabilities",
  "supported_currencies" = EXCLUDED."supported_currencies",
  "configuration" = EXCLUDED."configuration",
  "updated_at" = now();

-- 4. Link every remaining legacy row to its registry row (idempotent).
UPDATE "provider_configs" AS pc
SET "provider_id" = p."id"
FROM "providers" AS p
WHERE p."slug" = pc."provider"
  AND pc."provider_id" IS DISTINCT FROM p."id";

-- 5. Its credentials row (secrets live here, never in provider_configs).
INSERT INTO "provider_credentials" (
  "provider_id",
  "webhook_secret",
  "created_at",
  "updated_at"
)
VALUES (
  'sandbox-momo',
  'sandbox-momo-webhook-secret',
  now(),
  now()
)
ON CONFLICT ("provider_id") DO NOTHING;