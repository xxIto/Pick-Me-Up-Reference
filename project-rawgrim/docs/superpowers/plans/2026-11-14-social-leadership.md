# Social Relationships, Leadership, and Party Dynamics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent directional relationships, deployed leadership, explainable party chemistry, and bounded social influence on autonomous decisions.

**Architecture:** Each `HeroInstance` owns a bounded directed relationship profile. Pure post-battle formation, leadership, chemistry, and social-influence modules feed a precomputed deployed-party context into Utility AI; Zustand only owns persistence and explicit commit boundaries.

**Tech Stack:** Strict TypeScript, React, Zustand persistence, Vitest, existing Tailwind UI.

**Spec:** `docs/superpowers/specs/2026-11-14-social-leadership-design.md`

## Global Constraints

- No backend, external AI, new combat abilities, romance, dialogue generation, permanent death lifecycle, or unrelated UI redesign.
- Relationship updates require completed explicitly eligible combat and must be deterministic, bounded, and idempotent.
- Leadership and chemistry modify utility only; they never modify raw combat stats or bypass valid actions.
- Save v6 must preserve roster, currency, formation, strategy, personality, learning, and memory.
- Verification commands are documented but not executed in this session per user instruction.

## Review Focus

- A relationship target missing from the roster is removed during normalization without discarding other valid edges.
- Removing or killing the deployed leader clears or deactivates leadership without deleting social history.
- Duplicate battle processing changes neither dimensions nor history.
- A Social memory and matching relationship edge cannot both apply their full rescue signal.
- Empty and single-hero parties produce finite neutral chemistry values.

---

### Task 1: Relationship domain and event formation

**Files:**
- Create: `src/features/social/domain/types.ts`
- Create: `src/features/social/domain/relationshipProfile.ts`
- Create: `src/features/social/domain/relationshipEngine.ts`
- Test: `tests/relationships.test.ts`

**Interfaces:**
- Produces `createEmptyRelationshipProfile`, `normalizeRelationshipProfile`, `getRelationship`, and `formPartyRelationships`.
- Consumes finalized combat state, learning observations, personality state, and optional memory references.

- [ ] Write tests for directional independence, neutral initialization, rescue asymmetry, personality-dependent recklessness, bounds, duplicate prevention, no fabricated rescue, history limits, and ineligible sandbox behavior.
- [ ] Implement typed profiles, dimensions, event history, 256-bit duplicate fingerprint, deterministic retention, and runtime normalization.
- [ ] Implement post-battle formation for meaningful shared battle, rescue, reckless self-endangerment, major outcome, and ally loss evidence.

### Task 2: Leadership and party chemistry

**Files:**
- Create: `src/features/social/domain/leadership.ts`
- Create: `src/features/social/domain/partyChemistry.ts`
- Test: `tests/partyDynamics.test.ts`

**Interfaces:**
- Produces `validateLeaderAssignment`, `calculateLeadershipEffectiveness`, and `evaluatePartyChemistry`.
- Consumes deployed hero instances, personalities, directed profiles, and nullable leader ID.

- [ ] Write tests for valid/invalid/dead leader selection, trust/respect influence, bounded effectiveness, low-discipline inputs, chemistry differences, conflict detection, determinism, and empty/single-party safety.
- [ ] Implement the documented weighted leadership formula with component explanations.
- [ ] Implement four-axis chemistry without combat stat output.

### Task 3: Social Utility AI integration

**Files:**
- Create: `src/features/social/domain/socialInfluence.ts`
- Modify: `src/features/ai/domain/types.ts`
- Modify: `src/features/ai/domain/utilityAI.ts`
- Modify: `src/features/combat/ArchivePage.tsx`
- Modify: `src/features/learning/domain/trainingLab.ts`
- Test: `tests/socialAI.test.ts`

**Interfaces:**
- Produces `createPartySocialContexts`, relationship contribution ±8, and leadership contribution ±10.
- Extends candidate and decision traces with separate social components and explanations.

- [ ] Write tests for trusted healing priority, resentment, leadership adherence, low-discipline autonomy, contribution bounds, no mutation, deterministic decisions, and Social-memory overlap reduction.
- [ ] Implement precomputed party contexts and pure per-candidate scoring.
- [ ] Add separate trace fields and sandbox explanations while preserving existing ordering and validity.

### Task 4: State, migration, and commit boundary

**Files:**
- Modify: `src/features/heroes/domain/types.ts`
- Modify: `src/features/heroes/domain/heroRules.ts`
- Modify: `src/features/heroes/data/initialRoster.ts`
- Modify: `src/features/heroes/store/heroStore.ts`
- Modify: `src/state/gamePersistence.ts`
- Modify: `tests/heroPersistence.test.ts`

**Interfaces:**
- Adds optional legacy-compatible relationship profile on `HeroInstance`, persisted `leaderId`, `setPartyLeader`, and `commitRelationshipExperience`.

- [ ] Extend persistence tests for v5→v6 migration, relationship round-trip, invalid references, leader round-trip, and missing/dead/undeployed leader fallback.
- [ ] Initialize independent relationship profiles for new and starter heroes.
- [ ] Add store actions that validate leader assignment, clear removed leaders, and atomically commit all eligible relationship profiles.

### Task 5: Minimal social UI and documentation

**Files:**
- Create: `src/features/social/components/HeroRelationships.tsx`
- Create: `src/features/social/components/PartyDynamicsPanel.tsx`
- Modify: `src/features/heroes/HeroDetailPage.tsx`
- Modify: `src/features/heroes/components/PartyFormationPanel.tsx`
- Modify: `docs/AI_ARCHITECTURE.md`
- Modify: `docs/GDD.md`

**Interfaces:**
- Displays directional relationship dimensions/history, leader controls, chemistry axes, warnings, effectiveness, and social AI trace details.

- [ ] Add responsive relationship and party-dynamics components using existing Card, Badge, ProgressBar, and form styles.
- [ ] Integrate components without changing unrelated page structure.
- [ ] Document ranges, formation rules, formulas, overlap handling, save v6, and limitations.

### Task 6: User-run verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Report exact failures for correction; do not claim completion until these checks are green.
