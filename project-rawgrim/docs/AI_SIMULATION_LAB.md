# AI Simulation Laboratory

## Purpose

The TASK 005F laboratory validates the existing Rawgrim combat and adaptive AI stack. It does not modify balance parameters, player saves, hero progression, memories, learning profiles, relationships, or deployment state.

The developer UI is available directly at `/dev/simulation-lab`. It is intentionally absent from normal player navigation.

## Execution model

`runSimulationExperiment` is a synchronous, React-independent, Node-compatible TypeScript API. `runSimulationExperimentAsync` uses the same battle and aggregation functions but yields between browser chunks and supports progress plus cancellation. The UI exposes 100, 1,000, and 10,000 battle presets; 10,000-battle runs are better executed in Node tooling because browser execution remains device-dependent.

Every experiment defines:

- a stable experiment ID and AI version;
- an explicit scenario and isolated population;
- a unique repeatable seed set;
- maximum rounds inherited by every battle;
- bounded trace and decision limits.

The current catalog covers baseline, aggressive and disciplined personalities, low-rarity veterans, high-rarity recruits, relevant/unrelated/adverse training, relevant and irrelevant memories, trusted parties, distrusted leadership, and no-leader comparison. Training runs first on an isolated roster clone; evaluation uses the experiment seed set and never applies its learning updates. `held-out-coven` provides an encounter outside the baseline skirmish composition.

## Metrics

The report aggregates battle data without retaining full logs:

- win, survival, and death rates with 95% Wilson intervals;
- average rounds, allied damage, effective healing, and wasted healing;
- defend frequency, action distribution, and invalid decisions;
- strategy adherence for decisions with a non-zero strategy signal;
- hypothetical learning-update magnitude calculated on cloned return values but never committed;
- selected memory, relationship, and leadership contribution distributions;
- per-class and per-rarity survival;
- measured runtime and average runtime per battle;
- optional memory delta when a Node caller injects a heap-usage reader.

Runtime is performance evidence only and is not deterministic balance evidence. Utility movement alone is not treated as improved intelligence; comparisons must use outcomes, efficiency, survival, and held-out scenarios.

## Diagnostics and death analysis

Only the configured number of traces is retained. A trace includes the seed, selected actions, legal alternatives, score components, warnings, and defeated heroes. Invalid or non-finite selections are reported.

Death attribution is deliberately conservative. Without a controlled state replay, a legal earlier alternative is evidence of choice—not proof that the alternative would prevent death. Such cases remain `insufficient-evidence` and explicitly state that no counterfactual was executed.

## Comparing configurations

Use the same seed set for both populations. Report sample size, absolute differences, Wilson intervals, and gameplay relevance separately. Do not treat overlapping intervals as proof of equality or tiny non-overlapping changes as automatically meaningful design improvements.

Exported JSON contains the actual generated configuration, seed set, metrics, warnings, limitations, and bounded traces. No benchmark results are committed to the repository because no command was run during implementation.

## Known limitation

TASK 005E is not implemented in this repository. The laboratory can measure combat defeat and survival but cannot validate permanent-death lifecycle, memorial state, legacy transfer, or survivor consequences. Reports include this limitation automatically.
