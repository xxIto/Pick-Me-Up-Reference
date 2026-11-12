
# Project Ascension - Agent Instructions

## Project
Single-player hero management and auto-battle RPG.
Initial target: web prototype.
Future targets: Windows and Android.

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS
- Zustand
- Vitest

## Architecture Rules
- Use feature-based architecture.
- Keep simulation logic independent of React.
- Use strict TypeScript types.
- Prefer small, reusable components.
- Keep gameplay data separate from UI.
- Avoid unnecessary dependencies.
- Do not introduce backend services without approval.

## Development Rules
- Inspect existing code before modifying it.
- Make minimal, focused changes.
- Do not overwrite unrelated files.
- Add tests for gameplay rules.
- Run typecheck, tests, and build when possible.
- Report failed or unexecuted checks.
- Do not claim features are working without verification.

## Game Design
- Auto-battle is controlled by hero AI.
- Players manage heroes and party composition.
- Gacha uses in-game currency for the MVP.
- Combat must support seeded random generation.
- Hero permadeath must be configurable.
