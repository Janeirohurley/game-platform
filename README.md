# Game Arena

Game Arena is a modern multiplayer gaming platform built around realtime game discovery, matchmaking, communities and interactive game experiences.

The project focuses on a polished, responsive interface combining modern web technologies with lightweight 3D experiences.

## Overview

Game Arena provides the foundation for a multiplayer gaming platform where players can:

* Discover available games
* Join realtime multiplayer matches
* Meet and interact with other players
* Explore gaming communities
* Follow matchmaking and game workflows
* Access authentication and account flows
* Experience interactive 3D elements throughout the platform

The current version establishes the product interface and technical foundation. Realtime backend services, persistent authentication and production matchmaking are planned for later iterations.

## Tech Stack

### Core

* Next.js 16
* React
* TypeScript
* Bun
* Tailwind CSS
* Three.js

### UI

* shadcn/ui
* Hugeicons
* `next-themes`
* Responsive layouts
* Dark and light theme support

### Visual and interaction

* Three.js procedural 3D objects
* React Flow
* Interactive matchmaking workflow
* Particle-based background environment
* Custom animations and transitions

## Project Structure

```text
src/
├── app/
│   ├── community/
│   ├── forgot-password/
│   ├── games/
│   ├── how-it-works/
│   ├── privacy/
│   ├── reset-password/
│   ├── sign-in/
│   ├── sign-up/
│   ├── terms/
│   ├── verify-email/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── controller-viewer.tsx
│   ├── dice.tsx
│   ├── game-universe-background.tsx
│   ├── legal-page.tsx
│   ├── match-workflow.tsx
│   ├── navbar.tsx
│   └── portrait-viewer.tsx
│
└── lib/
    └── controller-config.ts
```

The structure is intentionally component-oriented so that visual systems, game objects and page-level experiences remain reusable.

## Main Experiences

### Home

The landing page introduces Game Arena and establishes the visual identity of the platform with interactive 3D elements and a realtime gaming atmosphere.

### Games

The games catalog allows players to browse available games using search and category filters.

The current interface includes:

* Game discovery
* Categories
* Search
* Game cards
* Live player indicators
* Interactive 3D dice

### How It Works

The workflow page explains the multiplayer process from game selection to matchmaking and realtime gameplay.

The matchmaking visualization is implemented with React Flow so that workflow nodes and connections can evolve dynamically rather than relying on manually positioned SVG paths.

### Community

The community experience focuses on:

* Players currently online
* Recent activity
* Gaming communities
* Community discovery
* Social presence

The visual direction intentionally favors editorial layouts, typography and separators over excessive cards, gradients and glassmorphism.

### Authentication

The initial authentication interface includes:

* Sign in
* Sign up
* Forgot password
* Reset password
* Email verification

These screens currently provide the frontend experience. Backend authentication is not yet connected.

## 3D System

Game Arena uses Three.js for interactive visual elements.

Current 3D components include:

* `Dice`
* `ControllerViewer`
* `PortraitViewer`

The 3D system is designed to keep objects reusable and configurable instead of embedding Three.js scenes directly inside individual pages.

For example:

```tsx
<Dice
  value={6}
  autoRotate
  rollDuration={1800}
/>
```

The same approach is used for controllers, portraits and future game-related objects.

## Matchmaking Workflow

The matchmaking interface is built with React Flow.

The current conceptual flow is:

```text
Choose Game
    ↓
Matchmaking
    ↓
Player Found
    ↓
Realtime Match
```

Alternative states such as:

```text
Still Searching
Waiting
```

can be represented as independent nodes and connections.

This architecture allows the workflow to evolve into a more dynamic system when the realtime backend is introduced.

## Design Direction

Game Arena follows a restrained gaming-oriented visual language.

The interface prioritizes:

* Strong typography
* Editorial composition
* Clear hierarchy
* Responsive layouts
* Thin borders and separators
* Controlled use of color
* Interactive 3D objects
* Motion with a functional purpose

The project deliberately avoids relying heavily on:

* Excessive gradients
* Large glassmorphism surfaces
* Excessive shadows
* Overly rounded cards
* Decorative UI without a functional purpose

3D and motion are used as visual accents rather than replacing the product interface.

## Themes

The application supports light and dark themes through `next-themes`.

The theme is applied using the document class strategy:

```tsx
attribute="class"
defaultTheme="system"
enableSystem
disableTransitionOnChange
```

## Development

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun dev
```

Build the application:

```bash
bun run build
```

Start the production server:

```bash
bun start
```

Run linting:

```bash
bun run lint
```

## Local Network Development

When testing the application from another device on the local network, the development server can be exposed through the machine's LAN address.

Example:

```bash
bun dev --hostname 0.0.0.0
```

The Next.js configuration can also allow the development origin used by the local network.

## Current Status

Game Arena is currently in its foundation phase.

Implemented:

* Product landing experience
* Responsive navigation
* Games discovery interface
* Community interface
* How-it-works experience
* Authentication UI flows
* Legal pages
* Theme support
* Three.js visual system
* Procedural controller
* Interactive dice
* Procedural portrait viewer
* Particle universe background
* React Flow matchmaking visualization

Not yet connected to production services:

* User authentication backend
* Persistent user accounts
* Realtime matchmaking backend
* Game servers
* Player sessions
* Persistent communities
* Production database
* Realtime presence
* Match history

## Roadmap

The next stages of development are expected to focus on the application backend and realtime infrastructure.

```text
Frontend Foundation
        ↓
Authentication
        ↓
User Profiles
        ↓
Realtime Presence
        ↓
Matchmaking Service
        ↓
Game Sessions
        ↓
Realtime Multiplayer
        ↓
Communities
        ↓
Production Infrastructure
```

## Philosophy

Game Arena is designed as a product rather than a collection of isolated pages.

Each feature should have:

* A clear responsibility
* Reusable components
* Strong TypeScript typing
* Predictable state management
* Responsive behavior
* A consistent visual language
* A clear path toward realtime functionality

The frontend should remain usable and maintainable as the multiplayer infrastructure grows.

## License

The project license has not yet been finalized.
