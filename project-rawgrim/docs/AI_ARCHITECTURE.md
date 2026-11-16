# Personality and Autonomous Decision Architecture

## Scope

TASK 005A adds deterministic hero personalities and Utility AI without replacing the TASK 004 combat engine. The combat engine remains responsible for turn order, target rules, cooldowns, action validation, resolution, and outcomes. The AI layer only ranks actions returned by `getAvailableActions` and submits the selected action to the existing resolver.

TASK 005B adds bounded experience-based learning as a separate post-battle layer. Combat resolution and candidate validation remain owned by the TASK 004 engine.

TASK 005C adds persistent episodic memory and compact enemy knowledge. Memory formation consumes completed combat evidence, while recall is a read-only input to Utility AI. It does not replace learning or personality.

TASK 005D adds directional relationships, deployed leadership, and multi-axis party chemistry. Social state is formed after eligible completed battles and remains a separate Utility AI input.

TASK 005F adds an isolated headless simulation layer. It composes the existing seeded combat, AI, learning-observation, memory-recall, and social-context functions without committing adaptive state. Streaming metrics and bounded traces make matched-seed comparisons reproducible without retaining every combat log.

TASK 005E adds a separately authorized permanent-death boundary. Combat defeat never mutates the roster by itself. A future official expedition supplies stable battle, expedition, and resolution identities; the pure lifecycle pipeline composes learning, memory, relationships, survivor effects, memorial creation, formation cleanup, and leadership invalidation before one persisted Zustand commit.

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

The game save schema is version 7.

- Version 1 hero saves retain roster and formation, receive the configured initial crystal balance, deterministic personality profiles, and the `Balanced` strategy.
- Version 2 game saves retain roster, formation, and crystals, then receive deterministic personality profiles and the `Balanced` strategy.
- Version 3 saves retain all TASK 005A state and receive independent neutral contextual profiles.
- Version 4 saves retain personality, learning, strategy, roster, formation, currency, and progression, then receive an independent empty memory profile for every hero.
- Version 5 saves retain personality, learning, and memory, then receive neutral independent relationship profiles and `leaderId: null`.
- Version 6 saves validate personality, learning, memory, directed relationships, and deployed leadership references.
- Version 7 moves legacy `Dead` entries into unknown-history memorial snapshots, removes them from the active roster, and adds bounded survivor and processed-resolution state.
- Invalid or unsupported data falls back through the existing Zustand persistence recovery path instead of partially hydrating the store.

## Utility decision pipeline

For the current actor, the AI performs the following pure sequence:

1. Request valid candidates from the combat engine.
2. Calculate bounded base utility from expected damage or healing, target threat, kill potential, actor survival risk, and supported class behavior.
3. Add a personality contribution bounded to -25 through 25.
4. Add a team-strategy contribution bounded to -15 through 15. Discipline scales this contribution linearly, so discipline 0 ignores the preference and discipline 100 receives its full weight.
5. Add the learned preference bias plus the dot product of current context and contextual weights, bounded to -10 through 10.
6. Recall up to five relevant episodic memories and add their combined contribution, bounded to -15 through 15.
7. Add supported relationship contribution, bounded to -8 through 8.
8. Add leadership-based strategy adherence, bounded to -10 through 10.
9. Clamp final utility to -50 through 150.
10. Select the highest score, using a stable action key as the deterministic tie-breaker.

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

## Persistent episodic memory

Each owned hero has a separate `HeroMemoryProfile` linked to its stable instance ID. A memory stores a deterministic ID, source session/event key, category, participant IDs, encounter context, structured observed facts, significance components, and event order. Supported categories are Combat, Survival, Achievement, Failure, Social, and Milestone.

Memory formation occurs only at an explicit `commitCombatMemory` boundary for a completed battle marked eligible for persistence. It can record:

- a first victory against an enemy category, a materially risky repeated victory, or a defeat from the finalized battle result;
- survival after the hero actually acted at critical health and remained alive;
- an ally rescue only when an observed healing action restored at least 25% of target maximum health while ally risk was at least 0.75;
- a first significant enemy encounter when observed threat is at least 0.6;
- a repeated-enemy milestone on the third observed encounter.

The significance formula is:

`round(100 × (0.30 severity + 0.25 personalRisk + 0.20 novelty + 0.15 outcomeImportance + 0.10 relevance))`

Every input factor is clamped to 0 through 1. The default formation threshold is 45. Significance affects retention and recall ranking, but does not automatically produce tactical utility; Achievement and Milestone memories can be recalled as context with zero utility.

Enemy knowledge records only observed category IDs, attack damage types, used skill IDs, damage totals, maximum observed damage, and encounter counts. It does not copy hidden definition data.

Recall compares enemy categories, participant IDs, threat similarity, survival risk, action category, and significance. Ranking and ID tie-breaking are deterministic. The selected five memories produce structured explanations and a combined utility contribution clamped to -15 through 15. Recall never mutates memory, innate personality, or learning. Learned preference and memory contribution are displayed and summed separately to prevent memory from being applied as a second learning update.

