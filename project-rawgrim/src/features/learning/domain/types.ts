import type { ActionCategory } from '../../ai/domain/actionCategory.ts';
import type { CombatAction, CombatOutcome } from '../../combat/domain/types.ts';
import type { HeroClass } from '../../heroes/domain/types.ts';

export const LEARNING_FEATURE_KEYS = [
  'actorHpCritical',
  'actorHpLow',
  'actorHpMedium',
  'allySurvivalRisk',
  'enemyThreat',
  'offensiveOpportunity',
  'defensiveOpportunity',
  'healingOpportunity',
] as const;

export type LearningFeatureKey = (typeof LEARNING_FEATURE_KEYS)[number];
export type LearningContextFeatures = Record<LearningFeatureKey, number>;
export type ContextualActionWeights = Record<ActionCategory, LearningContextFeatures>;
export type ProcessedBattleBits = [number, number, number, number];

export interface LearningProfile {
  version: 1;
  contextWeights: ContextualActionWeights;
  processedBattleBits: ProcessedBattleBits;
  battlesProcessed: number;
}

export interface LearningOutcome {
  damageDealt: number;
  targetMaxHp: number;
  healingDone: number;
  healingCapacity: number;
  wastedHealing: number;
  targetEliminated: boolean;
  mitigatedDamage: number;
  actorMaxHp: number;
  severeSelfEndangerment: boolean;
  allyLosses: number;
}

export interface LearningObservation {
  heroInstanceId: string;
  sessionId: string;
  actorClass: HeroClass;
  context: LearningContextFeatures;
  selectedCategory: ActionCategory;
  validAlternativeCategories: readonly ActionCategory[];
  validCandidateActions: readonly CombatAction[];
  outcome: LearningOutcome;
}

export interface CombatExperience {
  sessionId: string;
  outcome: CombatOutcome;
  observations: readonly LearningObservation[];
  eligibleForLearning: boolean;
}

export interface LearningSignalComponents {
  damage: number;
  healing: number;
  wastedHealing: number;
  elimination: number;
  mitigation: number;
  selfEndangerment: number;
  allyLoss: number;
  battleOutcome: number;
}

export interface LearningSignal {
  reward: number;
  components: LearningSignalComponents;
  rationale: readonly string[];
}

export interface LearningUpdate {
  heroInstanceId: string;
  sessionId: string;
  category: ActionCategory;
  context: LearningContextFeatures;
  previousValue: number;
  updatedValue: number;
  contextWeightChanges: Partial<Record<LearningFeatureKey, { previous: number; updated: number }>>;
  signal: LearningSignal;
}

export interface LearningConfiguration {
  learningRate: number;
  preferenceLimit: number;
  contextWeightLimit: number;
  preferenceScale: number;
  contextScale: number;
  rewardLimit: number;
}

export type LearningValidationResult = { valid: true } | { valid: false; errors: readonly string[] };
