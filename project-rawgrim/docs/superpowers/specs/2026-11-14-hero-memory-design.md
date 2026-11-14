# Persistent Hero Memory Design

## Intent

Add bounded, deterministic episodic memory and observable enemy knowledge without turning memory into another learning system or storing full combat logs.

## Selected approach

Memory is a separate `HeroMemoryProfile` nested on each stable `HeroInstance`. Alternatives were rejected: putting memories inside `LearningProfile` mixes distinct responsibilities, while retaining combat logs creates unbounded saves. Profiles contain at most 100 significant episodes, 50 enemy knowledge entries, fixed-size processed-source fingerprints, and a deterministic sequence counter.

## Formation

Formation consumes completed eligible combat state, resolved events, and finalized learning observations. Supported episode templates are factual: near-death survival, meaningful rescue, first dangerous encounter, important victory, defeat, and repeated-encounter milestones. Social memory is limited to observable rescue interactions; unsupported categories produce no episode.

Significance is `round(100 × (0.30 severity + 0.25 personalRisk + 0.20 novelty + 0.15 outcomeImportance + 0.10 relevance))`, with each factor clamped to 0..1. Tactical usefulness is calculated separately during recall.

## Recall and Utility AI

Recall ranks episodes by enemy overlap, threat/survival similarity, action relevance, and significance. Stable memory ID breaks ties. Up to five memories are returned. Candidate memory utility is clamped to ±15 total. It does not reuse damage/healing reward values already consumed by learning; only episode type, current action category, current risk, and matching participants affect recall utility.

## Retention

When over capacity, pruning removes repetitive non-major episodes first, then lower significance and relevance, using event order only as a final tie-breaker. Unique milestones with significance at least 80 are preserved where possible. Enemy knowledge is pruned by low encounter count, low observation count, low recency, then stable ID.

## Persistence and boundaries

Save schema v5 migrates older heroes to independent empty profiles while preserving all prior state. Runtime normalization rejects malformed memories individually. Persistent formation is exposed through an explicit store action and is never called by sandbox, replay, or laboratory routes. Death never erases memory.

## Known limits

Enemy `sourceId` is the current stable category key because combat definitions do not yet expose taxonomy. Social memories do not change relationships. Milestones remain template-based and no death memorial is created.
