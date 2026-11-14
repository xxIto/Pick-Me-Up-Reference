# Persistent Hero Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded episodic memory, enemy knowledge, deterministic recall, AI influence, persistence, and Chronicle UI.

**Architecture:** Pure memory modules form episodes from completed combat evidence, retain bounded profiles, and recall relevant episodes for Utility AI. Hero instances persist profiles; Zustand only commits explicitly eligible formation results.

**Tech Stack:** TypeScript, React, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-11-14-hero-memory-design.md`

## Global Constraints

- Do not rewrite combat or learning systems.
- Memory evaluation cannot mutate personality or learning.
- Maximum 100 episodes, 50 enemy knowledge entries, and 5 recalled memories.
- Memory utility is bounded to ±15.
- Sandbox and laboratory remain non-persistent.
- Do not run verification commands in this session per user instruction.

## Review Focus

- Malformed persisted episodes must not reset unrelated hero progression.
- Duplicate source processing must not create episodes or double knowledge.
- Capacity pruning must be stable and preserve unique major milestones where possible.
- Recall must remain deterministic when relevance scores tie.
- Memory scoring must remain separate from learned preference updates.

---

### Task 1: Memory schema, formation, retention, and tests

Create `src/features/memory/domain/{types,memoryProfile,significance,memoryFormation}.ts` and `tests/heroMemory.test.ts`. Test validation, evidence-only formation, duplicates, significance, knowledge, capacity, pruning, and profile independence before implementing pure functions.

### Task 2: Recall and Utility AI integration

Create `src/features/memory/domain/memoryRecall.ts`; modify AI types, scoring, resolvers, and inspector. Test relevance, ordering, count, clamping, immutability, no learning overlap, and deterministic decisions.

### Task 3: Persistence and commit boundary

Add optional memory to `HeroInstance`, initialize new/legacy heroes, migrate save v4 to v5, validate profiles, and add explicit store commit. Extend persistence tests for migration and round-trip consistency.

### Task 4: Chronicle and documentation

Create `src/features/memory/components/HeroChronicle.tsx`, integrate Hero Details filtering/empty states, and document formation, recall, retention, persistence, and limitations.
