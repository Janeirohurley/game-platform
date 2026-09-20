# Changelog

All notable changes to Game Arena are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning where applicable.

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
