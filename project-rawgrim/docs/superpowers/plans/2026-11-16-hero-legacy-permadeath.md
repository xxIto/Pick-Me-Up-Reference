# Hero Legacy, Permadeath, and Survivor Consequences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authorized, idempotent permanent-death transaction with memorial archives, bounded survivor consequences, save migration, and Hall of the Fallen UI without enabling permadeath from sandbox gameplay.

**Architecture:** Pure lifecycle functions validate an official future-expedition contract and construct a complete next-state proposal. An injected coordinator pre-persists the proposal and then commits it once to Zustand; memorial records replace fallen active-roster entries while survivor profiles remain attached to active heroes.

**Tech Stack:** TypeScript 6, React 19, Zustand 5, React Router 7, Vitest 5, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-11-16-hero-legacy-permadeath-design.md`

## Global Constraints

- Strict TypeScript; pure domain logic where practical; no new dependency, backend, LLM, neural network, resurrection, reward economy, or Tower/Expedition implementation.
- Sandbox, replay, laboratory, and training combat can never authorize persistent death.
- Preserve existing combat determinism, valid-action checks, roster ownership, currency, adaptive profiles, and save migration.
- Do not expose a production kill control.
- Local storage is not disk-atomic and must not be described as such.

## Review Focus

- Forged or mismatched official result must be rejected without state mutation.
- Multiple fallen heroes in one result must aggregate survivor emotion deterministically and clean every reference.
- Persistence failure or overlapping requests must not expose a successful partial transition.
- Legacy saves containing `Dead` heroes must preserve identity as unknown-history memorials without survivor effects.
- Repeated resolution after reload must not duplicate memorial, learning, memory, relationship, or emotion changes.

---

### Task 1: Legacy domain models and survivor rules

**Files:**
- Create: `src/features/legacy/domain/types.ts`
- Create: `src/features/legacy/domain/survivorConsequences.ts`
- Create: `src/features/legacy/domain/memorial.ts`
- Modify: `src/features/heroes/domain/types.ts`
- Test: `tests/survivorConsequences.test.ts`
- Test: `tests/heroLegacy.test.ts`

**Interfaces:**
- Consumes: `HeroInstance`, normalized personality, relationship and memory profiles, hero definitions, finalized combat evidence.
- Produces: `HeroMemorialRecord`, `SurvivorConsequenceProfile`, `createLegacyMemorial`, `calculateSurvivorResponse`, `applySurvivorRecovery`, and strict validators/normalizers.

- [ ] Write failing tests proving personality/relationship-dependent responses, bounded emotion, deterministic recovery, no generated guilt, unknown legacy history, and immutable memorial snapshots.
- [ ] Run focused tests and confirm failure because legacy modules do not exist.
- [ ] Implement the minimal typed models, formulas, retention, legacy memorial factory, and recovery contract.
- [ ] Run focused tests and confirm they pass.

### Task 2: Pure authorized death-resolution pipeline

**Files:**
- Create: `src/features/legacy/domain/deathResolution.ts`
- Modify: `src/features/memory/domain/types.ts`
- Modify: `src/features/memory/domain/memoryFormation.ts`
- Test: `tests/permadeathResolution.test.ts`

**Interfaces:**
- Consumes: `OfficialDeathResolutionRequest`, current lifecycle state, hero definitions, `applyCombatExperience`, `formHeroMemories`, and `formPartyRelationships`.
- Produces: `resolveAuthorizedPermadeath(current, request, definitions): DeathResolutionResult` returning either a complete proposal, an idempotent duplicate, or validation errors without mutation.

- [ ] Write failing tests for sandbox rejection, incomplete/mismatched results, exact fallen identity validation, single and multiple death cleanup, leader invalidation, duplicate resolution, post-battle memorial snapshots, no partial mutation, and resummoned identity independence.
- [ ] Run focused tests and confirm expected missing-pipeline failures.
- [ ] Implement validation and the documented ordered pure proposal pipeline, including factual survivor death memories.
- [ ] Run focused tests and confirm they pass.

### Task 3: Save version 7 and migration

**Files:**
- Modify: `src/state/gamePersistence.ts`
- Modify: `src/features/heroes/domain/persistence.ts`
- Modify: `src/features/heroes/store/heroStore.ts`
- Test: `tests/heroPersistence.test.ts`
- Test: `tests/legacyPersistence.test.ts`

**Interfaces:**
- Consumes: validated memorial/survivor schemas and version-6 state.
- Produces: version-7 `PersistedGameState`, migration of legacy dead heroes, archive cross-reference validation, and bounded processed resolution IDs.

- [ ] Write failing tests for v6 legacy-dead migration, v7 round-trip, invalid archive rejection, stale-reference cleanup, currency preservation, and duplicate identity rejection.
- [ ] Run focused tests and confirm version/schema failures.
- [ ] Implement migration and validation while preserving existing v1–v6 paths.
- [ ] Run focused tests and confirm they pass.

### Task 4: Authoritative transaction coordinator and store integration

**Files:**
- Create: `src/features/legacy/domain/deathTransaction.ts`
- Modify: `src/features/heroes/store/heroStore.ts`
- Test: `tests/permadeathTransaction.test.ts`

**Interfaces:**
- Consumes: pure resolution pipeline and injected `read`, `persist`, and `commit` dependencies.
- Produces: guarded `executeOfficialDeathResolution`, one Zustand commit, and explicit success/duplicate/failure results.

- [ ] Write failing tests for failed pre-write, successful one-time commit, duplicate request, overlapping request rejection, and persistence reload consistency.
- [ ] Run focused tests and confirm coordinator is missing.
- [ ] Implement the coordinator and a store action unavailable to normal UI controls.
- [ ] Run focused tests and confirm they pass.

### Task 5: Hall of the Fallen and survivor UI

**Files:**
- Create: `src/features/legacy/HallOfTheFallenPage.tsx`
- Create: `src/features/legacy/MemorialDetailPage.tsx`
- Create: `src/features/legacy/components/SurvivorConsequencesPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/features/heroes/HeroDetailPage.tsx`

**Interfaces:**
- Consumes: persisted memorials and active hero survivor profile.
- Produces: `/fallen`, `/fallen/:memorialId`, separate navigation, unknown-data labels, and read-only survivor effects.

- [ ] Implement the read-only routes/components using existing UI primitives; add no kill action.
- [ ] Manually inspect route structure and run TypeScript validation.

### Task 6: Documentation and regression verification

**Files:**
- Modify: `docs/GDD.md`
- Modify: `docs/AI_ARCHITECTURE.md`
- Modify: `docs/AI_SIMULATION_LAB.md`
- Modify: `src/features/simulation/domain/runner.ts`
- Modify: `tests/simulationRunner.test.ts`

**Interfaces:**
- Consumes: completed 005E behavior and current Simulation Laboratory limitations.
- Produces: accurate lifecycle architecture documentation and removal of the obsolete “TASK 005E absent” claim while keeping sandbox/laboratory isolation explicit.

- [ ] Write the failing regression assertion that the laboratory limitation now describes official isolation rather than missing TASK 005E.
- [ ] Update documentation and limitation output.
- [ ] Run the full test suite, lint, typecheck, and production build; record actual results.
