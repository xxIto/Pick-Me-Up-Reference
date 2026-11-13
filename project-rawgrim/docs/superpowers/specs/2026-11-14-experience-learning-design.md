# Experience-Based Learning Design

## Intent

TASK 005B lets individual heroes develop bounded tactical preferences from their own combat histories while preserving deterministic combat, innate personality, and existing progression.

## Goals

- Extract compact combat context and actual measurable outcomes.
- Apply deterministic reward-weighted online updates after a battle.
- Persist an independent learning profile per stable hero instance.
- Reject duplicate processing of one battle without storing full logs.
- Provide an isolated Learning Laboratory for controlled before/after inspection.

## Non-goals

- No mid-battle mutation, neural network, backend, social relationship, full permadeath, or claim that score movement proves tactical improvement.
- Sandbox and laboratory runs never write to the player roster.

## Approaches

1. Four global preference numbers only: smallest change, but cannot express context-specific behavior.
2. Unbounded state/action context table: expressive, but violates storage and offline performance constraints.
3. Bounded contextual weight vector per action category: selected. It is deterministic, compact, interpretable, and extends the existing four preference biases.

## Domain design

Each hero personality retains the existing learned category biases and gains a `LearningProfile` containing bounded context weights, a fixed-size processed-battle fingerprint bitset, and a processed-battle counter. Context contains one-hot actor HP bands plus normalized ally risk, enemy threat, and offensive, defensive, and healing opportunities.

Observations store only the current battle result object in memory: hero/session IDs, context, selected category, valid alternatives, class, and measurable immediate outcome. Full observations are not persisted.

The update equation for the selected category is:

`effectiveRate = learningRate / max(1, heroObservationCount)`

`newBias = clamp(oldBias + effectiveRate * reward * preferenceScale)`

`newWeight[f] = clamp(oldWeight[f] + effectiveRate * reward * feature[f] * contextScale)`

All inputs and outputs are finite, rounded, and bounded. Reward is a clamped sum of meaningful normalized damage/healing, elimination, measured mitigation, severe non-tank self-endangerment, relevant ally loss, and a small battle outcome signal.

## Integration

The Utility AI reads a snapshot and combines global learned bias with the dot product of current context and contextual weights, clamped to the existing learned contribution range. The autonomous learning runner captures observations from pre/post states and events but does not mutate profiles. A pure post-battle processor returns learning updates. The Zustand store exposes an explicit commit action for eligible future progression battles; current sandbox UI never invokes it.

Save schema v4 migrates v1-v3 saves by preserving all existing data and adding neutral profiles. Innate personality is never updated.

## Learning Laboratory

The Archive page gains an isolated experiment panel with hero, fixed encounter, seed, and repeat controls. It clones profiles, trains locally, evaluates before and after on the same seed, displays structured updates, and provides reset. No laboratory state enters Zustand persistence.

## Constraints and risks

- A fixed fingerprint bitset is bounded and prevents duplicate processing, but can very rarely produce a false-positive duplicate due to hashing.
- Defensive credit is assigned only when the engine reports measured mitigation after a prior defend action.
- Victory/defeat remains a small signal; immediate actions dominate credit.
- No production progression battle route currently exists, so persistent commit is implemented as an explicit store boundary but is not called by the sandbox.
