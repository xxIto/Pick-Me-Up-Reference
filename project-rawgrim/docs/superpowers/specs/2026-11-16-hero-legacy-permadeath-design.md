# Hero Legacy, Permadeath, and Survivor Consequences Design

## Intent

TASK 005E introduces an explicit, irreversible hero-death boundary without turning sandbox combat into persistent gameplay. A combat unit reaching zero HP remains temporary combat state. A player-owned hero leaves the active roster only when a completed battle is accompanied by a validated official-expedition authorization contract and the resulting lifecycle proposal is committed successfully.

The implementation preserves each fallen hero as an independently readable memorial, applies bounded evidence-based consequences to survivors, and prepares a narrow integration point for TASK 006. It does not build Tower or Expedition gameplay.

## Goals

- Separate temporary combat defeat from permanent hero loss.
- Resolve all permadeath-related state changes as one validated proposal and one Zustand commit.
- Preserve identity, personality, learned behavior, memories, relationships, and known final facts in a memorial snapshot.
- Make repeated resolution requests idempotent.
- Clear formation and leadership references to fallen heroes.
- Produce deterministic, bounded survivor responses from observable evidence.
- Migrate legacy `Dead` roster entries into memorials without fabricating history.
- Expose Hall of the Fallen and survivor-condition UI using the existing design system.

## Non-goals

- No Tower, Expedition, rewards, XP, resurrection, inheritance bonus, reincarnation, backend, or cloud authority.
- No production control that directly kills a hero.
- No causal blame for a death unless the supplied structured observations support it.
- No full combat logs in persistent storage.
- No automatic transfer of a fallen hero's personality, learning, or memories.
- No complete recovery facility or therapy system.

## Existing Constraints and Audit Findings

- Active heroes currently use `Ready`, `Injured`, or `Dead`; `Dead` is excluded from deployment, but there is no official lifecycle transaction or memorial archive.
- `CombatUnit.alive === false` is temporary simulation state. Combat initialization and autonomous combat do not mutate the roster.
- Learning, memory formation, and relationship formation are pure-return domain operations behind separate store commit methods. An official death transaction must compose the pure operations directly rather than call several mutating store methods.
- Relationship formation already supports factual `ally-loss` events without assigning blame.
- Personality emotion (`fear`, `anger`, and `resolve`) is persisted, bounded to 0–100, and already influences Utility AI and leadership. No update or recovery owner currently exists.
- The save schema is version 6. Zustand persistence writes are not disk-atomic and the safe storage wrapper intentionally swallows ordinary persistence failures.
- `/archive` is currently the deterministic Combat Sandbox, not a memorial archive.

## Approaches Considered

### Selected: archived snapshot plus atomic in-memory resolution

Calculate the entire next state with pure functions, validate it, pre-write the complete save envelope, then apply it with one Zustand `set`. Fallen heroes leave the active roster and survive as standalone memorial snapshots. This keeps deployment queries simple, makes memorial identity independent, and matches TASK 006's future authoritative resolution boundary.

### Rejected: terminal heroes remain in the active roster

This requires every roster consumer to distinguish active and historical records forever. It also permits stale formation, leadership, gacha, and detail assumptions to leak into permanent-death behavior.

### Rejected: event-sourced lifecycle ledger

Replaying every lifecycle event provides stronger auditing but would require a broad persistence redesign. It is disproportionate for the local-storage MVP and outside TASK 005E.

## Lifecycle Model

The active `HeroInstance` model retains `Ready` and `Injured`. `Dead` remains accepted only for version-6 compatibility and migration input; version-7 runtime state contains no `Dead` hero in the active roster. No separate `FALLEN` and `ARCHIVED` active-roster states are introduced because the selected architecture has one terminal transition: active roster entry to immutable memorial record.

Lifecycle semantics:

1. A combat unit can become defeated without changing its `HeroInstance`.
2. An authorized official result can identify that participant as confirmed fallen.
3. The resolution pipeline creates the memorial from the post-battle adaptive snapshot, removes the hero from the roster, clears deployment and leadership references, and records the resolution ID.
4. The memorial remains readable and cannot be deployed.
5. A later summon using the same definition creates a new instance ID and receives no state from the memorial.

## Official Authorization Contract

The future expedition layer supplies a typed `OfficialDeathResolutionRequest` containing:

- stable `expeditionId`, `battleId`, and `resolutionId`;
- authorization kind fixed to `official-expedition`;
- encounter ID and optional known display label;
- combat seed and rules version;
- committed participant IDs and leader ID snapshot;
- finalized `CombatState` and `CombatExperience` from the same battle;
- explicit confirmation that the result is finalized;
- a structured death-context record derived only from combat events.

