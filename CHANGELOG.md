# Changelog

All notable changes to Game Arena are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning where applicable.

## [0.5.1] - 2026-10-10

### Fixed

* Marked the room as reconnecting on a temporary Colyseus transport drop and
  as synchronizing after reconnection, before returning to the connected state.

## [0.5.0] - 2026-10-10

### Added

* Added stable join-request identifiers and authoritative registration feedback.
* Added reconnect synchronization, bounded retry with exponential backoff and
  explicit pending/accepted/rejected/expired feedback.
* Preserved pending host notifications after temporary requester or host
  disconnections.

### Fixed

* Prevented duplicate join requests when an acknowledgment is lost.
* Correlated host decisions with the request identifier and resumed direct
  match-screen submissions after reconnection.
* Pinned Hugeicons to the Linux-compatible case-sensitive import fix.

## [0.4.0] - 2026-10-10

### Added

#### Ludo scene

* Added a dedicated 3D game scene with a wood table, directional and spot lighting, fog, contact shadows and a subtle dust effect.
* Added deterministic wood and floor textures for a consistent visual result across renders.
* Added `FlatMaterial` for board surfaces so theme colors are rendered without unwanted lighting, fog or tone-mapping shifts.

### Changed

#### Ludo board rendering

* Replaced the debug grid and cut-out arena floor with the new table scene in local and online Ludo games.
* Improved four-player and six-player board proportions, hexagonal base geometry, center hub sizing and board edge rendering.
* Updated home areas, playing tracks, safe-zone stars and directional arrows to match the reference board layouts more precisely.
* Kept the board colors faithful to the visual theme while preserving illuminated materials for pieces and scene props.

### Fixed

* Corrected track coordinates and position calculations for square and hexagonal boards.
* Removed thin GL edge lines that could flicker and replaced them with solid geometric borders.

### Tests

* Updated track and hex-track tests to cover the corrected geometry and positions.

## [0.1.0] - 2026-09-20

### Added

#### Application foundation

* Initialized the Game Arena frontend architecture.
* Added Next.js application structure with TypeScript.
* Added Bun-based development workflow.
* Added Tailwind CSS styling system.
* Added light and dark theme support with `next-themes`.
* Added responsive application navigation.

#### Pages

* Added landing page.
* Added games discovery page.
* Added how-it-works page.
* Added community page.
* Added sign-in page.
* Added sign-up page.
* Added forgot-password page.
* Added reset-password page.
* Added email verification page.
* Added terms page.
* Added privacy page.

#### Games experience

* Added game discovery interface.
* Added game search interface.
* Added game category filtering.
* Added live player indicators.
* Added reusable game presentation structure.

#### Community experience

* Added online player section.
* Added recent activity section.
* Added community discovery section.
* Added social links section.
* Added editorial-style community layout.

#### Realtime workflow

* Added matchmaking workflow visualization.
* Added React Flow integration.
* Added game selection node.
* Added matchmaking node.
* Added player-found state.
* Added realtime-match state.
* Added waiting/searching states.
* Added interactive workflow connections.

#### Three.js

* Added reusable Three.js dice component.
* Added reusable controller viewer.
* Added reusable portrait viewer.
* Added particle-based game universe background.
* Added configurable 3D lighting and camera systems.
* Added interactive camera rotation and zoom where applicable.
* Added theme-aware visual behavior.

#### UI system

* Added Hugeicons integration.
* Added reusable navigation components.
* Added reusable legal page layout.
* Added responsive layouts for desktop and mobile.
* Added product-focused typography and spacing system.

### Changed

* Established the initial Game Arena visual language.
* Adopted a restrained editorial approach for community and content-heavy sections.
* Reduced dependency on excessive cards, shadows and glassmorphism.
* Established 3D objects as visual accents instead of decorative full-page backgrounds.

### Technical

* Migrated Three.js components to modern APIs.
* Added TypeScript typings for reusable 3D component configuration.
* Added reusable configuration for controller colors and animation palettes.
* Structured React Flow as a dynamic node-based workflow instead of manually calculated SVG connections.
* Added cleanup handling for Three.js resources and event listeners.

### Notes

This release represents the initial frontend foundation of Game Arena.

Authentication, realtime matchmaking, game servers, persistent player data and production infrastructure are not yet connected.

## [0.2.0] - 2026-09-21

### Added

#### Authentication backend

* Added Better Auth backend with email and password authentication.
* Added Drizzle-based database adapter for authentication records.
* Added database schema for auth users and profiles.
* Added session management with configurable expiry.
* Added server-side session user lookup.

