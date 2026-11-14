import type { CombatDamageType, CombatOutcome, CombatUnit } from '../../combat/domain/types.ts';
import type { LearningObservation } from '../../learning/domain/types.ts';
import { assertValidMemoryConfiguration, DEFAULT_MEMORY_CONFIG, retainMemoryProfile } from './memoryProfile.ts';
import { calculateMemorySignificance } from './significance.ts';
import type {
  AggregatedEnemyKnowledge,
  EpisodicMemory,
  HeroMemoryProfile,
  MemoryCategory,
  MemoryConfiguration,
  MemoryContext,
  MemoryFormationResult,
  MemoryFormationSource,
  MemoryObservedFacts,
  MemorySignificance,
  MemorySourceBits,
} from './types.ts';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sourceHash(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619) >>> 0;
  }
  return hash;
}

function sourcePositions(sourceId: string): readonly number[] {
  return [sourceHash(sourceId, 2_166_136_261) % 256, sourceHash(sourceId, 2_654_435_761) % 256];
}

function hasProcessedSource(bits: MemorySourceBits, sourceId: string): boolean {
  return sourcePositions(sourceId).every((position) =>
    (bits[Math.floor(position / 32)] & (1 << (position % 32))) !== 0,
  );
}

function markProcessedSource(bits: MemorySourceBits, sourceId: string): MemorySourceBits {
  const next = [...bits] as MemorySourceBits;
  for (const position of sourcePositions(sourceId)) {
    const index = Math.floor(position / 32);
    next[index] = (next[index] | (1 << (position % 32))) >>> 0;
  }
  return next;
}

function threatLevel(source: MemoryFormationSource): number {
  const observations = source.experience.observations.filter(
    (observation) => observation.heroInstanceId === source.heroInstanceId &&
      observation.sessionId === source.sessionId,
  );
  return clamp01(Math.max(0, ...observations.map((observation) => observation.context.enemyThreat)));
}

function memoryContext(source: MemoryFormationSource, enemyCategoryIds: readonly string[]): MemoryContext {
  return {
    sessionId: source.sessionId,
    round: source.finalState.result.completedRound,
    ...(source.encounterLabel ? { encounterLabel: source.encounterLabel } : {}),
    enemyCategoryIds,
    combatOutcome: source.finalState.result.outcome,
    threatLevel: threatLevel(source),
  };
}

interface MemoryDraft {
  suffix: string;
  category: MemoryCategory;
  title: string;
  description: string;
  participants: readonly string[];
  facts: MemoryObservedFacts;
  significance: MemorySignificance;
  round?: number;
}

function createMemory(
  source: MemoryFormationSource,
  context: MemoryContext,
  draft: MemoryDraft,
  eventOrder: number,
): EpisodicMemory {
  const sourceId = `${source.sessionId}:${draft.suffix}`;
  return {
    id: `memory:${source.heroInstanceId}:${sourceId}`,
    ownerHeroId: source.heroInstanceId,
    sourceId,
    category: draft.category,
    title: draft.title,
    description: draft.description,
    participantIds: uniqueSorted(draft.participants),
    context: { ...context, round: draft.round ?? context.round },
    facts: { ...draft.facts, enemyCategoryIds: [...draft.facts.enemyCategoryIds] },
    significance: { ...draft.significance },
    eventOrder,
    relatedMemoryIds: [],
  };
}

function outcomeImportance(outcome: CombatOutcome): number {
  return outcome === 'victory' || outcome === 'defeat' ? 1 : outcome === 'draw' ? 0.6 : 0;
}

function updateEnemyKnowledge(
  profile: HeroMemoryProfile,
  source: MemoryFormationSource,
  enemies: readonly CombatUnit[],
): AggregatedEnemyKnowledge[] {
  const byCategory = new Map(profile.enemyKnowledge.map((entry) => [entry.enemyCategoryId, entry]));
  for (const enemy of enemies) {
    const previous = byCategory.get(enemy.sourceId);
    const damageEvents = source.finalState.events.filter(
      (event) => event.type === 'damage' && event.actorId === enemy.id && typeof event.amount === 'number',
    );
    const attackTypes = uniqueSorted([
      ...(previous?.observedAttackTypes ?? []),
      ...damageEvents.flatMap((event) => event.damageType ? [event.damageType] : []),
    ]) as CombatDamageType[];
    const skillIds = uniqueSorted([
      ...(previous?.observedSkillIds ?? []),
      ...damageEvents.flatMap((event) => event.skillId ? [event.skillId] : []),
    ]);
    const observedDamage = damageEvents.reduce((total, event) => total + (event.amount ?? 0), 0);
    const maximumDamage = Math.max(0, ...damageEvents.map((event) => event.amount ?? 0));
    byCategory.set(enemy.sourceId, {
      enemyCategoryId: enemy.sourceId,
      encounterCount: (previous?.encounterCount ?? 0) + 1,
      observedAttackTypes: attackTypes,
      observedSkillIds: skillIds,
      damageObservationCount: (previous?.damageObservationCount ?? 0) + damageEvents.length,
      totalObservedDamage: (previous?.totalObservedDamage ?? 0) + observedDamage,
      maximumObservedDamage: Math.max(previous?.maximumObservedDamage ?? 0, maximumDamage),
      lastObservedOrder: profile.nextEventOrder,
    });
  }
  return [...byCategory.values()];
}