Validation requires a non-ongoing result, matching battle/session identity, exact committed participant membership, unique IDs, roster ownership, matching combat-unit `sourceId` values, and fallen IDs equal to allied participant units that ended with `alive === false`. A sandbox, replay, laboratory, training, or request without the `official-expedition` contract is rejected.

This contract is an application integrity boundary, not a security token. TypeScript and local storage cannot prevent a user from deliberately tampering with an offline save or executing modified client code.

## Memorial Schema

Each `HeroMemorialRecord` stores bounded, structured information:

- `id`, `heroInstanceId`, `definitionId`, and definition snapshot: name, class, rarity, portrait placeholder;
- final level, experience, and status;
- full normalized personality and learning snapshot;
- bounded significant-memory snapshot selected from the existing retained memory profile;
- bounded important-relationship snapshot and factual relationship histories already retained by TASK 005D;
- known achievements and expedition participation records, or empty collections when unsupported;
- verified death context: expedition, battle, encounter, seed, result, round, observed damage types, observed attacker source ID when the final damaging event proves it, and participating hero IDs;
- `provenance`: `official-resolution` or `legacy-import`;
- `historicalGaps` enumerating unavailable fields instead of invented prose;
- memorial creation order and the source resolution ID.

The archive does not store the full combat state, full event log, candidate-action traces, or definitions copied beyond what keeps the memorial readable.

Legacy `Dead` heroes are migrated to memorials with deterministic IDs, provenance `legacy-import`, unknown death context, no generated survivor effects, no invented achievements, and explicit historical gaps. They are removed from the active roster and any stale party or leader references are cleared.

## Survivor Response Model

Each active hero can own a bounded `SurvivorConsequenceProfile`. It contains a maximum of 20 persistent `SurvivorExperience` records and the processed resolution IDs needed to prevent duplicate application. Every record references one fallen hero and contains supported response dimensions, evidence summaries, and the temporary emotion delta that was applied.

Supported response dimensions are `grief`, `fear`, `anger`, `resolve`, and `numbness`, each clamped to 0–100. `guilt` is reserved in the type model but is not generated in TASK 005E because the current combat evidence cannot reliably establish responsibility. This avoids fabricating blame.

For survivor `s` and fallen hero `f`, normalized inputs are:

- `empathy = s.innate.empathy / 100`
- `selfPreservation = s.innate.selfPreservation / 100`
- `aggression = s.innate.aggression / 100`
- `discipline = s.innate.discipline / 100`
- `trust = clamp((relationship.trust + 100) / 200, 0, 1)`
- `affection = clamp((relationship.affection + 100) / 200, 0, 1)`
- `familiarity = relationship.familiarity / 100`
- `rivalry = relationship.rivalry / 100`
- `resentment = relationship.resentment / 100`
- `threat = maximum observed enemy threat from the finalized learning observations, clamped to 0–1`

Deterministic intensities use rounded weighted sums:

- `grief = 100 × clamp(0.30 empathy + 0.25 affection + 0.20 trust + 0.15 familiarity - 0.10 resentment, 0, 1)`
- `fear = 100 × clamp(0.35 selfPreservation + 0.30 threat + 0.20 (1 - discipline) + 0.15 existingFear, 0, 1)`
- `anger = 100 × clamp(0.35 aggression + 0.25 rivalry + 0.20 affection + 0.20 existingAnger, 0, 1)`
- `resolve = 100 × clamp(0.35 discipline + 0.25 courage + 0.20 trust + 0.20 existingResolve, 0, 1)`
- `numbness = 100 × clamp(0.40 discipline + 0.25 (1 - empathy) + 0.20 resentment + 0.15 priorLossExposure, 0, 1)`

`existingFear`, `existingAnger`, `existingResolve`, courage, and prior-loss exposure are normalized to 0–1. Missing relationships are neutral: trust and affection 0.5, familiarity/rivalry/resentment 0.

The dominant response is the highest intensity at or above 35, using stable priority `grief`, `fear`, `anger`, `resolve`, `numbness` for exact ties. If no response reaches 35, the experience is recorded as `restrained` without an emotional delta.

Temporary emotion changes are deliberately smaller than the persistent response score and clamped to 0–100:

- grief: fear +8, anger +2, resolve -6;
- fear: fear +12, resolve -5;
- anger: anger +12, fear -2;
- resolve: resolve +10, fear -4;
- numbness: fear -4, anger -4, resolve -2;
- restrained: no change.

