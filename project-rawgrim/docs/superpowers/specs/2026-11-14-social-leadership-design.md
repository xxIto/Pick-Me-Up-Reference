# Social Relationships, Leadership, and Party Dynamics Design

## Intent

TASK 005D makes deployed heroes socially distinct without introducing unsupported combat actions. Directional relationships evolve only from finalized observable combat evidence. Leadership and chemistry diagnose party behavior and modify Utility AI without changing combat stats or forcing actions.

## Goals and constraints

- Persist directed hero-instance relationships with bounded values and history.
- Derive relationship changes only from shared meaningful battles, observed rescues, observed reckless self-endangerment, major outcomes, and actual ally loss.
- Persist at most one eligible deployed leader and clear invalid active assignments without deleting relationship history.
- Calculate explainable leadership effectiveness and multi-axis party chemistry as pure functions.
- Add bounded relationship and leadership utility components while preserving action validity and deterministic tie-breaking.
- Keep sandbox and laboratory evaluation side-effect free.
- Preserve TASK 001–005C state through save version 6 migration.
- Do not add romance, dialogue, blame attribution, new combat actions, raw stat bonuses, or permanent-death lifecycle behavior.

## Approaches considered

1. A global relationship graph in the Zustand store. This centralizes traversal but separates identity data from the owned hero and makes archival/migration harder.
2. A directed `RelationshipProfile` on each `HeroInstance`. This follows the existing personality and memory ownership pattern, naturally preserves dead-hero edges, and limits decision-time lookup to the deployed party.
3. Symmetric party affinity records. This is smaller but violates the directional model and cannot express personality-dependent reactions.

Approach 2 is selected. Leadership remains a single persisted `leaderId` beside formation and strategy so `PartyFormation` retains its established slot-only contract.

## Relationship model

Each hero owns zero or more `HeroRelationship` edges to stable target hero IDs. Familiarity is 0–100. Trust, respect, and affection are -100–100 with 0 neutral. Rivalry and resentment are 0–100. Shared experience count is a non-negative integer. Each edge retains at most 20 deterministic history records; each hero retains at most 50 edges. A 256-bit session fingerprint prevents repeat processing without unbounded source IDs.

Formation runs only after a completed battle explicitly marked eligible. Battles below threat 0.4 do not grant shared-participation changes unless they end in defeat. Shared participation increases familiarity and experience, never automatic affection. A meaningful rescue requires the existing 005C thresholds: at least 25% target-max healing while ally risk is at least 0.75, with the target alive at battle end. Reckless reaction uses an actual `severeSelfEndangerment` observation: disciplined observers can lose trust/respect while aggressive observers can gain respect. Ally death creates factual history but assigns no blame.

## Leadership and chemistry

Leadership effectiveness is 0–100:

`0.25 discipline + 0.15 courage + 0.10 resolve + 0.15 experience + 0.20 incoming trust + 0.15 incoming respect`

Experience is bounded from hero level and processed learning battles. Incoming trust/respect are averages from deployed teammates toward the leader, normalized from -100–100 to 0–100. A missing, dead, unavailable, or undeployed leader is inactive and contributes zero.

Party chemistry exposes cohesion, coordination, conflict risk, and leadership stability separately. It averages only directed pairs among at most five deployed heroes. Cohesion uses trust, familiarity, affection, and personality compatibility. Coordination uses respect, familiarity, compatibility, and leadership effectiveness. Conflict risk uses rivalry, resentment, and personality friction. Leadership stability combines effectiveness with teammate trust. Chemistry never changes combat stats.

## AI integration

Relationship contribution is capped at ±8. It currently applies only to supported ally-targeted healing: trust and affection increase priority, resentment reduces it, while urgent healing remains dominated by base utility. If the same target-linked Social memory is recalled, relationship utility is halved to avoid applying the same rescue signal at full strength twice.

Leadership contribution is capped at ±10 and scales the existing strategy direction by leader effectiveness, actor discipline, actor trust toward the leader, leader availability in current combat, and party coordination. It modifies adherence rather than forcing behavior. Low-discipline actors retain autonomy. Candidate traces show strategy, learning, memory, relationship, and leadership separately.

## Persistence and UI

Save schema version 6 adds neutral relationship profiles and `leaderId: null` to older saves. Current data is runtime-normalized; invalid target references are removed while history involving valid dead roster heroes is preserved. Hero Details show directional edges and significant history. Party Formation provides leader selection plus chemistry indicators and conflict warnings. Combat Sandbox shows both new score components and social explanations.

## Known limitations

- Current actions support direct relationship influence only for healing; taunt, intercept, retreat, and formation movement do not exist.
- Recklessness is self-endangerment evidence, not proof that the actor endangered or abandoned teammates.
- Ally loss records no blame or trauma.
- Relationship updates are exposed at an explicit production commit boundary; the current sandbox and laboratory do not call it.
