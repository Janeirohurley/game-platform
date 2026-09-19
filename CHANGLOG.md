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
