import type { HeroDefinition, HeroInstance } from './types.ts';
import type {
  EmotionalState,
  HeroPersonalityState,
  LearnedPreferences,
  PersonalityDimensions,
} from './personalityTypes.ts';

export type PersonalityRandom = () => number;

const DIMENSION_KEYS: readonly (keyof PersonalityDimensions)[] = [
  'courage', 'discipline', 'aggression', 'empathy', 'selfPreservation', 'ambition', 'trust',
];

export function normalizePersonalityValue(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeLearnedPreference(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(-10, Math.round(value)));
}

export function validatePersonalityDimensions(value: PersonalityDimensions): boolean {
  return DIMENSION_KEYS.every((key) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 100);
}

export function createNeutralLearnedPreferences(): LearnedPreferences {
  return { offense: 0, healing: 0, defense: 0, activeSkill: 0 };
}

export function createNeutralEmotionalState(): EmotionalState {
  return { fear: 25, anger: 25, resolve: 50 };
}

function readPersonalityRandom(random: PersonalityRandom): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Personality random source must return values from 0 inclusive to 1 exclusive');
  }
  return value;
}

export function generatePersonality(
  identityId: string,
  innateTraitId: string,
  random: PersonalityRandom,
): HeroPersonalityState {
  const nextDimension = () => Math.floor(readPersonalityRandom(random) * 101);
  const dimensions: PersonalityDimensions = {
    courage: nextDimension(),
    discipline: nextDimension(),
    aggression: nextDimension(),
    empathy: nextDimension(),
    selfPreservation: nextDimension(),
    ambition: nextDimension(),
    trust: nextDimension(),
  };
  return {
    identityId,
    innateTraitId,
    innate: dimensions,
    learned: createNeutralLearnedPreferences(),
    emotion: createNeutralEmotionalState(),
  };
}

function hashIdentity(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededPersonalityRandom(seed: number): PersonalityRandom {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function migrateLegacyPersonality(heroId: string, innateTraitId = 'legacy-identity'): HeroPersonalityState {
  return generatePersonality(
    `personality:${heroId}`,
    innateTraitId,
    seededPersonalityRandom(hashIdentity(`${heroId}:${innateTraitId}`)),
  );
}

export function ensureHeroPersonality(
  instance: HeroInstance,
  definition?: HeroDefinition,
): HeroPersonalityState {
  return instance.personality ?? migrateLegacyPersonality(instance.id, definition?.trait.id);
}

export function normalizeHeroPersonality(value: HeroPersonalityState): HeroPersonalityState {
  return {
    identityId: value.identityId,
    innateTraitId: value.innateTraitId,
    innate: {
      courage: normalizePersonalityValue(value.innate.courage),
      discipline: normalizePersonalityValue(value.innate.discipline),
      aggression: normalizePersonalityValue(value.innate.aggression),
      empathy: normalizePersonalityValue(value.innate.empathy),
      selfPreservation: normalizePersonalityValue(value.innate.selfPreservation),
      ambition: normalizePersonalityValue(value.innate.ambition),
      trust: normalizePersonalityValue(value.innate.trust),
    },
    learned: {
      offense: normalizeLearnedPreference(value.learned.offense),
      healing: normalizeLearnedPreference(value.learned.healing),
      defense: normalizeLearnedPreference(value.learned.defense),
      activeSkill: normalizeLearnedPreference(value.learned.activeSkill),
    },
    emotion: {
      fear: normalizePersonalityValue(value.emotion.fear),
      anger: normalizePersonalityValue(value.emotion.anger),
      resolve: normalizePersonalityValue(value.emotion.resolve),
    },
  };
}
