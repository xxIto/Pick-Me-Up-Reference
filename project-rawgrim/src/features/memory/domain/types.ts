import type { ActionCategory } from '../../ai/domain/actionCategory.ts';
import type { CombatDamageType, CombatOutcome, CombatState } from '../../combat/domain/types.ts';
import type { CombatExperience } from '../../learning/domain/types.ts';

export const MEMORY_CATEGORIES = ['Combat', 'Survival', 'Achievement', 'Failure', 'Social', 'Milestone'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface MemorySignificance {
  score: number;
  severity: number;
  personalRisk: number;
  novelty: number;
  outcomeImportance: number;
  relevance: number;
}

export interface MemoryContext {
  sessionId: string;
  round: number;
  encounterLabel?: string;
  enemyCategoryIds: readonly string[];
  combatOutcome: CombatOutcome;
  threatLevel: number;
}

export interface MemoryObservedFacts {
  outcome?: CombatOutcome;
  survivedCriticalHealth?: boolean;
  healingAmount?: number;
  targetHeroId?: string;
  targetEliminated?: boolean;
  enemyCategoryIds: readonly string[];
  repeatedEncounterCount?: number;
}

export interface EpisodicMemory {
  id: string;
  ownerHeroId: string;
  sourceId: string;
  category: MemoryCategory;
  title: string;
  description: string;
  participantIds: readonly string[];
  context: MemoryContext;
  facts: MemoryObservedFacts;
  significance: MemorySignificance;
  eventOrder: number;
  relatedMemoryIds: readonly string[];
}

export interface AggregatedEnemyKnowledge {
  enemyCategoryId: string;
  encounterCount: number;
  observedAttackTypes: readonly CombatDamageType[];
  observedSkillIds: readonly string[];
  damageObservationCount: number;
  totalObservedDamage: number;
  maximumObservedDamage: number;
  lastObservedOrder: number;
}

export type MemorySourceBits = [number, number, number, number, number, number, number, number];

export interface HeroMemoryProfile {
  version: 1;
  ownerHeroId: string;
  memories: readonly EpisodicMemory[];
  enemyKnowledge: readonly AggregatedEnemyKnowledge[];
  processedSourceBits: MemorySourceBits;
  nextEventOrder: number;
}

export interface MemoryConfiguration {
  maximumMemories: number;
  maximumEnemyKnowledge: number;
  maximumRecall: number;
  maximumUtilityContribution: number;
  minimumSignificance: number;
  majorMilestoneSignificance: number;
}

export type MemoryConfigurationValidation =
  | { valid: true }
  | { valid: false; errors: readonly string[] };

export interface MemoryFormationSource {
  heroInstanceId: string;
  sessionId: string;
  finalState: CombatState;
  experience: CombatExperience;
  eligibleForPersistence: boolean;
  encounterLabel?: string;
}

export interface MemoryFormationResult {
  profile: HeroMemoryProfile;
  createdMemories: readonly EpisodicMemory[];
  duplicate: boolean;
}

export interface MemoryRecallContext {
  heroInstanceId: string;
  enemyCategoryIds: readonly string[];
  participantIds: readonly string[];
  threatLevel: number;
  actorHpBand: 'critical' | 'low' | 'medium';
  actionCategory: ActionCategory;
  allySurvivalRisk: number;
}

export interface MemoryContribution {
  memory: EpisodicMemory;
  relevanceScore: number;
  utilityContribution: number;
  explanation: readonly string[];
}

export interface MemoryRecallResult {
  memories: readonly MemoryContribution[];
  totalUtilityContribution: number;
}
