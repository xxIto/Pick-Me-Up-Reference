# Personality and Autonomous Decision Architecture

## Scope

TASK 005A adds deterministic hero personalities and Utility AI without replacing the TASK 004 combat engine. The combat engine remains responsible for turn order, target rules, cooldowns, action validation, resolution, and outcomes. The AI layer only ranks actions returned by `getAvailableActions` and submits the selected action to the existing resolver.

TASK 005B adds bounded experience-based learning as a separate post-battle layer. Combat resolution and candidate validation remain owned by the TASK 004 engine.

## Hero personality state

Every new `HeroInstance` receives a `HeroPersonalityState` containing:

- `identityId`: stable per owned hero instance, independent of the shared hero definition.
- `innateTraitId`: compatibility link to the definition's existing narrative trait.
- `innate`: courage, discipline, aggression, empathy, self-preservation, ambition, and trust.
- `learned`: bounded offense, healing, defense, and active-skill preference biases.
- `learning`: bounded contextual weights, processed-battle fingerprint bits, and a battle counter.
- `emotion`: temporary fear, anger, and resolve values.

Innate and emotional dimensions are normalized to integer values from 0 through 100. Learned preferences are stable decimal values from -10 through 10 and start at zero. Contextual weights are bounded from -4 through 4.

New summoned heroes use the gacha engine's injected random source. This makes profiles reproducible under seeded tests while allowing two instances of the same definition to differ. Existing heroes without a profile are migrated from a stable hash of their instance ID and trait ID. The resulting profile is persisted and is not regenerated on each load.

## Save migration

The game save schema is version 4.

- Version 1 hero saves retain roster and formation, receive the configured initial crystal balance, deterministic personality profiles, and the `Balanced` strategy.
- Version 2 game saves retain roster, formation, and crystals, then receive deterministic personality profiles and the `Balanced` strategy.
- Version 3 saves retain all TASK 005A state and receive independent neutral contextual profiles.
- Version 4 saves require a valid strategy and normalize persisted personality and learning values.
- Invalid or unsupported data falls back through the existing Zustand persistence recovery path instead of partially hydrating the store.

## Utility decision pipeline

For the current actor, the AI performs the following pure sequence:

1. Request valid candidates from the combat engine.
2. Calculate bounded base utility from expected damage or healing, target threat, kill potential, actor survival risk, and supported class behavior.
3. Add a personality contribution bounded to -25 through 25.
4. Add a team-strategy contribution bounded to -15 through 15. Discipline scales this contribution linearly, so discipline 0 ignores the preference and discipline 100 receives its full weight.
5. Add the learned preference bias plus the dot product of current context and contextual weights, bounded to -10 through 10.
6. Clamp final utility to -50 through 150.
7. Select the highest score, using a stable action key as the deterministic tie-breaker.

Base utility is bounded to 0 through 100. Current class modifiers are limited to supported behavior:

- Warriors and Archers favor offensive pressure.
- Tanks favor defend when it is available and useful.
- Healers favor meaningful healing of an injured ally.

No taunt, intercept, retreat, movement, or other unsupported action is synthesized.

## Explainability and UI

Each `DecisionTrace` records the hero instance ID, selected action and target, all valid candidate actions, each score component, final utility, and the selection reason. Traces are transient combat data and are not included in persistent game saves.

Hero Details display innate dimensions, learned category biases, and processed battle count. Party Formation stores the selected team strategy. The Combat Sandbox uses the autonomous runner for both Next Turn and Auto Resolve and displays the most recent decision plus its top candidates.

The Learning Laboratory trains cloned profiles only. It supports a selected hero, fixed encounter, seed, repeated battles, identical seeded before/after evaluation, structured signals, contextual changes, and reset without writing to Zustand.

## Context and learning update

The compact feature vector contains three mutually exclusive actor HP bands (critical at 25% or lower, low above 25% through 50%, and medium above 50%), plus normalized ally risk, enemy threat, offensive opportunity, defensive opportunity, and healing opportunity.

For each finalized observation, the selected action category is updated after combat:

`effectiveRate = learningRate / max(1, heroObservationCount)`

`bias' = clamp(bias + effectiveRate × reward × preferenceScale, -10, 10)`

`weight'[f] = clamp(weight[f] + effectiveRate × reward × feature[f] × contextScale, -4, 4)`

The default learning rate is 0.2, preference scale is 2, and context scale is 1.5. Within one battle the learning rate is divided by that hero's observation count, preventing longer battles from accumulating disproportionate unrestricted updates. Operations are rounded to four decimal places. Invalid non-finite observation values become neutral rather than propagating `NaN`.

Reward is a bounded sum from -1 through 1. Meaningful normalized damage, effective healing, elimination, and measured defend mitigation are positive. Wasted healing, severe non-tank self-endangerment, and context-relevant ally loss are negative. Victory or defeat contributes only ±0.1. Ordinary damage taken is not a penalty, and tanks do not receive the self-endangerment penalty merely for absorbing damage.

Observations and decision traces remain transient. Each hero persists only its compact profile. A fixed 128-bit fingerprint prevents the same battle result being applied twice without retaining combat logs. Learning is committed only for completed, explicitly eligible battles; current sandbox and laboratory battles never commit to the player roster.

## Determinism and immutability

Candidate evaluation contains no random calls and does not mutate combat or personality state. Identical combat state, personality, learned preferences, and strategy produce an identical decision. Step execution and full autonomous execution share the same decision function.

## Known limitations

- Emotional state is persisted and scored but no emotion-update system exists yet.
- Team protection is limited to actions already supported by the combat engine.
- Enemy units use a neutral, balanced decision context because persistent enemy personalities are outside this task.
- Decision traces are intentionally not stored as long-term memories.
- The duplicate fingerprint can rarely reject a new session through a hash collision; this is the bounded-memory trade-off.
- The project currently has no production progression battle route, so the persistent commit action is available but intentionally unused by the sandbox.
