import type { ActionCategory } from '../../ai/domain/actionCategory.ts';
import { normalizeLearnedPreference } from '../../heroes/domain/personality.ts';
import type { HeroPersonalityState } from '../../heroes/domain/personalityTypes.ts';
import {
  cloneLearningProfile,
  LEARNING_CONTEXT_WEIGHT_LIMIT,
  normalizeLearningProfile,
} from './learningProfile.ts';
import { calculateLearningSignal } from './rewards.ts';
import { LEARNING_FEATURE_KEYS } from './types.ts';
import type {
  CombatExperience,
  LearningConfiguration,
  LearningContextFeatures,
  LearningProfile,
  LearningUpdate,
  LearningValidationResult,
  ProcessedBattleBits,
} from './types.ts';

export const DEFAULT_LEARNING_CONFIG: LearningConfiguration = {
  learningRate: 0.2,
  preferenceLimit: 10,
  contextWeightLimit: 4,
  preferenceScale: 2,
  contextScale: 1.5,
  rewardLimit: 1,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function validateLearningConfiguration(config: LearningConfiguration): LearningValidationResult {
  const errors: string[] = [];
  if (!Number.isFinite(config.learningRate) || config.learningRate < 0 || config.learningRate > 1) {
    errors.push('Learning rate must be between 0 and 1');
  }
  if (!Number.isFinite(config.preferenceLimit) || config.preferenceLimit <= 0 || config.preferenceLimit > 10) {
    errors.push('Preference limit must be greater than 0 and at most 10');
  }
  if (!Number.isFinite(config.contextWeightLimit) || config.contextWeightLimit <= 0 ||
    config.contextWeightLimit > LEARNING_CONTEXT_WEIGHT_LIMIT) {
    errors.push(`Context weight limit must be greater than 0 and at most ${LEARNING_CONTEXT_WEIGHT_LIMIT}`);
  }
  if (!Number.isFinite(config.preferenceScale) || config.preferenceScale < 0 || config.preferenceScale > 10) {
    errors.push('Preference scale must be between 0 and 10');
  }
  if (!Number.isFinite(config.contextScale) || config.contextScale < 0 || config.contextScale > 10) {
    errors.push('Context scale must be between 0 and 10');
  }
  if (!Number.isFinite(config.rewardLimit) || config.rewardLimit <= 0 || config.rewardLimit > 1) {
    errors.push('Reward limit must be greater than 0 and at most 1');
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

function hashSession(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function fingerprintIndexes(sessionId: string): readonly number[] {
  return [hashSession(sessionId, 2_166_136_261) % 128, hashSession(sessionId, 0x9e37_79b9) % 128];
}

function hasProcessedSession(profile: LearningProfile, sessionId: string): boolean {
  return fingerprintIndexes(sessionId).every((index) => {
    const bucket = Math.floor(index / 32);
    const mask = (1 << (index % 32)) >>> 0;
    return ((profile.processedBattleBits[bucket] >>> 0) & mask) !== 0;
  });
}

function markProcessedSession(profile: LearningProfile, sessionId: string): ProcessedBattleBits {
  const bits = [...profile.processedBattleBits] as ProcessedBattleBits;
  fingerprintIndexes(sessionId).forEach((index) => {
    const bucket = Math.floor(index / 32);
    const mask = (1 << (index % 32)) >>> 0;
    bits[bucket] = ((bits[bucket] >>> 0) | mask) >>> 0;
  });
  return bits;
}

export function calculateContextualLearnedContribution(
  personality: HeroPersonalityState,
  category: ActionCategory,
  context: LearningContextFeatures,
): number {
  const profile = normalizeLearningProfile(personality.learning);
  const contextual = LEARNING_FEATURE_KEYS.reduce(
    (sum, key) => sum + profile.contextWeights[category][key] * context[key],
    0,
  );
  return round(clamp(personality.learned[category] + contextual, -10, 10));
}

export interface LearningApplicationResult {
  personality: HeroPersonalityState;
  updates: readonly LearningUpdate[];
  duplicate: boolean;
}

export function applyCombatExperience(
  personality: HeroPersonalityState,
  experience: CombatExperience,
  config: LearningConfiguration = DEFAULT_LEARNING_CONFIG,
): LearningApplicationResult {
  const validation = validateLearningConfiguration(config);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  if (!experience.eligibleForLearning) return { personality, updates: [], duplicate: false };
  if (experience.outcome === 'ongoing') return { personality, updates: [], duplicate: false };

  const initialProfile = normalizeLearningProfile(personality.learning);
  if (hasProcessedSession(initialProfile, experience.sessionId)) {
    return { personality, updates: [], duplicate: true };
  }

  const profile = cloneLearningProfile(initialProfile);
  const learned = { ...personality.learned };
  const updates: LearningUpdate[] = [];
  const observations = experience.observations.filter(
    (observation) => observation.sessionId === experience.sessionId,
  );
  const effectiveLearningRate = config.learningRate / Math.max(1, observations.length);
  for (const observation of observations) {
    const signal = calculateLearningSignal(observation, experience.outcome);
    const boundedReward = clamp(signal.reward, -config.rewardLimit, config.rewardLimit);
    const category = observation.selectedCategory;
    const previousValue = normalizeLearnedPreference(learned[category]);
    const updatedValue = normalizeLearnedPreference(clamp(
      previousValue + effectiveLearningRate * boundedReward * config.preferenceScale,
      -config.preferenceLimit,
      config.preferenceLimit,
    ));
    learned[category] = updatedValue;
    const contextWeightChanges: LearningUpdate['contextWeightChanges'] = {};
    const normalizedContext = Object.fromEntries(LEARNING_FEATURE_KEYS.map((key) => [
      key,
      Number.isFinite(observation.context[key]) ? clamp(observation.context[key], 0, 1) : 0,
    ])) as LearningContextFeatures;
    for (const key of LEARNING_FEATURE_KEYS) {
      const previous = profile.contextWeights[category][key];
      const updated = round(clamp(
        previous + effectiveLearningRate * boundedReward * normalizedContext[key] * config.contextScale,
        -config.contextWeightLimit,
        config.contextWeightLimit,
      ));
      profile.contextWeights[category][key] = updated;
      if (updated !== previous) contextWeightChanges[key] = { previous, updated };
    }
    updates.push({
      heroInstanceId: observation.heroInstanceId,
      sessionId: experience.sessionId,
      category,
      context: normalizedContext,
      previousValue,
      updatedValue,
      contextWeightChanges,
      signal,
    });
  }
  profile.processedBattleBits = markProcessedSession(profile, experience.sessionId);
  profile.battlesProcessed = Math.min(Number.MAX_SAFE_INTEGER, profile.battlesProcessed + 1);
  return {
    personality: {
      ...personality,
      innate: { ...personality.innate },
      learned,
      emotion: { ...personality.emotion },
      learning: profile,
    },
    updates,
    duplicate: false,
  };
}
