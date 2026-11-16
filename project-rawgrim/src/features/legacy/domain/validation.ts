import { HERO_CLASSES, HERO_RARITIES } from '../../heroes/domain/types.ts';
import { validatePersonalityDimensions } from '../../heroes/domain/personality.ts';
import { isLearningProfile } from '../../learning/domain/learningProfile.ts';
import { validateEpisodicMemory } from '../../memory/domain/memoryProfile.ts';
import { validateHeroRelationship } from '../../social/domain/relationshipProfile.ts';
import type { HeroMemorialRecord, SurvivorConsequenceProfile, VerifiedDeathContext } from './types.ts';
import { MAX_PROCESSED_DEATH_IDS, MAX_PROCESSED_RECOVERY_IDS, MAX_SURVIVOR_EXPERIENCES, SURVIVOR_RESPONSES } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function isStringArray(value: unknown, maximum: number): value is string[] { return Array.isArray(value) && value.length <= maximum && value.every(isString); }
function isBounded(value: unknown, minimum = 0, maximum = 100): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum; }

function isPersonalitySnapshot(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.identityId) || !isString(value.innateTraitId) ||
    !isRecord(value.innate) || !isRecord(value.learned) || !isRecord(value.emotion)) return false;
  const innate = value.innate;
  const learned = value.learned;
  const emotion = value.emotion;
  return validatePersonalityDimensions({
    courage: innate.courage as number,
    discipline: innate.discipline as number,
    aggression: innate.aggression as number,
    empathy: innate.empathy as number,
    selfPreservation: innate.selfPreservation as number,
    ambition: innate.ambition as number,
    trust: innate.trust as number,
  }) && isBounded(learned.offense, -10, 10) && isBounded(learned.healing, -10, 10) &&
    isBounded(learned.defense, -10, 10) && isBounded(learned.activeSkill, -10, 10) &&
    isBounded(emotion.fear) && isBounded(emotion.anger) && isBounded(emotion.resolve) &&
    (value.learning === undefined || isLearningProfile(value.learning));
}

function isNullableString(value: unknown): boolean {
  return value === null || isString(value);
}

function isDeathContext(value: unknown): value is VerifiedDeathContext {
  if (!isRecord(value) || typeof value.known !== 'boolean' ||
    !isNullableString(value.expeditionId) || !isNullableString(value.battleId) ||
    !isNullableString(value.encounterId) || !isNullableString(value.encounterLabel) ||
    !(value.seed === null || Number.isSafeInteger(value.seed)) || !isNullableString(value.rulesVersion) ||
    !(value.outcome === null || value.outcome === 'victory' || value.outcome === 'defeat' || value.outcome === 'draw') ||
    !(value.round === null || (Number.isSafeInteger(value.round) && (value.round as number) >= 0)) ||
    !isNullableString(value.attackerSourceId) || !Array.isArray(value.observedDamageTypes) ||
    !value.observedDamageTypes.every((entry) => entry === 'physical' || entry === 'magical') ||
    !Array.isArray(value.participantHeroIds) || !value.participantHeroIds.every(isString)) return false;
  if (!value.known) {
    return value.expeditionId === null && value.battleId === null && value.encounterId === null &&
      value.seed === null && value.rulesVersion === null && value.outcome === null && value.round === null;
  }
  return isString(value.expeditionId) && isString(value.battleId) && isString(value.encounterId) &&
    Number.isSafeInteger(value.seed) && isString(value.rulesVersion) && value.outcome !== null &&
    Number.isSafeInteger(value.round) && value.participantHeroIds.length > 0;
}

