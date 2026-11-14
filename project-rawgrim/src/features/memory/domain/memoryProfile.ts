import { MEMORY_CATEGORIES } from './types.ts';
import type {
  AggregatedEnemyKnowledge,
  EpisodicMemory,
  HeroMemoryProfile,
  MemoryConfiguration,
  MemoryConfigurationValidation,
  MemorySourceBits,
} from './types.ts';

export const DEFAULT_MEMORY_CONFIG: MemoryConfiguration = {
  maximumMemories: 100,
  maximumEnemyKnowledge: 50,
  maximumRecall: 5,
  maximumUtilityContribution: 15,
  minimumSignificance: 45,
  majorMilestoneSignificance: 80,
};

export function validateMemoryConfiguration(config: MemoryConfiguration): MemoryConfigurationValidation {
  const errors: string[] = [];
  if (!Number.isSafeInteger(config.maximumMemories) || config.maximumMemories < 1) {
    errors.push('Maximum memories must be a positive integer');
  }
  if (!Number.isSafeInteger(config.maximumEnemyKnowledge) || config.maximumEnemyKnowledge < 1) {
    errors.push('Maximum enemy knowledge must be a positive integer');
  }
  if (!Number.isSafeInteger(config.maximumRecall) || config.maximumRecall < 1 ||
    config.maximumRecall > config.maximumMemories) {
    errors.push('Maximum recall must be a positive integer within memory capacity');
  }
  if (!Number.isFinite(config.maximumUtilityContribution) || config.maximumUtilityContribution < 0) {
    errors.push('Maximum utility contribution must be a non-negative finite number');
  }
  if (!isFiniteRange(config.minimumSignificance, 0, 100)) {
    errors.push('Minimum significance must be between 0 and 100');
  }
  if (!isFiniteRange(config.majorMilestoneSignificance, 0, 100)) {
    errors.push('Major milestone significance must be between 0 and 100');
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function assertValidMemoryConfiguration(config: MemoryConfiguration): void {
  const validation = validateMemoryConfiguration(config);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
}

export function createEmptyMemoryProfile(ownerHeroId: string): HeroMemoryProfile {
  if (ownerHeroId.trim().length === 0) throw new Error('Memory profile owner is required');
  return {
    version: 1,
    ownerHeroId,
    memories: [],
    enemyKnowledge: [],
    processedSourceBits: [0, 0, 0, 0, 0, 0, 0, 0],
    nextEventOrder: 1,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function validateEpisodicMemory(value: unknown, ownerHeroId: string): value is EpisodicMemory {
  if (!isRecord(value) || !isRecord(value.context) || !isRecord(value.facts) || !isRecord(value.significance)) return false;
  const significance = value.significance;
  return typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.sourceId === 'string' && value.sourceId.length > 0 &&
    value.ownerHeroId === ownerHeroId &&
    typeof value.category === 'string' && MEMORY_CATEGORIES.some((category) => category === value.category) &&
    typeof value.title === 'string' && value.title.length > 0 &&
    typeof value.description === 'string' && value.description.length > 0 &&
    Array.isArray(value.participantIds) && value.participantIds.every((id) => typeof id === 'string') &&
    Array.isArray(value.relatedMemoryIds) && value.relatedMemoryIds.every((id) => typeof id === 'string') &&
    Number.isSafeInteger(value.eventOrder) && (value.eventOrder as number) >= 1 &&
    typeof value.context.sessionId === 'string' && value.context.sessionId.length > 0 &&
    (value.context.encounterLabel === undefined || typeof value.context.encounterLabel === 'string') &&
    Number.isSafeInteger(value.context.round) && (value.context.round as number) >= 0 &&
    Array.isArray(value.context.enemyCategoryIds) && value.context.enemyCategoryIds.every((id) => typeof id === 'string') &&
    (value.context.combatOutcome === 'ongoing' || value.context.combatOutcome === 'victory' ||
      value.context.combatOutcome === 'defeat' || value.context.combatOutcome === 'draw') &&
    Array.isArray(value.facts.enemyCategoryIds) && value.facts.enemyCategoryIds.every((id) => typeof id === 'string') &&
    (value.facts.outcome === undefined || value.facts.outcome === 'ongoing' || value.facts.outcome === 'victory' ||
      value.facts.outcome === 'defeat' || value.facts.outcome === 'draw') &&
    (value.facts.survivedCriticalHealth === undefined || typeof value.facts.survivedCriticalHealth === 'boolean') &&
    (value.facts.healingAmount === undefined || isFiniteRange(value.facts.healingAmount, 0, Number.MAX_SAFE_INTEGER)) &&
    (value.facts.targetHeroId === undefined || typeof value.facts.targetHeroId === 'string') &&
    (value.facts.targetEliminated === undefined || typeof value.facts.targetEliminated === 'boolean') &&
    (value.facts.repeatedEncounterCount === undefined ||
      (Number.isSafeInteger(value.facts.repeatedEncounterCount) && (value.facts.repeatedEncounterCount as number) >= 1)) &&
    isFiniteRange(value.context.threatLevel, 0, 1) &&
    isFiniteRange(significance.score, 0, 100) &&
    ['severity', 'personalRisk', 'novelty', 'outcomeImportance', 'relevance'].every(
      (key) => isFiniteRange(significance[key], 0, 1),
    );
}

function isKnowledge(value: unknown): value is AggregatedEnemyKnowledge {
  if (!isRecord(value)) return false;
  return typeof value.enemyCategoryId === 'string' && value.enemyCategoryId.length > 0 &&
    Number.isSafeInteger(value.encounterCount) && (value.encounterCount as number) >= 0 &&
    Array.isArray(value.observedAttackTypes) &&
    value.observedAttackTypes.every((type) => type === 'physical' || type === 'magical') &&
    Array.isArray(value.observedSkillIds) && value.observedSkillIds.every((id) => typeof id === 'string') &&
    Number.isSafeInteger(value.damageObservationCount) && (value.damageObservationCount as number) >= 0 &&
    isFiniteRange(value.totalObservedDamage, 0, Number.MAX_SAFE_INTEGER) &&
    isFiniteRange(value.maximumObservedDamage, 0, Number.MAX_SAFE_INTEGER) &&
    Number.isSafeInteger(value.lastObservedOrder) && (value.lastObservedOrder as number) >= 0;
}

function memoryRetentionRank(memory: EpisodicMemory, config: MemoryConfiguration): readonly [number, number, number, number, string] {
  const major = memory.category === 'Milestone' && memory.significance.score >= config.majorMilestoneSignificance ? 1 : 0;
  const repetitive = memory.category === 'Combat' ? 0 : 1;
  return [major, repetitive, memory.significance.score, memory.significance.relevance, memory.id];
}

function compareMemoryRetention(left: EpisodicMemory, right: EpisodicMemory, config: MemoryConfiguration): number {
  const a = memoryRetentionRank(left, config);
  const b = memoryRetentionRank(right, config);
  return b[0] - a[0] || b[1] - a[1] || b[2] - a[2] || b[3] - a[3] ||
    a[4].localeCompare(b[4]);
}

function compareKnowledgeRetention(left: AggregatedEnemyKnowledge, right: AggregatedEnemyKnowledge): number {
  return right.encounterCount - left.encounterCount ||
    right.damageObservationCount - left.damageObservationCount ||
    right.lastObservedOrder - left.lastObservedOrder ||
    left.enemyCategoryId.localeCompare(right.enemyCategoryId);
}

export function retainMemoryProfile(
  profile: HeroMemoryProfile,
  config: MemoryConfiguration = DEFAULT_MEMORY_CONFIG,
): HeroMemoryProfile {
  assertValidMemoryConfiguration(config);
  const memoryBySource = new Map<string, EpisodicMemory>();
  for (const memory of [...profile.memories].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || compareMemoryRetention(left, right, config))) {
    if (!memoryBySource.has(memory.sourceId)) memoryBySource.set(memory.sourceId, memory);
  }
  const uniqueMemories = [...memoryBySource.values()];
  const memories = uniqueMemories
    .sort((left, right) => compareMemoryRetention(left, right, config))
    .slice(0, config.maximumMemories)
    .sort((left, right) => left.eventOrder - right.eventOrder || left.id.localeCompare(right.id));
  const knowledgeByCategory = new Map<string, AggregatedEnemyKnowledge>();
  for (const knowledge of [...profile.enemyKnowledge].sort((left, right) =>
    left.enemyCategoryId.localeCompare(right.enemyCategoryId) || compareKnowledgeRetention(left, right))) {
    if (!knowledgeByCategory.has(knowledge.enemyCategoryId)) {
      knowledgeByCategory.set(knowledge.enemyCategoryId, knowledge);
    }
  }
  const enemyKnowledge = [...knowledgeByCategory.values()]
    .sort(compareKnowledgeRetention)
    .slice(0, config.maximumEnemyKnowledge)
    .sort((left, right) => left.enemyCategoryId.localeCompare(right.enemyCategoryId));
  return {
    ...profile,
    memories: memories.map((memory) => structuredClone(memory)),
    enemyKnowledge: enemyKnowledge.map((knowledge) => ({
      ...knowledge,
      observedAttackTypes: [...knowledge.observedAttackTypes],
      observedSkillIds: [...knowledge.observedSkillIds],
    })),
    processedSourceBits: [...profile.processedSourceBits] as MemorySourceBits,
  };
}

export function normalizeMemoryProfile(value: unknown, ownerHeroId: string): HeroMemoryProfile {
  if (!isRecord(value) || value.version !== 1 || value.ownerHeroId !== ownerHeroId ||
    !Array.isArray(value.memories) || !Array.isArray(value.enemyKnowledge) ||
    !Array.isArray(value.processedSourceBits) || value.processedSourceBits.length !== 8 ||
    !value.processedSourceBits.every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff_ffff) ||
    !Number.isSafeInteger(value.nextEventOrder) || (value.nextEventOrder as number) < 1) {
    return createEmptyMemoryProfile(ownerHeroId);
  }
  const profile: HeroMemoryProfile = {
    version: 1,
    ownerHeroId,
    memories: value.memories.filter((memory) => validateEpisodicMemory(memory, ownerHeroId)),
    enemyKnowledge: value.enemyKnowledge.filter(isKnowledge),
    processedSourceBits: value.processedSourceBits.map((part) => part >>> 0) as MemorySourceBits,
    nextEventOrder: Math.max(
      value.nextEventOrder as number,
      ...value.memories
        .filter((memory) => validateEpisodicMemory(memory, ownerHeroId))
        .map((memory) => memory.eventOrder + 1),
    ),
  };
  return retainMemoryProfile(profile);
}
