import type { LearningObservation } from '../../learning/domain/types.ts';
import {
  assertValidRelationshipConfiguration,
  DEFAULT_RELATIONSHIP_CONFIG,
  retainRelationshipProfile,
} from './relationshipProfile.ts';
import type {
  HeroRelationship,
  RelationshipChange,
  RelationshipConfiguration,
  RelationshipEvent,
  RelationshipEventType,
  RelationshipFormationHero,
  RelationshipFormationResult,
  RelationshipFormationSource,
  RelationshipProfile,
  RelationshipSourceBits,
} from './types.ts';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));
}

function finiteChange(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function hasProcessedSource(bits: RelationshipSourceBits, sourceId: string): boolean {
  return sourcePositions(sourceId).every((position) =>
    (bits[Math.floor(position / 32)] & (1 << (position % 32))) !== 0,
  );
}

function markProcessedSource(bits: RelationshipSourceBits, sourceId: string): RelationshipSourceBits {
  const next = [...bits] as RelationshipSourceBits;
  for (const position of sourcePositions(sourceId)) {
    const index = Math.floor(position / 32);
    next[index] = (next[index] | (1 << (position % 32))) >>> 0;
  }
  return next;
}

function createNeutralRelationship(targetHeroId: string): HeroRelationship {
  return {
    targetHeroId,
    familiarity: 0,
    trust: 0,
    respect: 0,
    affection: 0,
    rivalry: 0,
    resentment: 0,
    sharedExperienceCount: 0,
    history: [],
  };
}

export function applyRelationshipEvent(
  profile: RelationshipProfile,
  event: RelationshipEvent,
  config: RelationshipConfiguration = DEFAULT_RELATIONSHIP_CONFIG,
): RelationshipProfile {
  if (event.ownerHeroId !== profile.ownerHeroId) throw new Error('Relationship event owner does not match profile');
  if (event.ownerHeroId === event.targetHeroId) throw new Error('A hero cannot have a relationship with itself');
  const existing = profile.relationships.find((relationship) => relationship.targetHeroId === event.targetHeroId) ??
    createNeutralRelationship(event.targetHeroId);
  if (existing.history.some((history) => history.sourceId === event.sourceId)) return profile;
  const change = event.changes;
  const sharedExperienceChange = typeof change.sharedExperienceCount === 'number' &&
    Number.isSafeInteger(change.sharedExperienceCount)
    ? change.sharedExperienceCount
    : 0;
  const updated: HeroRelationship = {
    ...existing,
    familiarity: clamp(existing.familiarity + finiteChange(change.familiarity), 0, 100),
    trust: clamp(existing.trust + finiteChange(change.trust), -100, 100),
    respect: clamp(existing.respect + finiteChange(change.respect), -100, 100),
    affection: clamp(existing.affection + finiteChange(change.affection), -100, 100),
    rivalry: clamp(existing.rivalry + finiteChange(change.rivalry), 0, 100),
    resentment: clamp(existing.resentment + finiteChange(change.resentment), 0, 100),
    sharedExperienceCount: Math.max(0, existing.sharedExperienceCount + sharedExperienceChange),
    history: [...existing.history, structuredClone(event)],
  };
  return retainRelationshipProfile({
    ...profile,
    relationships: [
      ...profile.relationships.filter((relationship) => relationship.targetHeroId !== event.targetHeroId),
      updated,
    ],
    nextEventOrder: Math.max(profile.nextEventOrder, event.eventOrder + 1),
  }, config);
}

function observedThreat(source: RelationshipFormationSource): number {
  return clamp(Math.max(0, ...source.experience.observations.map((observation) => observation.context.enemyThreat)), 0, 1);
}

function relatedMemoryIds(hero: RelationshipFormationHero, sourceId: string, targetHeroId: string): string[] {
  return hero.memoryProfile?.memories
    .filter((memory) => memory.sourceId.startsWith(sourceId) && memory.participantIds.includes(targetHeroId))
    .map((memory) => memory.id)
    .sort((left, right) => left.localeCompare(right)) ?? [];
}

interface EventDraft {
  ownerHeroId: string;
  targetHeroId: string;
  type: RelationshipEventType;
  suffix: string;
  round: number;
  changes: RelationshipChange;
  description: string;
  memoryIds: readonly string[];
}

function sharedBattleDrafts(
  source: RelationshipFormationSource,
  participants: readonly string[],
  config: RelationshipConfiguration,
): EventDraft[] {
  const meaningful = source.finalState.result.outcome === 'defeat' ||
    observedThreat(source) >= config.minimumSharedBattleThreat;
  if (!meaningful) return [];
  return participants.flatMap((ownerHeroId) => participants
    .filter((targetHeroId) => targetHeroId !== ownerHeroId)
    .map((targetHeroId) => ({
      ownerHeroId,
      targetHeroId,
      type: source.finalState.result.outcome === 'defeat' ? 'shared-defeat' as const : 'shared-battle' as const,
      suffix: `shared:${ownerHeroId}:${targetHeroId}`,
      round: source.finalState.result.completedRound,
      changes: {
        familiarity: 2,
        sharedExperienceCount: 1,
      },
      description: source.finalState.result.outcome === 'defeat'
        ? 'Endured a recorded defeat together.'
        : 'Completed a meaningful combat encounter together.',
      memoryIds: [],
    })));
}

function majorVictoryDrafts(
  heroes: readonly RelationshipFormationHero[],
  source: RelationshipFormationSource,
  participants: readonly string[],
): EventDraft[] {
  if (source.finalState.result.outcome !== 'victory' || observedThreat(source) < 0.65) return [];
  return participants.flatMap((ownerHeroId) => participants
    .filter((targetHeroId) => targetHeroId !== ownerHeroId)
    .map((targetHeroId) => ({
      ownerHeroId,
      targetHeroId,
      type: 'major-victory' as const,
      suffix: `victory:${ownerHeroId}:${targetHeroId}`,
      round: source.finalState.result.completedRound,
      changes: { respect: 2 },
      description: 'Shared a major observed victory.',
      memoryIds: heroes.find((hero) => hero.instanceId === ownerHeroId)?.memoryProfile?.memories
        .filter((memory) => memory.sourceId.startsWith(source.sessionId) &&
          (memory.category === 'Achievement' || memory.category === 'Milestone'))
        .map((memory) => memory.id)
        .sort((left, right) => left.localeCompare(right)) ?? [],
    })));
}

function rescueDrafts(
  heroes: readonly RelationshipFormationHero[],
  source: RelationshipFormationSource,
): EventDraft[] {
  return source.experience.observations.flatMap((observation) => {
    const ratio = observation.outcome.healingDone / Math.max(1, observation.outcome.targetMaxHp);
    if (observation.selectedCategory !== 'healing' || observation.context.allySurvivalRisk < 0.75 || ratio < 0.25) return [];
    const rescuer = heroes.find((hero) => hero.instanceId === observation.heroInstanceId);
    const targetUnit = source.finalState.units.find((unit) => unit.id === observation.selectedAction.targetId);
    if (!rescuer || !targetUnit?.alive || !heroes.some((hero) => hero.instanceId === targetUnit.sourceId) ||
      targetUnit.sourceId === rescuer.instanceId) return [];
    const rescuerMemoryIds = relatedMemoryIds(rescuer, source.sessionId, targetUnit.sourceId);
    return [
      {
        ownerHeroId: targetUnit.sourceId,
        targetHeroId: rescuer.instanceId,
        type: 'meaningful-rescue' as const,
        suffix: `rescue-received:${observation.observationSequence}:${targetUnit.sourceId}:${rescuer.instanceId}`,
        round: observation.round,
        changes: { familiarity: 2, trust: 8, affection: 3 },
        description: `Received meaningful healing from ${rescuer.instanceId} while at severe risk.`,
        // TASK 005C records the rescue in the healer's memory profile only.
        // Do not attach a foreign memory ID to the recipient's relationship history.
        memoryIds: [],
      },
      {
        ownerHeroId: rescuer.instanceId,
        targetHeroId: targetUnit.sourceId,
        type: 'meaningful-rescue' as const,
        suffix: `rescue-given:${observation.observationSequence}:${rescuer.instanceId}:${targetUnit.sourceId}`,
        round: observation.round,
        changes: { familiarity: 2 },
        description: `Provided meaningful healing to ${targetUnit.sourceId} while they faced severe risk.`,
        memoryIds: rescuerMemoryIds,
      },
    ];
  });
}

function recklessDrafts(
  heroes: readonly RelationshipFormationHero[],
  observations: readonly LearningObservation[],
): EventDraft[] {
  return observations.filter((observation) => observation.outcome.severeSelfEndangerment)
    .flatMap((observation) => heroes
      .filter((observer) => observer.instanceId !== observation.heroInstanceId)
      .flatMap((observer) => {
        const { aggression, discipline } = observer.personality.innate;
        const respect = Math.round(clamp((aggression - discipline) / 40, -3, 3));
        const trust = discipline - aggression >= 40 ? -2 : 0;
        if (respect === 0 && trust === 0) return [];
        return [{
          ownerHeroId: observer.instanceId,
          targetHeroId: observation.heroInstanceId,
          type: 'reckless-action' as const,
          suffix: `reckless:${observation.observationSequence}:${observer.instanceId}:${observation.heroInstanceId}`,
          round: observation.round,
          changes: { trust, respect },
          description: `Observed ${observation.heroInstanceId} act while severely self-endangered.`,
          memoryIds: [],
        }];
      }));
}

function allyLossDrafts(
  source: RelationshipFormationSource,
  participants: readonly string[],
): EventDraft[] {
  const defeated = source.finalState.units.filter((unit) =>
    unit.side === 'allies' && !unit.alive && participants.includes(unit.sourceId));
  const survivors = source.finalState.units.filter((unit) =>
    unit.side === 'allies' && unit.alive && participants.includes(unit.sourceId));
  return survivors.flatMap((owner) => defeated.map((target) => ({
    ownerHeroId: owner.sourceId,
    targetHeroId: target.sourceId,
    type: 'ally-loss' as const,
    suffix: `loss:${owner.sourceId}:${target.sourceId}`,
    round: source.finalState.result.completedRound,
    changes: {},
    description: `Witnessed ${target.sourceId} fall during the encounter; no blame was assigned.`,
    memoryIds: [],
  })));
}

export function formPartyRelationships(
  heroes: readonly RelationshipFormationHero[],
  source: RelationshipFormationSource,
  config: RelationshipConfiguration = DEFAULT_RELATIONSHIP_CONFIG,
): RelationshipFormationResult {
  assertValidRelationshipConfiguration(config);
  if (source.sessionId !== source.experience.sessionId || source.experience.outcome !== source.finalState.result.outcome) {
    throw new Error('Relationship source does not match finalized combat experience');
  }
  if (!source.eligibleForPersistence || source.finalState.result.outcome === 'ongoing') {
    return { profiles: heroes.map((hero) => hero.relationshipProfile), events: [], duplicate: false };
  }
  const participantSet = new Set(source.finalState.units
    .filter((unit) => unit.side === 'allies')
    .map((unit) => unit.sourceId));
  const participants = heroes.map((hero) => hero.instanceId)
    .filter((heroId) => participantSet.has(heroId))
    .sort((left, right) => left.localeCompare(right));
  const drafts = [
    ...sharedBattleDrafts(source, participants, config),
    ...majorVictoryDrafts(heroes, source, participants),
    ...rescueDrafts(heroes, source),
    ...recklessDrafts(heroes.filter((hero) => participants.includes(hero.instanceId)), source.experience.observations),
    ...allyLossDrafts(source, participants),
  ];
  const createdEvents: RelationshipEvent[] = [];
  let duplicateCount = 0;
  const profiles = heroes.map((hero) => {
    const profile = hero.relationshipProfile;
    if (!participants.includes(hero.instanceId)) return profile;
    if (hasProcessedSource(profile.processedSourceBits, source.sessionId)) {
      duplicateCount += 1;
      return profile;
    }
    let next = profile;
    for (const draft of drafts.filter((candidate) => candidate.ownerHeroId === hero.instanceId)) {
      const event: RelationshipEvent = {
        id: `relationship:${draft.ownerHeroId}:${source.sessionId}:${draft.suffix}`,
        sourceId: `${source.sessionId}:${draft.suffix}`,
        type: draft.type,
        ownerHeroId: draft.ownerHeroId,
        targetHeroId: draft.targetHeroId,
        sessionId: source.sessionId,
        round: draft.round,
        changes: { ...draft.changes },
        memoryIds: [...draft.memoryIds],
        description: draft.description,
        eventOrder: next.nextEventOrder,
      };
      next = applyRelationshipEvent(next, event, config);
      createdEvents.push(event);
    }
    return retainRelationshipProfile({
      ...next,
      processedSourceBits: markProcessedSource(next.processedSourceBits, source.sessionId),
      nextEventOrder: Math.max(next.nextEventOrder, profile.nextEventOrder + 1),
    }, config);
  });
  return {
    profiles,
    events: createdEvents,
    duplicate: participants.length > 0 && duplicateCount === participants.length,
  };
}