export function isSurvivorConsequenceProfile(value: unknown, ownerHeroId: string): value is SurvivorConsequenceProfile {
  if (!isRecord(value) || value.version !== 1 || value.ownerHeroId !== ownerHeroId ||
    !Array.isArray(value.experiences) || value.experiences.length > MAX_SURVIVOR_EXPERIENCES ||
    !isStringArray(value.processedDeathIds, MAX_PROCESSED_DEATH_IDS) ||
    !isStringArray(value.processedRecoveryIds, MAX_PROCESSED_RECOVERY_IDS) ||
    !Number.isInteger(value.nextEventOrder) || (value.nextEventOrder as number) < 1) return false;
  return value.experiences.every((experience) => {
    if (!isRecord(experience) || !isString(experience.id) || !isString(experience.resolutionId) ||
      !isString(experience.fallenHeroId) || typeof experience.dominantResponse !== 'string' ||
      !SURVIVOR_RESPONSES.some((response) => response === experience.dominantResponse) ||
      !isBounded(experience.intensity) || !isRecord(experience.scores) || !isRecord(experience.emotionDelta) ||
      !Array.isArray(experience.evidence) || !experience.evidence.every((entry) => typeof entry === 'string') ||
      !Number.isInteger(experience.eventOrder) || (experience.eventOrder as number) < 1) return false;
    return isBounded(experience.scores.grief) && isBounded(experience.scores.fear) &&
      isBounded(experience.scores.anger) && isBounded(experience.scores.resolve) &&
      isBounded(experience.scores.numbness) && experience.scores.guilt === 0 &&
      isBounded(experience.emotionDelta.fear, -100, 100) &&
      isBounded(experience.emotionDelta.anger, -100, 100) &&
      isBounded(experience.emotionDelta.resolve, -100, 100);
  });
}

export function isHeroMemorialRecord(value: unknown): value is HeroMemorialRecord {
  if (!isRecord(value) || !isRecord(value.definition)) return false;
  const definition = value.definition;
  if (!isString(value.id) || !isString(value.heroInstanceId) || !isString(value.definitionId) ||
    !isString(definition.name) || !HERO_CLASSES.some((entry) => entry === definition.heroClass) ||
    !HERO_RARITIES.some((entry) => entry === definition.rarity) ||
    !isRecord(definition.portrait) || typeof definition.portrait.initials !== 'string' ||
    typeof definition.portrait.gradient !== 'string' || !Number.isInteger(value.finalLevel) ||
    (value.finalLevel as number) < 1 || !Number.isInteger(value.finalExperience) ||
    (value.finalExperience as number) < 0 || !isPersonalitySnapshot(value.personality) ||
    !Array.isArray(value.significantMemories) ||
    !value.significantMemories.every((memory) => validateEpisodicMemory(memory, value.heroInstanceId as string)) ||
    !Array.isArray(value.importantRelationships) ||
    !value.importantRelationships.every((relationship) =>
      validateHeroRelationship(relationship, value.heroInstanceId as string)) ||
    !Array.isArray(value.achievements) || !value.achievements.every((achievement) =>
      isRecord(achievement) && isString(achievement.id) && isString(achievement.title) && isString(achievement.sourceId)) ||
    !Array.isArray(value.expeditions) || !value.expeditions.every((expedition) =>
      isRecord(expedition) && isString(expedition.expeditionId) && isString(expedition.encounterId) &&
      (expedition.outcome === 'victory' || expedition.outcome === 'defeat' || expedition.outcome === 'draw')) ||
    !isDeathContext(value.deathContext) ||
    (value.provenance !== 'official-resolution' && value.provenance !== 'legacy-import') ||
    !Array.isArray(value.historicalGaps) || !value.historicalGaps.every((gap) =>
      gap === 'death-context' || gap === 'expedition-history' || gap === 'achievements' || gap === 'attacker') ||
    new Set(value.historicalGaps).size !== value.historicalGaps.length || !Number.isInteger(value.memorialOrder) ||
    (value.memorialOrder as number) < 1 || !(value.resolutionId === null || isString(value.resolutionId))) return false;
  if (value.provenance === 'official-resolution' && (!value.deathContext.known || !isString(value.resolutionId))) return false;
  if (value.provenance === 'legacy-import' && value.deathContext.known) return false;
  return true;
}