#### Authentication UI

* Moved authentication pages under `(auth)` route group.
* Added sign-in page wired to the auth client.
* Added sign-up page wired to the auth client.
* Added forgot-password page.
* Added reset-password page.
* Added email verification page.
* Added auth provider and session state to the client.

#### Password recovery

* Added password reset request flow.
* Added password reset confirmation flow.
* Added transactional emails for password reset.

#### Email verification

* Added email verification on sign-up.
* Added email verification on sign-in.
* Added auto sign-in after email verification.
* Added transactional email for verification.

#### User menu and navigation

* Added authenticated user menu.
* Added sign-out action in the user menu.
* Updated navbar to reflect authenticated state.

#### Protected routes

* Added `(protected)` route group layout.
* Added profile page with server actions.
* Added profile page client component for interactive edits.

#### API

* Added `/api/auth/[...all]` route handler for Better Auth.

#### Email templates

* Added React Email layout components.
* Added verification email template.
* Added password reset email template.
* Added shared email button component.

#### Games engine

* Added Ludo game engine modules.
* Added board, dice, movement, rules and reducer logic.
* Added engine configuration and shared types.

### Changed

* Adopted Better Auth as the authentication library.
* Replaced standalone authentication pages with route-group layout.
* Moved page routes into `(public)`, `(auth)` and `(protected)` route groups.
* Updated project architecture around server-driven authentication and profiles.

### Technical

* Added Drizzle schema and migrations for auth tables.
* Added database connection and schema module.
* Added validation schemas for auth operations.
* Added database connection test script.
* Added proxy configuration for local development.
* Updated package dependencies for auth and email tooling.
* Updated Tailwind and linting tooling versions.

## [0.3.0] - 2026-10-03

### Added

#### Multi-asset provider system

* Added universal multi-asset wallet provider system with administrator-managed providers
* Added new database tables: `providers`, `provider_assets`, `provider_credentials`
* Extended `provider_configs` with nullable columns and CHECK constraints
* Added provider registry with effective-config wiring (`listEffectiveProviders`, `getEffectiveProvider`, `toEffective`)
* Added admin control-plane CRUD for providers, assets, and credentials
* Added audited server actions: `createProviderAction`, `updateProviderAction`, `activateProviderAction`, `deactivateProviderAction`, `archiveProviderAction`, `testConnectionAction`
* Added API routes `/api/providers/*` for provider management
* Added Drizzle migrations `0008_add_provider_registry.sql` and `0009_backfill_provider_registry.sql`

#### Wallet UI

* Added new wallet panels: `add-money-panel.tsx`, `withdraw-panel.tsx`, `transactions-table.tsx`, `transaction-detail-dialog.tsx`
* Updated wallet page client component for multi-asset providers
* Added wallet link to navbar for authenticated users
* Added loading spinner for wallet operations

#### UI Components

* Updated navbar user section: replaced username with clickable avatar
* Added avatar click to navigate to user profile page
* Added logout icon with spinner loading state
* Added logout duplicate click prevention and button disable
* Added new loading components: `refresh-overlay.tsx`, `shimmer.tsx`, `skeletons.tsx`
* Added loading states for admin pages and protected pages

#### Database

* Added provider registry tables (`providers`, `provider_assets`, `provider_credentials`)
* Extended `provider_configs` table with nullable columns and CHECK constraints
* Updated drizzle journal to include migrations 0008 and 0009
* Applied database migrations to Drizzle metadata

### Changed

* Replaced legacy single-adapter `provider_configs` pattern with universal multi-asset provider system
* Extended admin control plane with provider management and CRUD operations
* Updated wallet UI components for multi-asset support

### Technical

* Fixed wallet money parsing (`parseMajorToMinor`) to resolve test failures
* Cleaned up unused code in `provider-config.ts` (dead imports, unused variables)
* Removed unnecessary slug registry queries from `listEffectiveProviders`
* Fixed TypeScript compilation errors in `provider-config.ts` (5-argument `toEffective` calls)
* Verified database schema with `drizzle-kit check` — all migrations valid
* Ran TypeScript typecheck — 0 errors

### Notes

The provider registry migrations (`0008`/`0009`) are applied to the schema files and Drizzle journal, but the tables are not yet visible in the reachable Supabase pooler database (which only contains the `account` table). The Drizzle schema files are valid and the migrations are ready for deployment to the target database. The multi-asset provider system is fully implemented in the codebase and ready for the next phase: admin provider management UI and backend API integration.
