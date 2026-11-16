import type { HeroInstance } from '../../heroes/domain/types.ts';
import { ensureHeroPersonality } from '../../heroes/domain/personality.ts';
import { heroDefinitions } from '../../heroes/data/heroDefinitions.ts';
import { getRelationship } from '../../social/domain/relationshipProfile.ts';
import type {
  EmotionDelta,
  SurvivorConsequenceProfile,
  SurvivorExperience,
  SurvivorResponse,
  SurvivorResponseScores,
} from './types.ts';
import {
  MAX_PROCESSED_DEATH_IDS,
  MAX_PROCESSED_RECOVERY_IDS,
  MAX_SURVIVOR_EXPERIENCES,
} from './types.ts';

type ScoredSurvivorResponse = Exclude<SurvivorResponse, 'restrained'>;
const RESPONSE_PRIORITY: readonly ScoredSurvivorResponse[] = ['grief', 'fear', 'anger', 'resolve', 'numbness'];

const EMOTION_DELTAS: Record<SurvivorResponse, EmotionDelta> = {
  grief: { fear: 8, anger: 2, resolve: -6 },
  fear: { fear: 12, anger: 0, resolve: -5 },
  anger: { fear: -2, anger: 12, resolve: 0 },
  resolve: { fear: -4, anger: 0, resolve: 10 },
  numbness: { fear: -4, anger: -4, resolve: -2 },
  restrained: { fear: 0, anger: 0, resolve: 0 },
};

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function score(value: number): number {
  return Math.round(clamp(value, 0, 1) * 100);
}

function retain<T>(items: readonly T[], maximum: number): readonly T[] {
  return items.length <= maximum ? items : items.slice(items.length - maximum);
}

export function createEmptySurvivorProfile(ownerHeroId: string): SurvivorConsequenceProfile {
  return {
    version: 1,
    ownerHeroId,
    experiences: [],
    processedDeathIds: [],
    processedRecoveryIds: [],
    nextEventOrder: 1,
  };
}

export interface SurvivorResponseResult {
  hero: HeroInstance;
  experience: SurvivorExperience | null;
  scores: SurvivorResponseScores;
  dominantResponse: SurvivorResponse;
  duplicate: boolean;
}

export interface SurvivorLossesResult {
  hero: HeroInstance;
  experiences: readonly SurvivorExperience[];
  duplicate: boolean;
}

export function calculateSurvivorResponse(
  hero: HeroInstance,
  fallenHeroId: string,
  resolutionId: string,
  threat: number,
  eventOrder: number,
): SurvivorResponseResult {
  const profile = hero.survivorConsequences ?? createEmptySurvivorProfile(hero.id);
  const deathId = `${resolutionId}:${fallenHeroId}`;
  const emptyScores: SurvivorResponseScores = {
    grief: 0, fear: 0, anger: 0, resolve: 0, numbness: 0, guilt: 0,
  };
  if (profile.processedDeathIds.includes(deathId)) {
    const existing = profile.experiences.find((entry) => entry.id === `survivor:${hero.id}:${deathId}`);
    return {
      hero,
      experience: existing ?? null,
      scores: existing?.scores ?? emptyScores,
      dominantResponse: existing?.dominantResponse ?? 'restrained',
      duplicate: true,
    };
  }

  const definition = heroDefinitions.find((entry) => entry.id === hero.definitionId);
  const personality = ensureHeroPersonality(hero, definition);
  const relationship = hero.relationships ? getRelationship(hero.relationships, fallenHeroId) : null;
  const trust = relationship ? clamp((relationship.trust + 100) / 200, 0, 1) : 0.5;
  const affection = relationship ? clamp((relationship.affection + 100) / 200, 0, 1) : 0.5;
  const familiarity = (relationship?.familiarity ?? 0) / 100;
  const rivalry = (relationship?.rivalry ?? 0) / 100;
  const resentment = (relationship?.resentment ?? 0) / 100;
  const empathy = personality.innate.empathy / 100;
  const selfPreservation = personality.innate.selfPreservation / 100;
  const aggression = personality.innate.aggression / 100;
  const discipline = personality.innate.discipline / 100;
  const courage = personality.innate.courage / 100;
  const existingFear = personality.emotion.fear / 100;
  const existingAnger = personality.emotion.anger / 100;
  const existingResolve = personality.emotion.resolve / 100;
  const priorLossExposure = clamp(profile.experiences.length / MAX_SURVIVOR_EXPERIENCES, 0, 1);
  const scores: SurvivorResponseScores = {
    grief: score(0.30 * empathy + 0.25 * affection + 0.20 * trust + 0.15 * familiarity - 0.10 * resentment),
    fear: score(0.35 * selfPreservation + 0.30 * clamp(threat, 0, 1) + 0.20 * (1 - discipline) + 0.15 * existingFear),
    anger: score(0.35 * aggression + 0.25 * rivalry + 0.20 * affection + 0.20 * existingAnger),
    resolve: score(0.35 * discipline + 0.25 * courage + 0.20 * trust + 0.20 * existingResolve),
    numbness: score(0.40 * discipline + 0.25 * (1 - empathy) + 0.20 * resentment + 0.15 * priorLossExposure),
    guilt: 0,
  };
  let dominantResponse: SurvivorResponse = 'restrained';
  let intensity = 34;
  for (const response of RESPONSE_PRIORITY) {
    if (scores[response] > intensity) {
      dominantResponse = response;
      intensity = scores[response];
    }
  }
  const emotionDelta = EMOTION_DELTAS[dominantResponse];
  const experience: SurvivorExperience = {
    id: `survivor:${hero.id}:${deathId}`,
    resolutionId,
    fallenHeroId,
    dominantResponse,
    intensity: dominantResponse === 'restrained' ? Math.max(...RESPONSE_PRIORITY.map((entry) => scores[entry])) : intensity,
    scores,
    emotionDelta,
    evidence: relationship
      ? ['Directed relationship history and personality dimensions were available.']
      : ['No directed relationship history was available; neutral social values were used.'],
    eventOrder,
  };
  const nextProfile: SurvivorConsequenceProfile = {
    ...profile,
    ownerHeroId: hero.id,
    experiences: retain([...profile.experiences, experience], MAX_SURVIVOR_EXPERIENCES),
    processedDeathIds: retain([...profile.processedDeathIds, deathId], MAX_PROCESSED_DEATH_IDS),
    nextEventOrder: Math.max(profile.nextEventOrder, eventOrder + 1),
  };
  return {
    hero: {
      ...hero,
      personality: {
        ...personality,
        emotion: {
          fear: clamp(personality.emotion.fear + emotionDelta.fear),
          anger: clamp(personality.emotion.anger + emotionDelta.anger),
          resolve: clamp(personality.emotion.resolve + emotionDelta.resolve),
        },
      },
      survivorConsequences: nextProfile,
    },
    experience,
    scores,
    dominantResponse,
    duplicate: false,
  };
}