function createOutcomeDraft(
  source: MemoryFormationSource,
  enemyCategoryIds: readonly string[],
  personalRisk: number,
  profile: HeroMemoryProfile,
): MemoryDraft | null {
  const outcome = source.finalState.result.outcome;
  if (outcome !== 'victory' && outcome !== 'defeat') return null;
  const victory = outcome === 'victory';
  const previouslyRemembered = profile.memories.some((memory) =>
    memory.facts.outcome === outcome &&
    memory.context.enemyCategoryIds.some((enemyId) => enemyCategoryIds.includes(enemyId)),
  );
  if (victory && previouslyRemembered && threatLevel(source) < 0.6 && personalRisk < 0.65) return null;
  return {
    suffix: 'result', category: victory ? 'Achievement' : 'Failure',
    title: victory ? 'Victory remembered' : 'Defeat remembered',
    description: victory
      ? `The party prevailed in ${source.encounterLabel ?? 'the encounter'}.`
      : `The party was defeated in ${source.encounterLabel ?? 'the encounter'}.`,
    participants: enemyCategoryIds, facts: { outcome, enemyCategoryIds },
    significance: calculateMemorySignificance({
      severity: threatLevel(source), personalRisk, novelty: previouslyRemembered ? 0.25 : 1,
      outcomeImportance: 1, relevance: 1,
    }),
  };
}

function createSurvivalDraft(
  source: MemoryFormationSource,
  observations: readonly LearningObservation[],
  enemyCategoryIds: readonly string[],
): MemoryDraft | null {
  const critical = observations.find((observation) => observation.context.actorHpCritical > 0);
  const hero = source.finalState.units.find((unit) => unit.sourceId === source.heroInstanceId);
  if (!critical || !hero?.alive) return null;
  return {
    suffix: 'survival', category: 'Survival', title: 'Survived the brink',
    description: `Survived ${source.encounterLabel ?? 'the encounter'} after acting at critical health.`,
    participants: enemyCategoryIds,
    facts: { survivedCriticalHealth: true, outcome: source.finalState.result.outcome, enemyCategoryIds },
    significance: calculateMemorySignificance({
      severity: 1, personalRisk: 1, novelty: 0.9,
      outcomeImportance: outcomeImportance(source.finalState.result.outcome), relevance: 1,
    }),
    round: critical.round,
  };
}

function createSocialDrafts(
  source: MemoryFormationSource,
  observations: readonly LearningObservation[],
  enemyCategoryIds: readonly string[],
): MemoryDraft[] {
  return observations.flatMap((observation) => {
    const healingRatio = observation.outcome.healingDone / Math.max(1, observation.outcome.targetMaxHp);
    if (observation.selectedCategory !== 'healing' || observation.context.allySurvivalRisk < 0.75 || healingRatio < 0.25) return [];
    const target = source.finalState.units.find((unit) => unit.id === observation.selectedAction.targetId);
    if (!target?.alive || target.sourceId === source.heroInstanceId) return [];
    return [{
      suffix: `rescue:${observation.observationSequence}`, category: 'Social' as const,
      title: `Rescued ${target.name}`,
      description: `Restored ${observation.outcome.healingDone} health while ${target.name} faced severe danger.`,
      participants: [target.sourceId],
      facts: {
        healingAmount: observation.outcome.healingDone, targetHeroId: target.sourceId,
        targetEliminated: false, enemyCategoryIds,
      },
      significance: calculateMemorySignificance({
        severity: observation.context.allySurvivalRisk,
        personalRisk: observation.context.actorHpCritical,
        novelty: 0.8, outcomeImportance: outcomeImportance(source.finalState.result.outcome), relevance: 1,
      }),
      round: observation.round,
    }];
  });
}

