# Personality and Autonomous Decision Architecture

## Scope

TASK 005A adds deterministic hero personalities and Utility AI without replacing the TASK 004 combat engine. The combat engine remains responsible for turn order, target rules, cooldowns, action validation, resolution, and outcomes. The AI layer only ranks actions returned by `getAvailableActions` and submits the selected action to the existing resolver.

Persistent experience capture and learning updates are deliberately deferred to TASK 005B.

## Hero personality state

Every new `HeroInstance` receives a `HeroPersonalityState` containing:

- `identityId`: stable per owned hero instance, independent of the shared hero definition.
- `innateTraitId`: compatibility link to the definition's existing narrative trait.
- `innate`: courage, discipline, aggression, empathy, self-preservation, ambition, and trust.
- `learned`: bounded offense, healing, defense, and active-skill preferences.
- `emotion`: temporary fear, anger, and resolve values.

Innate and emotional dimensions are normalized to integer values from 0 through 100. Learned preferences are normalized to integer values from -10 through 10 and start at zero.

New summoned heroes use the gacha engine's injected random source. This makes profiles reproducible under seeded tests while allowing two instances of the same definition to differ. Existing heroes without a profile are migrated from a stable hash of their instance ID and trait ID. The resulting profile is persisted and is not regenerated on each load.

## Save migration

The game save schema is version 3.

- Version 1 hero saves retain roster and formation, receive the configured initial crystal balance, deterministic personality profiles, and the `Balanced` strategy.
- Version 2 game saves retain roster, formation, and crystals, then receive deterministic personality profiles and the `Balanced` strategy.
- Version 3 saves require a valid strategy and normalize persisted personality values.
- Invalid or unsupported data falls back through the existing Zustand persistence recovery path instead of partially hydrating the store.

## Utility decision pipeline

For the current actor, the AI performs the following pure sequence:

1. Request valid candidates from the combat engine.
2. Calculate bounded base utility from expected damage or healing, target threat, kill potential, actor survival risk, and supported class behavior.
3. Add a personality contribution bounded to -25 through 25.
4. Add a team-strategy contribution bounded to -15 through 15. Discipline scales this contribution linearly, so discipline 0 ignores the preference and discipline 100 receives its full weight.
5. Add the learned preference contribution bounded to -10 through 10. It remains zero in TASK 005A.
6. Clamp final utility to -50 through 150.
7. Select the highest score, using a stable action key as the deterministic tie-breaker.

Base utility is bounded to 0 through 100. Current class modifiers are limited to supported behavior:

- Warriors and Archers favor offensive pressure.
- Tanks favor defend when it is available and useful.
- Healers favor meaningful healing of an injured ally.

No taunt, intercept, retreat, movement, or other unsupported action is synthesized.

## Explainability and UI

Each `DecisionTrace` records the hero instance ID, selected action and target, all valid candidate actions, each score component, final utility, and the selection reason. Traces are transient combat data and are not included in persistent game saves.

Hero Details display the innate dimensions and reserve a learned-behavior area. Party Formation stores the selected team strategy. The Combat Sandbox uses the autonomous runner for both Next Turn and Auto Resolve and displays the most recent decision plus its top candidates.

## Determinism and immutability

Candidate evaluation contains no random calls and does not mutate combat or personality state. Identical combat state, personality, learned preferences, and strategy produce an identical decision. Step execution and full autonomous execution share the same decision function.

## Known limitations

- Learned preferences are an integration contract only; no values change after combat.
- Emotional state is persisted and scored but no emotion-update system exists yet.
- Team protection is limited to actions already supported by the combat engine.
- Enemy units use a neutral, balanced decision context because persistent enemy personalities are outside this task.
- Decision traces are intentionally not stored as long-term memories.
