import { ensureHeroPersonality } from '../../heroes/domain/personality.ts';
import type { HeroDefinition, HeroInstance, PartyFormation } from '../../heroes/domain/types.ts';
import { applyCombatExperience } from '../../learning/domain/learningEngine.ts';
import { formHeroMemories } from '../../memory/domain/memoryFormation.ts';
import { normalizeMemoryProfile, retainMemoryProfile } from '../../memory/domain/memoryProfile.ts';
import { calculateMemorySignificance } from '../../memory/domain/significance.ts';
import type { EpisodicMemory } from '../../memory/domain/types.ts';
import { formPartyRelationships } from '../../social/domain/relationshipEngine.ts';
import { normalizeRelationshipProfile } from '../../social/domain/relationshipProfile.ts';
import { createOfficialMemorial } from './memorial.ts';
import { applySurvivorLosses } from './survivorConsequences.ts';
import type {
  DeathResolutionResult,
  LegacyResolutionState,
  OfficialDeathResolutionRequest,
} from './types.ts';
import { MAX_PROCESSED_LEGACY_RESOLUTIONS } from './types.ts';

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function validateRequestIdentity(
  request: OfficialDeathResolutionRequest,
): readonly string[] {
  const errors: string[] = [];
  if (request.authorization !== 'official-expedition') errors.push('Official expedition authorization is required');
  if (!request.finalized || request.finalState.result.outcome === 'ongoing') errors.push('Combat result must be finalized');
  for (const [label, value] of [
    ['Expedition ID', request.expeditionId],
    ['Battle ID', request.battleId],
    ['Resolution ID', request.resolutionId],
    ['Encounter ID', request.encounterId],
    ['Rules version', request.rulesVersion],
  ] as const) {
    if (!isNonEmpty(value)) errors.push(`${label} is required`);
  }
  if (request.experience.sessionId !== request.battleId) errors.push('Combat experience does not match battle identity');
  if (request.experience.outcome !== request.finalState.result.outcome) errors.push('Combat experience outcome does not match result');
  if (new Set(request.participantHeroIds).size !== request.participantHeroIds.length) {
    errors.push('Participant IDs must be unique');
  }
  const alliedIds = request.finalState.units.filter((unit) => unit.side === 'allies').map((unit) => unit.sourceId);
  if (!sameIds(alliedIds, request.participantHeroIds)) errors.push('Committed participants do not match combat allies');
  if (request.leaderIdSnapshot && !request.participantHeroIds.includes(request.leaderIdSnapshot)) {
    errors.push('Leader snapshot must reference a committed participant');
  }
  return errors;
}

function validateRequestState(
  current: LegacyResolutionState,
  request: OfficialDeathResolutionRequest,
): string[] {
  const errors: string[] = [];
  const rosterIds = new Set(current.roster.map((hero) => hero.id));
  if (request.participantHeroIds.some((id) => !rosterIds.has(id))) {
    errors.push('Every participant must exist in the active roster');
  }
  const fallenIds = request.finalState.units.filter((unit) =>
    unit.side === 'allies' && !unit.alive && request.participantHeroIds.includes(unit.sourceId));
  if (fallenIds.length === 0) {
    errors.push('Permanent-death resolution requires at least one confirmed fallen hero');
  }
  return errors;
}

function updateFormation(formation: PartyFormation, fallenIds: ReadonlySet<string>): PartyFormation {
  return {
    frontline: formation.frontline.map((id) => id && fallenIds.has(id) ? null : id) as PartyFormation['frontline'],
    backline: formation.backline.map((id) => id && fallenIds.has(id) ? null : id) as PartyFormation['backline'],
  };
}

function addDeathMemory(
  hero: HeroInstance,
  fallenHeroId: string,
  request: OfficialDeathResolutionRequest,
  threat: number,
): HeroInstance {
  const profile = normalizeMemoryProfile(hero.memory, hero.id);
  const enemyCategoryIds = request.finalState.units.filter((unit) => unit.side === 'enemies')
    .map((unit) => unit.sourceId).sort();
  const memory: EpisodicMemory = {
    id: `memory:${hero.id}:${request.resolutionId}:ally-loss:${fallenHeroId}`,
    ownerHeroId: hero.id,
    sourceId: `${request.resolutionId}:ally-loss:${fallenHeroId}`,
    category: 'Social',
    title: 'A companion fell',
    description: `Witnessed ${fallenHeroId} fall during a verified encounter; no blame was assigned.`,
    participantIds: [fallenHeroId],
    context: {
      sessionId: request.battleId,
      round: request.finalState.result.completedRound,
      encounterLabel: request.encounterLabel,
      enemyCategoryIds,
      combatOutcome: request.finalState.result.outcome,
      threatLevel: threat,
    },
    facts: {
      outcome: request.finalState.result.outcome,
      enemyCategoryIds,
      fallenHeroId,
    },
    significance: calculateMemorySignificance({
      severity: 1,
      personalRisk: threat,
      novelty: profile.memories.some((entry) => entry.facts.fallenHeroId === fallenHeroId) ? 0 : 1,
      outcomeImportance: 0.8,
      relevance: 1,
    }),
    eventOrder: profile.nextEventOrder,
    relatedMemoryIds: [],
  };
  return {
    ...hero,
    memory: retainMemoryProfile({
      ...profile,
      memories: [...profile.memories, memory],
      nextEventOrder: profile.nextEventOrder + 1,
    }),
  };
}