export function applySurvivorLosses(
  hero: HeroInstance,
  fallenHeroIds: readonly string[],
  resolutionId: string,
  threat: number,
): SurvivorLossesResult {
  const profile = hero.survivorConsequences ?? createEmptySurvivorProfile(hero.id);
  const pendingFallenIds = [...new Set(fallenHeroIds)]
    .sort((left, right) => left.localeCompare(right))
    .filter((fallenHeroId) => !profile.processedDeathIds.includes(`${resolutionId}:${fallenHeroId}`));
  const experiences = pendingFallenIds.flatMap((fallenHeroId, index) => {
    const response = calculateSurvivorResponse(
      hero,
      fallenHeroId,
      resolutionId,
      threat,
      profile.nextEventOrder + index,
    );
    return response.duplicate || !response.experience ? [] : [response.experience];
  });
  if (experiences.length === 0) return { hero, experiences: [], duplicate: true };

  const personality = ensureHeroPersonality(
    hero,
    heroDefinitions.find((entry) => entry.id === hero.definitionId),
  );
  const averageDelta = (key: keyof EmotionDelta): number => Math.round(
    experiences.reduce((total, experience) => total + experience.emotionDelta[key], 0) /
    experiences.length,
  );
  const processedDeathIds = experiences.map((experience) =>
    `${experience.resolutionId}:${experience.fallenHeroId}`);

  return {
    duplicate: false,
    experiences,
    hero: {
      ...hero,
      personality: {
        ...personality,
        emotion: {
          fear: clamp(personality.emotion.fear + averageDelta('fear')),
          anger: clamp(personality.emotion.anger + averageDelta('anger')),
          resolve: clamp(personality.emotion.resolve + averageDelta('resolve')),
        },
      },
      survivorConsequences: {
        ...profile,
        ownerHeroId: hero.id,
        experiences: retain([...profile.experiences, ...experiences], MAX_SURVIVOR_EXPERIENCES),
        processedDeathIds: retain(
          [...profile.processedDeathIds, ...processedDeathIds],
          MAX_PROCESSED_DEATH_IDS,
        ),
        nextEventOrder: Math.max(profile.nextEventOrder, profile.nextEventOrder + experiences.length),
      },
    },
  };
}

export interface SurvivorRecoveryResult {
  hero: HeroInstance;
  duplicate: boolean;
}

export function applySurvivorRecovery(hero: HeroInstance, recoveryId: string): SurvivorRecoveryResult {
  const profile = hero.survivorConsequences ?? createEmptySurvivorProfile(hero.id);
  if (profile.processedRecoveryIds.includes(recoveryId)) return { hero, duplicate: true };
  const definition = heroDefinitions.find((entry) => entry.id === hero.definitionId);
  const personality = ensureHeroPersonality(hero, definition);
  const moveToward = (value: number, target: number): number => value < target
    ? Math.min(target, value + 5)
    : Math.max(target, value - 5);
  return {
    duplicate: false,
    hero: {
      ...hero,
      personality: {
        ...personality,
        emotion: {
          fear: Math.max(0, personality.emotion.fear - 5),
          anger: Math.max(0, personality.emotion.anger - 5),
          resolve: moveToward(personality.emotion.resolve, 50),
        },
      },
      survivorConsequences: {
        ...profile,
        processedRecoveryIds: retain(
          [...profile.processedRecoveryIds, recoveryId],
          MAX_PROCESSED_RECOVERY_IDS,
        ),
      },
    },
  };
}
