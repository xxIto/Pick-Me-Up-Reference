# Experience-Based Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, bounded, persistent contextual learning and an isolated Learning Laboratory.

**Architecture:** A pure learning feature extracts context, records observations from autonomous combat, computes post-battle updates, and returns immutable profiles. Utility AI reads profile snapshots; Zustand only commits explicitly eligible completed battle results.

**Tech Stack:** TypeScript, React, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-11-14-experience-learning-design.md`

## Global Constraints

- Preserve TASK 001-005A behavior and do not replace the combat engine.
- No random calls in learning updates and no mid-battle profile mutation.
- Sandbox and laboratory runs cannot mutate persistent player state.
- Keep values, memory, serialization, and computation bounded.
- Do not run verification commands in this session per user instruction.

## Review Focus

- NaN or out-of-range configuration must be rejected or normalized safely.
- Empty observations and draw outcomes must remain finite and deterministic.
- Reprocessing the same session must return no updates.
- Two heroes must never share mutable profile references.
- Save v3 migration must preserve roster, formation, crystals, strategy, and innate personality.

---

### Task 1: Learning domain and tests

**Files:**
- Create: `src/features/learning/domain/types.ts`
- Create: `src/features/learning/domain/learningProfile.ts`
- Create: `src/features/learning/domain/context.ts`
- Create: `src/features/learning/domain/rewards.ts`
- Create: `src/features/learning/domain/learningEngine.ts`
- Test: `tests/learningEngine.test.ts`

**Interfaces:**
- Produces neutral profile creation, context extraction, reward calculation, and immutable post-battle updates.

- [ ] Write tests for neutral state, context bands, rewards, clamping, determinism, profile independence, duplicate sessions, and numerical stability.
- [ ] Implement the typed domain and bounded update equation.

### Task 2: Combat observation integration

**Files:**
- Create: `src/features/ai/domain/actionCategory.ts`
- Create: `src/features/learning/domain/experienceCollector.ts`
- Modify: `src/features/combat/domain/types.ts`
- Modify: `src/features/combat/domain/combatEngine.ts`
- Modify: `src/features/ai/domain/utilityAI.ts`
- Modify: `src/features/ai/domain/types.ts`
- Modify: `src/features/ai/domain/autonomousCombat.ts`
- Test: `tests/learningIntegration.test.ts`

**Interfaces:**
- Consumes existing valid candidates, decisions, action resolution, and events.
- Produces deterministic experience results and context-sensitive learned score contributions.

- [ ] Write controlled observation, learned-score, sandbox-default, and step/auto regression tests.
- [ ] Add measured mitigation metadata and a learning-aware runner without changing base resolution behavior.

### Task 3: Persistence and explicit commit boundary

**Files:**
- Modify: `src/features/heroes/domain/personalityTypes.ts`
- Modify: `src/features/heroes/domain/personality.ts`
- Modify: `src/state/gamePersistence.ts`
- Modify: `src/features/heroes/store/heroStore.ts`
- Modify: `tests/heroPersistence.test.ts`

**Interfaces:**
- Consumes completed learning experience.
- Produces save v4 migration and explicit one-time roster learning commit.

- [ ] Write v3 migration, round-trip, malformed profile, and immutable roster update tests.
- [ ] Add neutral initialization, runtime normalization, migration, and store commit action.

### Task 4: Isolated Learning Laboratory and documentation

**Files:**
- Create: `src/features/learning/domain/trainingLab.ts`
- Create: `src/features/learning/components/LearningLaboratory.tsx`
- Modify: `src/features/combat/ArchivePage.tsx`
- Modify: `src/features/heroes/HeroDetailPage.tsx`
- Modify: `docs/AI_ARCHITECTURE.md`
- Modify: `docs/GDD.md`
- Test: `tests/learningLaboratory.test.ts`

**Interfaces:**
- Produces controlled before/after policy comparison on cloned profiles only.

- [ ] Write tests proving experiments are deterministic and do not mutate source heroes.
- [ ] Implement controls, structured update inspection, learned indicators, and reset.
- [ ] Document equations, reward bounds, migration, commit boundary, and limitations.