export function resolveAuthorizedPermadeath(
  current: LegacyResolutionState,
  request: OfficialDeathResolutionRequest,
  definitions: readonly HeroDefinition[],
): DeathResolutionResult {
  const identityErrors = validateRequestIdentity(request);
  if (identityErrors.length > 0) return { ok: false, errors: identityErrors };
  if (current.processedLegacyResolutionIds.includes(request.resolutionId)) {
    return { ok: true, duplicate: true, state: current, memorials: [] };
  }
  const errors = validateRequestState(current, request);
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  if (current.roster.some((hero) =>
    request.participantHeroIds.includes(hero.id) && !definitionIds.has(hero.definitionId))) {
    errors.push('Every participant must have a hero definition');
  }
  if (errors.length > 0) return { ok: false, errors };

  const participantSet = new Set(request.participantHeroIds);
  const fallenIds = sorted(request.finalState.units.filter((unit) =>
    unit.side === 'allies' && !unit.alive && participantSet.has(unit.sourceId))
    .map((unit) => unit.sourceId));
  const fallenSet = new Set(fallenIds);
  const validHeroIds = new Set(current.roster.map((hero) => hero.id));
  let roster = current.roster.map((hero) => {
    if (!participantSet.has(hero.id)) return structuredClone(hero);
    const definition = definitions.find((entry) => entry.id === hero.definitionId);
    if (!definition) return structuredClone(hero);
    const observations = request.experience.observations.filter((entry) => entry.heroInstanceId === hero.id);
    const learning = applyCombatExperience(
      ensureHeroPersonality(hero, definition),
      { ...request.experience, observations, eligibleForLearning: true },
    );
    const learnedHero = { ...hero, personality: learning.personality };
    const memory = formHeroMemories(normalizeMemoryProfile(learnedHero.memory, hero.id), {
      heroInstanceId: hero.id,
      sessionId: request.battleId,
      finalState: request.finalState,
      experience: request.experience,
      eligibleForPersistence: true,
      encounterLabel: request.encounterLabel,
    });
    return { ...learnedHero, memory: memory.profile };
  });

  const relationshipHeroes = roster.filter((hero) => participantSet.has(hero.id)).map((hero) => ({
    instanceId: hero.id,
    personality: ensureHeroPersonality(hero, definitions.find((entry) => entry.id === hero.definitionId)),
    memoryProfile: hero.memory,
    relationshipProfile: normalizeRelationshipProfile(hero.relationships, hero.id, validHeroIds),
  }));
  const relationships = formPartyRelationships(relationshipHeroes, {
    sessionId: request.battleId,
    finalState: request.finalState,
    experience: request.experience,
    eligibleForPersistence: true,
  });
  const relationshipMap = new Map(relationships.profiles.map((profile) => [profile.ownerHeroId, profile]));
  roster = roster.map((hero) => relationshipMap.has(hero.id)
    ? { ...hero, relationships: relationshipMap.get(hero.id) }
    : hero);

  const threat = Math.max(0, ...request.experience.observations.map((entry) => entry.context.enemyThreat));
  roster = roster.map((hero) => {
    if (!participantSet.has(hero.id) || fallenSet.has(hero.id)) return hero;
    let survivor = applySurvivorLosses(hero, fallenIds, request.resolutionId, threat).hero;
    for (const fallenId of fallenIds) {
      survivor = addDeathMemory(survivor, fallenId, request, threat);
    }
    return survivor;
  });

  let memorialOrder = Math.max(0, ...current.memorials.map((entry) => entry.memorialOrder)) + 1;
  const createdMemorials = fallenIds.map((heroId) => {
    const hero = roster.find((entry) => entry.id === heroId)!;
    const definition = definitions.find((entry) => entry.id === hero.definitionId)!;
    return createOfficialMemorial(hero, definition, request, memorialOrder++);
  });
  const nextState: LegacyResolutionState = {
    roster: roster.filter((hero) => !fallenSet.has(hero.id)),
    formation: updateFormation(current.formation, fallenSet),
    leaderId: current.leaderId && fallenSet.has(current.leaderId) ? null : current.leaderId,
    memorials: [...current.memorials.map((entry) => structuredClone(entry)), ...createdMemorials],
    processedLegacyResolutionIds: [
      ...current.processedLegacyResolutionIds,
      request.resolutionId,
    ].slice(-MAX_PROCESSED_LEGACY_RESOLUTIONS),
  };
  return { ok: true, duplicate: false, state: nextState, memorials: createdMemorials };
}