Multiple deaths in one resolution are aggregated first. Their temporary emotion deltas are averaged, rounded, and applied once per survivor with clamping. Persistent experiences remain separate per fallen identity. This prevents order-dependent stacking.

## Recovery Contract

`applySurvivorRecovery(profile, personality, recoveryId)` is a pure extension point. A unique recovery ID can be processed once. One recovery step moves fear and anger down by at most 5 and moves resolve by at most 5 toward its neutral baseline of 50. It does not erase persistent survivor experiences, memories, or relationship history. TASK 005E exposes this contract but adds no player-facing recovery transaction.

## Signal Ownership and Resolution Order

One death event must not be processed independently by overlapping store actions. The authoritative pure pipeline uses this order:

1. Validate authorization, finalized combat result, identities, participants, and duplicate status.
2. Clone the relevant current state.
3. Apply ordinary completed-battle learning to participant snapshots, including fallen participants.
4. Form ordinary battle memories for each participant.
5. Form ordinary relationship updates, including the existing factual ally-loss history.
6. Create survivor death experiences and death-related factual memories; TASK 005E owns these death-specific signals.
7. Apply the single aggregated temporary emotional update to each survivor.
8. Create memorial snapshots for confirmed fallen heroes from their post-battle adaptive state.
9. Remove fallen heroes from the active roster and clear formation and leadership references.
10. Append the bounded processed-resolution record.
11. Validate the complete proposed state, including cross-references and archive uniqueness.
12. Persist the complete save envelope before exposing an in-memory success.
13. Commit the proposal through one Zustand update.

If validation or the pre-write fails, no Zustand gameplay state is changed. Browser storage does not provide a true multi-record transaction; this design writes one complete JSON envelope and does not claim disk-level atomicity. The in-memory commit is atomic at the Zustand state level. Rapid overlapping requests are rejected by an in-flight coordinator guard.

## Persistence and Migration

The game save schema advances from version 6 to version 7 and adds:

- `memorials: HeroMemorialRecord[]`;
- `processedLegacyResolutionIds: string[]`, capped at 128;
- optional bounded survivor profiles on active heroes.

Version-6 migration normalizes all adaptive profiles, converts every legacy `Dead` hero to a deterministic legacy memorial, removes it from the roster, clears its formation/leader reference, preserves crystals and every surviving hero, and starts the processed-resolution list empty. Versions 1–5 continue through their existing migration path and then receive the version-7 migration.

Version-7 validation rejects duplicate active IDs, duplicate memorial IDs, an identity appearing in both roster and archive, invalid owner IDs, invalid ranges, stale formation or leadership references, and malformed resolution records. Invalid current-version saves are not partially hydrated; the existing recovery path remains the fallback. The implementation will document that this fallback can lose an invalid imported save because no secondary recovery store exists.

## UI

- Keep `/archive` as the Combat Sandbox.
- Add `/fallen` for Hall of the Fallen and `/fallen/:memorialId` for memorial details.
- Add a separate `Hall of the Fallen` navigation item rather than silently replacing Combat Sandbox.
- Hall cards show the definition snapshot, final level, provenance, and only supported achievements/death facts.
- Detail view labels unavailable information as `Unknown` and separates observed facts from historical gaps.
- Hero Detail shows current survivor experiences and their bounded temporary effect.
- Roster and Party Formation consume only the active roster. No death button is added.
- Developer-only fixtures live in tests or an unlinked development module and never mutate the player save.

## Test Strategy

Pure tests cover temporary versus permanent death, authorization rejection, identity matching, duplicate/idempotent resolution, formation and leader cleanup, memorial preservation, legacy migration, bounded and personality-dependent survivor responses, deterministic recovery, no fabricated guilt/history, resummoned identity separation, and proposal immutability.

Integration tests use an injected persistence adapter to prove that failed validation or failed pre-write leaves the store state unchanged, overlapping requests are rejected, and successful repeated requests do not duplicate learning, memory, relationships, emotions, or memorials. Existing same-seed, step/auto equivalence, AI validity, persistence, gacha, and simulation suites remain regression gates.

## Known Limitations

- TASK 006 is still required to create genuine official-expedition authorization in production. Until then, normal gameplay cannot trigger permadeath.
- A local offline save cannot resist deliberate editing or modified client code.
- Local storage offers whole-value replacement but no durable transaction acknowledgement or rollback protocol.
- The current evidence supports factual death and observed attacker details only when combat events prove them; it does not support responsibility, preventability, or complete narrative cause.
- Achievement and expedition-history systems do not yet exist. Their memorial fields remain empty or unknown rather than fabricated.
- Recovery is a pure contract only; no recovery gameplay is introduced.
