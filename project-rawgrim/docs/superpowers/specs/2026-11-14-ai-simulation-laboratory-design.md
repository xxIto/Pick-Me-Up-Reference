# AI Simulation Laboratory Design

## Intent

TASK 005F adds developer tooling that measures the existing autonomous combat stack without changing gameplay balance or player saves. The laboratory must make comparisons reproducible, expose uncertainty and limitations, and retain only bounded diagnostic traces.

## Repository audit

- Implemented: seeded combat initialization, bounded autonomous combat, decision traces, contextual learning, episodic memory, directional relationships, leadership, chemistry, and isolated learning experiments.
- Missing: TASK 005E legacy/permadeath lifecycle, memorial archive, survivor consequences, a production progression battle route, and any Node CLI entry point.
- Risks: blocking the browser with large synchronous batches; retaining every battle event; treating score movement as improved intelligence; attributing deaths without replay evidence; and accidentally mutating Zustand-owned profiles.
- Existing coverage: combat determinism and validation, step/auto equivalence, personality differentiation, learning isolation, memory bounds/recall, relationships, leadership, persistence, gacha, and roster rules.

## Chosen approach

Use one pure synchronous experiment runner as the authoritative engine for Node and deterministic tests. Add an asynchronous chunked browser adapter for progress and cancellation. Reports use streaming aggregation and retain only a configured number of detailed battle traces. A developer-only route exposes predefined scenarios, counts of 100/1,000/10,000, seed control, live progress, result summaries, selected trace diagnostics, and JSON export.

Alternatives rejected:

- A React-first simulator would duplicate domain behavior and could not support Node cleanly.
- Web Workers would improve browser throughput but require a separate worker build/protocol before the core report contracts are stable. The chunked adapter is the smaller initial boundary; 10,000-run work remains Node-preferred.
- Persisting experiment history would couple validation to player saves and violate isolation.

## Metrics and semantics

Reports include win/survival/death rates with 95% Wilson intervals, rounds, damage, effective and wasted healing, defend frequency, invalid decisions, action distribution, strategy adherence, modifier distributions, runtime, per-class and per-rarity outcomes, warnings, and bounded traces.

Strategy adherence counts only decisions whose existing strategy contribution is non-zero; positive contributions are adherent. Decision quality is reported through observable outcomes and action efficiency, never inferred from utility changes alone. Death causes remain `insufficient-evidence` unless the collected evidence supports a narrower factual category. No report claims a legal alternative would prevent a death without replay evidence.

## Isolation and limits

Every experiment clones roster, formation, memory, learning, and relationship state. Evaluation runs never call Zustand, learning commits, memory formation, relationship formation, or permanent-death logic. The repository has no TASK 005E implementation, so the report explicitly warns that permanent-death fairness and survivor consequences are not measurable yet.

No benchmark numbers are committed as facts. Reports contain only results generated when the user runs an experiment.
