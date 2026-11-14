import { RELATIONSHIP_EVENT_TYPES } from './types.ts';
import type {
  HeroRelationship,
  RelationshipConfiguration,
  RelationshipConfigurationValidation,
  RelationshipEvent,
  RelationshipProfile,
  RelationshipSourceBits,
} from './types.ts';

export const DEFAULT_RELATIONSHIP_CONFIG: RelationshipConfiguration = {
  maximumRelationships: 50,
  maximumHistoryPerRelationship: 20,
  minimumSharedBattleThreat: 0.4,
  maximumRelationshipUtility: 8,
  maximumLeadershipUtility: 10,
};

export function validateRelationshipConfiguration(
  config: RelationshipConfiguration,
): RelationshipConfigurationValidation {
  const errors: string[] = [];
  if (!Number.isSafeInteger(config.maximumRelationships) || config.maximumRelationships < 1) {
    errors.push('Maximum relationships must be a positive integer');
  }
  if (!Number.isSafeInteger(config.maximumHistoryPerRelationship) || config.maximumHistoryPerRelationship < 1) {
    errors.push('Maximum relationship history must be a positive integer');
  }
  if (!inRange(config.minimumSharedBattleThreat, 0, 1)) {
    errors.push('Minimum shared-battle threat must be between 0 and 1');
  }
  if (!Number.isFinite(config.maximumRelationshipUtility) || config.maximumRelationshipUtility < 0) {
    errors.push('Maximum relationship utility must be a non-negative finite number');
  }
  if (!Number.isFinite(config.maximumLeadershipUtility) || config.maximumLeadershipUtility < 0) {
    errors.push('Maximum leadership utility must be a non-negative finite number');
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function assertValidRelationshipConfiguration(config: RelationshipConfiguration): void {
  const result = validateRelationshipConfiguration(config);
  if (!result.valid) throw new Error(result.errors.join('; '));
}

export function createEmptyRelationshipProfile(ownerHeroId: string): RelationshipProfile {
  if (ownerHeroId.trim().length === 0) throw new Error('Relationship profile owner is required');
  return {
    version: 1,
    ownerHeroId,
    relationships: [],
    processedSourceBits: [0, 0, 0, 0, 0, 0, 0, 0],
    nextEventOrder: 1,
  };
}

export function getRelationship(
  profile: RelationshipProfile,
  targetHeroId: string,
): HeroRelationship | null {
  return profile.relationships.find((relationship) => relationship.targetHeroId === targetHeroId) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isRelationshipEvent(value: unknown, ownerHeroId: string, targetHeroId: string): value is RelationshipEvent {
  if (!isRecord(value) || !isRecord(value.changes)) return false;
  const allowedChanges = new Set([
    'familiarity', 'trust', 'respect', 'affection', 'rivalry', 'resentment', 'sharedExperienceCount',
  ]);
  const validChanges = Object.entries(value.changes).every(([key, change]) =>
    allowedChanges.has(key) && typeof change === 'number' && Number.isFinite(change) &&
    (key !== 'sharedExperienceCount' || Number.isSafeInteger(change)));
  return typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.sourceId === 'string' && value.sourceId.length > 0 &&
    typeof value.type === 'string' && RELATIONSHIP_EVENT_TYPES.some((type) => type === value.type) &&
    value.ownerHeroId === ownerHeroId && value.targetHeroId === targetHeroId &&
    typeof value.sessionId === 'string' && value.sessionId.length > 0 &&
    Number.isSafeInteger(value.round) && (value.round as number) >= 0 &&
    Array.isArray(value.memoryIds) && value.memoryIds.every((id) => typeof id === 'string') &&
    typeof value.description === 'string' && value.description.length > 0 &&
    Number.isSafeInteger(value.eventOrder) && (value.eventOrder as number) >= 1 && validChanges;
}

function isRelationship(value: unknown, ownerHeroId: string): value is HeroRelationship {
  if (!isRecord(value) || typeof value.targetHeroId !== 'string' || value.targetHeroId.length === 0 ||
    value.targetHeroId === ownerHeroId || !Array.isArray(value.history)) return false;
  return inRange(value.familiarity, 0, 100) &&
    inRange(value.trust, -100, 100) && inRange(value.respect, -100, 100) &&
    inRange(value.affection, -100, 100) && inRange(value.rivalry, 0, 100) &&
    inRange(value.resentment, 0, 100) &&
    Number.isSafeInteger(value.sharedExperienceCount) && (value.sharedExperienceCount as number) >= 0 &&
    value.history.every((event) => isRelationshipEvent(event, ownerHeroId, value.targetHeroId as string));
}

function relationshipRank(left: HeroRelationship, right: HeroRelationship): number {
  return right.sharedExperienceCount - left.sharedExperienceCount ||
    right.history.length - left.history.length ||
    right.familiarity - left.familiarity ||
    left.targetHeroId.localeCompare(right.targetHeroId);
}

export function retainRelationshipProfile(
  profile: RelationshipProfile,
  config: RelationshipConfiguration = DEFAULT_RELATIONSHIP_CONFIG,
): RelationshipProfile {
  assertValidRelationshipConfiguration(config);
  const normalizedRelationships = [...profile.relationships]
    .map((relationship) => ({
      ...relationship,
      history: [...new Map([...relationship.history]
        .sort((left, right) => left.sourceId.localeCompare(right.sourceId) ||
          left.eventOrder - right.eventOrder || left.id.localeCompare(right.id))
        .map((event) => [event.sourceId, event])).values()]
        .sort((left, right) => right.eventOrder - left.eventOrder || left.id.localeCompare(right.id))
        .slice(0, config.maximumHistoryPerRelationship)
        .sort((left, right) => left.eventOrder - right.eventOrder || left.id.localeCompare(right.id)),
    }));
  const relationshipByTarget = new Map<string, HeroRelationship>();
  for (const relationship of normalizedRelationships.sort((left, right) =>
    left.targetHeroId.localeCompare(right.targetHeroId) || relationshipRank(left, right))) {
    if (!relationshipByTarget.has(relationship.targetHeroId)) {
      relationshipByTarget.set(relationship.targetHeroId, relationship);
    }
  }
  const relationships = [...relationshipByTarget.values()]
    .sort(relationshipRank)
    .slice(0, config.maximumRelationships)
    .sort((left, right) => left.targetHeroId.localeCompare(right.targetHeroId));
  return {
    ...profile,
    relationships: relationships.map((relationship) => structuredClone(relationship)),
    processedSourceBits: [...profile.processedSourceBits] as RelationshipSourceBits,
  };
}

export function normalizeRelationshipProfile(
  value: unknown,
  ownerHeroId: string,
  validHeroIds?: ReadonlySet<string>,
): RelationshipProfile {
  if (!isRecord(value) || value.version !== 1 || value.ownerHeroId !== ownerHeroId ||
    !Array.isArray(value.relationships) || !Array.isArray(value.processedSourceBits) ||
    value.processedSourceBits.length !== 8 ||
    !value.processedSourceBits.every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff_ffff) ||
    !Number.isSafeInteger(value.nextEventOrder) || (value.nextEventOrder as number) < 1) {
    return createEmptyRelationshipProfile(ownerHeroId);
  }
  const relationships = value.relationships.filter((relationship): relationship is HeroRelationship =>
    isRelationship(relationship, ownerHeroId) &&
    (!validHeroIds || validHeroIds.has(relationship.targetHeroId)),
  );
  return retainRelationshipProfile({
    version: 1,
    ownerHeroId,
    relationships,
    processedSourceBits: value.processedSourceBits.map((part) => part >>> 0) as RelationshipSourceBits,
    nextEventOrder: Math.max(
      value.nextEventOrder as number,
      ...relationships.flatMap((relationship) => relationship.history.map((event) => event.eventOrder + 1)),
    ),
  });
}