Retention caps each hero at 100 episodic memories and 50 enemy-knowledge categories. Deterministic pruning preserves major Milestones first, then non-repetitive categories, higher significance, higher relevance, and stable IDs. Enemy knowledge uses encounter and observation density ranking. A fixed 256-bit session fingerprint prevents repeated processing without storing an unlimited source-ID list.

## Relationships, leadership, and party chemistry

Each hero owns a directional `RelationshipProfile`. Familiarity, rivalry, and resentment use 0 through 100. Trust, respect, and affection use -100 through 100 with 0 neutral. Shared experience count is non-negative. A hero retains at most 50 edges and 20 events per edge; a fixed 256-bit session fingerprint prevents repeat processing.

Relationship formation runs only after a completed battle explicitly marked eligible for persistence. Shared participation requires observed threat of at least 0.4 or a defeat and increases familiarity rather than automatic friendship. Meaningful rescue uses the memory system's existing healing and survival-risk thresholds. `severeSelfEndangerment` can produce personality-dependent respect or distrust: disciplined observers and aggressive observers may react differently to the same factual action. Ally loss creates factual history without blame.

Leadership is one nullable deployed hero ID outside the slot-only `PartyFormation` contract. Effectiveness is:

`0.25 discipline + 0.15 courage + 0.10 resolve + 0.15 experience + 0.20 incomingTrust + 0.15 incomingRespect`

Every component is normalized to 0 through 100. Missing, dead, undeployed, or combat-defeated leaders are inactive. Leadership contribution scales the selected strategy direction by effectiveness, actor discipline, trust/resentment toward the leader, and party coordination. It never forces an action.

Party chemistry reports cohesion, coordination, conflict risk, and leadership stability separately. It evaluates directed pairs only among the maximum five deployed heroes. Chemistry exposes no attack, defense, damage, or healing bonus.

- `cohesion = 0.35 normalizedTrust + 0.25 familiarity + 0.20 normalizedAffection + 0.20 personalityCompatibility`
- `coordination = 0.35 normalizedRespect + 0.25 familiarity + 0.20 personalityCompatibility + 0.20 leadershipEffectiveness`
- `conflictRisk = 0.60 mean(rivalry, resentment) + 0.40 personalityFriction`
- `leadershipStability = 0.70 leadershipEffectiveness + 0.30 normalizedTeammateTrust`

The currently supported direct relationship behavior is ally-targeted healing. Trust and affection can raise an equally urgent companion's priority while resentment can lower it; base medical urgency remains the dominant score. If a matching Social memory is recalled for the same target, relationship contribution is halved so the rescue event is not applied at full strength twice.

Decision traces retain both final utility and utility without relationship/leadership components. The sandbox reports whether social influence changed the selected action relative to that deterministic counterfactual ranking.

## Determinism and immutability

Candidate evaluation contains no random calls and does not mutate combat or personality state. Identical combat state, personality, learned preferences, and strategy produce an identical decision. Step execution and full autonomous execution share the same decision function.

## Known limitations

- Emotional state is persisted and scored but no emotion-update system exists yet.
- Team protection is limited to actions already supported by the combat engine.
- Enemy units use a neutral, balanced decision context because persistent enemy personalities are outside this task.
- Decision traces are intentionally not stored as long-term memories.
- Memory descriptions are deterministic templates populated only from structured observed facts; no dialogue or emotional interpretation is generated.
- Relationships do not implement romance, dialogue, or automatic friendship labels.
- Harmful social updates are limited to observed reckless self-endangerment. The current combat observations do not establish abandonment, intent, or responsibility for ally death.
- Protection, retreat, abandonment, and cooperative-targeting relationship events are deferred because the current combat action set cannot observe them reliably.
- Sandbox and Learning Laboratory combat can read copied profiles for inspection but never call the persistent memory commit boundary.
- Sandbox and Learning Laboratory can evaluate social state but never call the persistent relationship commit boundary.
- The memory duplicate fingerprint can rarely reject a new session through a hash collision; this is the bounded-storage trade-off.
- The relationship duplicate fingerprint has the same rare collision trade-off in exchange for fixed save growth.
- The project currently has no production progression battle route, so the persistent commit action is available but intentionally unused by the sandbox.
- TASK 005E cannot be triggered by normal gameplay until TASK 006 supplies a validated official-expedition authorization. Sandbox, replay, training, and laboratory results remain non-persistent.
- Browser local storage provides whole-value replacement but no true disk-level transaction or protection against deliberate offline tampering.
- Simulation reports use Wilson intervals for rates and conservative death attribution. A legal alternative is not labeled death-preventing without a controlled counterfactual replay.
- Large browser batches yield between chunks and support cancellation, but Node execution remains preferred for 10,000-battle performance work.