function createEncounterDrafts(
  source: MemoryFormationSource,
  previousProfile: HeroMemoryProfile,
  updatedKnowledge: readonly AggregatedEnemyKnowledge[],
  enemyCategoryIds: readonly string[],
): MemoryDraft[] {
  return enemyCategoryIds.flatMap((enemyId) => {
    const previous = previousProfile.enemyKnowledge.find((entry) => entry.enemyCategoryId === enemyId);
    const current = updatedKnowledge.find((entry) => entry.enemyCategoryId === enemyId);
    if (!current) return [];
    const drafts: MemoryDraft[] = [];
    if (!previous && threatLevel(source) >= 0.6) {
      drafts.push({
        suffix: `encounter:${enemyId}`, category: 'Combat', title: `First clash with ${enemyId}`,
        description: `Observed ${enemyId} as a significant threat in ${source.encounterLabel ?? 'combat'}.`,
        participants: [enemyId], facts: { enemyCategoryIds: [enemyId], repeatedEncounterCount: 1 },
        significance: calculateMemorySignificance({
          severity: threatLevel(source), personalRisk: 0.5, novelty: 1,
          outcomeImportance: outcomeImportance(source.finalState.result.outcome), relevance: 0.8,
        }),
      });
    }
    if (current.encounterCount === 3) {
      drafts.push({
        suffix: `repeat:${enemyId}:3`, category: 'Milestone', title: `A familiar enemy: ${enemyId}`,
        description: `Encountered ${enemyId} for the third recorded time.`, participants: [enemyId],
        facts: { enemyCategoryIds: [enemyId], repeatedEncounterCount: 3 },
        significance: calculateMemorySignificance({
          severity: threatLevel(source), personalRisk: 0.5, novelty: 0.5, outcomeImportance: 0.8, relevance: 1,
        }),
      });
    }
    return drafts;
  });
}

export function formHeroMemories(
  profile: HeroMemoryProfile,
  source: MemoryFormationSource,
  config: MemoryConfiguration = DEFAULT_MEMORY_CONFIG,
): MemoryFormationResult {
  assertValidMemoryConfiguration(config);
  if (profile.ownerHeroId !== source.heroInstanceId) throw new Error('Memory profile owner does not match formation source');
  if (source.sessionId !== source.experience.sessionId) throw new Error('Memory session does not match combat experience');
  if (source.experience.outcome !== source.finalState.result.outcome) {
    throw new Error('Memory experience outcome does not match finalized combat state');
  }
  if (!source.eligibleForPersistence || source.finalState.result.outcome === 'ongoing') {
    return { profile, createdMemories: [], duplicate: false };
  }
  if (hasProcessedSource(profile.processedSourceBits, source.sessionId)) {
    return { profile, createdMemories: [], duplicate: true };
  }

  const enemies = source.finalState.units.filter((unit) => unit.side === 'enemies');
  const enemyCategoryIds = uniqueSorted(enemies.map((enemy) => enemy.sourceId));
  const observations = source.experience.observations.filter(
    (observation) => observation.heroInstanceId === source.heroInstanceId &&
      observation.sessionId === source.sessionId,
  );
  const criticalRisk = observations.some((observation) => observation.context.actorHpCritical > 0) ? 1 :
    observations.some((observation) => observation.context.actorHpLow > 0) ? 0.65 : 0.2;
  const context = memoryContext(source, enemyCategoryIds);
  const updatedKnowledge = updateEnemyKnowledge(profile, source, enemies);
  const drafts = [
    createOutcomeDraft(source, enemyCategoryIds, criticalRisk, profile),
    createSurvivalDraft(source, observations, enemyCategoryIds),
    ...createSocialDrafts(source, observations, enemyCategoryIds),
    ...createEncounterDrafts(source, profile, updatedKnowledge, enemyCategoryIds),
  ].filter((draft): draft is MemoryDraft => draft !== null)
    .filter((draft) => draft.significance.score >= config.minimumSignificance);
  const createdMemories = drafts.map((draft, index) =>
    createMemory(source, context, draft, profile.nextEventOrder + index),
  );
  const nextProfile = retainMemoryProfile({
    ...profile,
    memories: [...profile.memories, ...createdMemories],
    enemyKnowledge: updatedKnowledge,
    processedSourceBits: markProcessedSource(profile.processedSourceBits, source.sessionId),
    nextEventOrder: profile.nextEventOrder + Math.max(1, createdMemories.length),
  }, config);
  return { profile: nextProfile, createdMemories, duplicate: false };
}
