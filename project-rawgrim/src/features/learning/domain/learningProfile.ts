import type { ActionCategory } from '../../ai/domain/actionCategory.ts';
import { LEARNING_FEATURE_KEYS } from './types.ts';
import type {
  ContextualActionWeights,
  LearningContextFeatures,
  LearningProfile,
  ProcessedBattleBits,
} from './types.ts';

export const LEARNING_PROFILE_VERSION = 1 as const;
export const LEARNING_CONTEXT_WEIGHT_LIMIT = 4;
const ACTION_CATEGORIES: readonly ActionCategory[] = ['offense', 'healing', 'defense', 'activeSkill'];

export function createZeroFeatureVector(): LearningContextFeatures {
  return {
    actorHpCritical: 0,
    actorHpLow: 0,
    actorHpMedium: 0,
    allySurvivalRisk: 0,
    enemyThreat: 0,
    offensiveOpportunity: 0,
    defensiveOpportunity: 0,
    healingOpportunity: 0,
  };
}

function createNeutralWeights(): ContextualActionWeights {
  return {
    offense: createZeroFeatureVector(),
    healing: createZeroFeatureVector(),
    defense: createZeroFeatureVector(),
    activeSkill: createZeroFeatureVector(),
  };
}

export function createNeutralLearningProfile(): LearningProfile {
  return {
    version: LEARNING_PROFILE_VERSION,
    contextWeights: createNeutralWeights(),
    processedBattleBits: [0, 0, 0, 0],
    battlesProcessed: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isLearningProfile(value: unknown): value is LearningProfile {
  if (!isRecord(value) || value.version !== LEARNING_PROFILE_VERSION || !isRecord(value.contextWeights)) {
    return false;
  }
  if (!Array.isArray(value.processedBattleBits) || value.processedBattleBits.length !== 4 ||
    !value.processedBattleBits.every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff_ffff)) {
    return false;
  }
  if (!isFiniteNumber(value.battlesProcessed) ||
    !Number.isSafeInteger(value.battlesProcessed) || value.battlesProcessed < 0) return false;
  return ACTION_CATEGORIES.every((category) => {
    const weights = value.contextWeights[category];
    return isRecord(weights) && LEARNING_FEATURE_KEYS.every((key) => isFiniteNumber(weights[key]));
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeFeatureVector(value: LearningContextFeatures): LearningContextFeatures {
  return Object.fromEntries(LEARNING_FEATURE_KEYS.map((key) => [
    key,
    Math.round(clamp(value[key], -LEARNING_CONTEXT_WEIGHT_LIMIT, LEARNING_CONTEXT_WEIGHT_LIMIT) * 10_000) / 10_000,
  ])) as LearningContextFeatures;
}

export function normalizeLearningProfile(value?: LearningProfile): LearningProfile {
  if (!value || !isLearningProfile(value)) return createNeutralLearningProfile();
  return {
    version: LEARNING_PROFILE_VERSION,
    contextWeights: {
      offense: normalizeFeatureVector(value.contextWeights.offense),
      healing: normalizeFeatureVector(value.contextWeights.healing),
      defense: normalizeFeatureVector(value.contextWeights.defense),
      activeSkill: normalizeFeatureVector(value.contextWeights.activeSkill),
    },
    processedBattleBits: value.processedBattleBits.map((part) => part >>> 0) as ProcessedBattleBits,
    battlesProcessed: value.battlesProcessed,
  };
}

export function cloneLearningProfile(value: LearningProfile): LearningProfile {
  return {
    ...value,
    contextWeights: {
      offense: { ...value.contextWeights.offense },
      healing: { ...value.contextWeights.healing },
      defense: { ...value.contextWeights.defense },
      activeSkill: { ...value.contextWeights.activeSkill },
    },
    processedBattleBits: [...value.processedBattleBits] as ProcessedBattleBits,
  };
}
