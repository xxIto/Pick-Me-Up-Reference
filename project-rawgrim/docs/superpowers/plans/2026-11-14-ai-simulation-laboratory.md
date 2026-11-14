# AI Simulation Laboratory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible, isolated headless AI experiment runner with bounded diagnostics, statistical reports, and a developer-only UI.

**Architecture:** A pure runner consumes typed experiment definitions and existing combat domains. Streaming aggregation produces immutable reports; an async chunk adapter provides browser progress/cancellation without becoming a second simulation implementation.

**Tech Stack:** TypeScript, existing combat/AI domains, React, Vitest; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-14-ai-simulation-laboratory-design.md`

## Global Constraints

- Do not mutate player state or add gameplay mechanics.
- Keep Node-compatible domain files free of browser APIs.
- Retain bounded traces, respect maximum rounds, and reject invalid counts/seeds/configurations.
- Record only actually generated results; expose TASK 005E absence as a limitation.
- Do not run repository verification commands in this session per user instruction.

## Review Focus

- Empty or duplicate seed sets must be rejected rather than producing misleading rates.
- NaN/Infinity in configuration or metrics must never enter JSON reports.
- Cancellation must stop between chunks and never emit a fabricated complete report.
- Input roster and nested adaptive profiles must remain unchanged.
- Large batches must not retain unbounded decisions or combat events.

---

### Task 1: Experiment contracts and validation

**Files:** Create `src/features/simulation/domain/types.ts`, `validation.ts`; test `tests/simulationValidation.test.ts`.

**Interfaces:** Produces typed experiments, reports, traces, progress, cancellation, and `validateSimulationExperiment`/`assertValidSimulationExperiment`.

- [ ] Write validation tests for count presets, unique finite seeds, deployed participants, trace bounds, and unknown leader IDs.
- [ ] Implement strict contracts and pure validation.

### Task 2: Streaming metrics and statistics

**Files:** Create `src/features/simulation/domain/statistics.ts`, `metrics.ts`; test `tests/simulationMetrics.test.ts`.

**Interfaces:** Produces Wilson intervals, bounded distributions, immutable aggregation, and finalized `SimulationMetrics`.

- [ ] Write deterministic aggregation and interval tests.
- [ ] Implement finite streaming accumulators without retaining battle logs.

### Task 3: Headless runner and diagnostics

**Files:** Create `src/features/simulation/domain/runner.ts`, `diagnostics.ts`; test `tests/simulationRunner.test.ts`.

**Interfaces:** Produces `runSimulationExperiment`, `runSimulationExperimentAsync`, stable report IDs, bounded traces, and conservative death analysis.

- [ ] Write tests for reproducibility, step/auto equivalence coverage, isolation, stable aggregation, invalid decisions, trace bounds, and cancellation.
- [ ] Implement the runner by composing initialization, social contexts, and learning combat with eligibility disabled.

### Task 4: Reproducible experiment catalog

**Files:** Create `src/features/simulation/data/experiments.ts`; test `tests/simulationExperiments.test.ts`.

**Interfaces:** Produces predefined baseline, personality, rarity, memory, social, and leadership populations/scenarios.

- [ ] Write tests for stable IDs, valid configurations, isolated profile variants, and no shared mutable state.
- [ ] Implement configurations from existing heroes/enemies without changing source balance.

### Task 5: Developer laboratory UI

**Files:** Create `src/features/simulation/SimulationLabPage.tsx`; modify `src/App.tsx`.

**Interfaces:** Consumes the catalog and async runner; exports generated reports through a browser-only UI boundary.

- [ ] Implement scenario/population/count/seed controls, progress/cancel, metric summaries, diagnostics, limitations, and JSON export.
- [ ] Add `/dev/simulation-lab` without adding normal player navigation.

### Task 6: Documentation

**Files:** Create `docs/AI_SIMULATION_LAB.md`; modify `docs/AI_ARCHITECTURE.md`, `docs/GDD.md`, `package.json` if a lightweight Node command is viable without dependencies.

- [ ] Document metric definitions, reproducibility, Node/browser execution, limitations, and balancing-report interpretation.
- [ ] Report TASK 005E as absent rather than fabricating legacy/permadeath validation.
