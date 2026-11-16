import type { HeroDefinition, HeroInstance } from '../../heroes/domain/types.ts';
import { ensureHeroPersonality } from '../../heroes/domain/personality.ts';
import type { HeroRelationship } from '../../social/domain/types.ts';
import type { OfficialDeathResolutionRequest, HeroMemorialRecord } from './types.ts';
import { MAX_IMPORTANT_RELATIONSHIPS } from './types.ts';

function relationshipWeight(relationship: HeroRelationship): number {
  return Math.abs(relationship.trust) + Math.abs(relationship.respect) +
    Math.abs(relationship.affection) + relationship.familiarity +
    relationship.rivalry + relationship.resentment;
}

export function createLegacyMemorial(
  hero: HeroInstance,
  definition: HeroDefinition,
  memorialOrder: number,
): HeroMemorialRecord {
  const relationships = [...(hero.relationships?.relationships ?? [])]
    .sort((left, right) => relationshipWeight(right) - relationshipWeight(left) ||
      left.targetHeroId.localeCompare(right.targetHeroId))
    .slice(0, MAX_IMPORTANT_RELATIONSHIPS);
  const significantMemories = [...(hero.memory?.memories ?? [])]
    .filter((memory) => memory.significance.score >= 45)
    .sort((left, right) => right.significance.score - left.significance.score || left.id.localeCompare(right.id));
  return structuredClone({
    id: `memorial:legacy:${hero.id}`,
    heroInstanceId: hero.id,
    definitionId: definition.id,
    definition: {
      name: definition.name,
      heroClass: definition.class,
      rarity: definition.rarity,
      portrait: { ...definition.portrait },
    },
    finalLevel: hero.level,
    finalExperience: hero.experience,
    personality: ensureHeroPersonality(hero, definition),
    significantMemories,
    importantRelationships: relationships,
    achievements: [],
    expeditions: [],
    deathContext: {
      known: false,
      expeditionId: null,
      battleId: null,
      encounterId: null,
      encounterLabel: null,
      seed: null,
      rulesVersion: null,
      outcome: null,
      round: null,
      attackerSourceId: null,
      observedDamageTypes: [],
      participantHeroIds: [],
    },
    provenance: 'legacy-import',
    historicalGaps: ['death-context', 'expedition-history', 'achievements', 'attacker'],
    memorialOrder,
    resolutionId: null,
  } satisfies HeroMemorialRecord);
}

export function createOfficialMemorial(
  hero: HeroInstance,
  definition: HeroDefinition,
  request: OfficialDeathResolutionRequest,
  memorialOrder: number,
): HeroMemorialRecord {
  const unitId = `ally:${hero.id}`;
  const damageEvents = request.finalState.events.filter((event) =>
    event.type === 'damage' && event.targetId === unitId);
  const finalDamage = damageEvents.at(-1);
  const attacker = finalDamage?.actorId
    ? request.finalState.units.find((unit) => unit.id === finalDamage.actorId)
    : undefined;
  const observedDamageTypes = [...new Set(damageEvents.flatMap((event) =>
    event.damageType ? [event.damageType] : []))];
  const relationships = [...(hero.relationships?.relationships ?? [])]
    .sort((left, right) => relationshipWeight(right) - relationshipWeight(left) ||
      left.targetHeroId.localeCompare(right.targetHeroId))
    .slice(0, MAX_IMPORTANT_RELATIONSHIPS);
  const significantMemories = [...(hero.memory?.memories ?? [])]
    .filter((memory) => memory.significance.score >= 45)
    .sort((left, right) => right.significance.score - left.significance.score || left.id.localeCompare(right.id));
  const historicalGaps: HeroMemorialRecord['historicalGaps'] = attacker
    ? ['achievements']
    : ['achievements', 'attacker'];
  return structuredClone({
    id: `memorial:${request.resolutionId}:${hero.id}`,
    heroInstanceId: hero.id,
    definitionId: definition.id,
    definition: {
      name: definition.name,
      heroClass: definition.class,
      rarity: definition.rarity,
      portrait: { ...definition.portrait },
    },
    finalLevel: hero.level,
    finalExperience: hero.experience,
    personality: ensureHeroPersonality(hero, definition),
    significantMemories,
    importantRelationships: relationships,
    achievements: [],
    expeditions: [{
      expeditionId: request.expeditionId,
      encounterId: request.encounterId,
      outcome: request.finalState.result.outcome as Exclude<typeof request.finalState.result.outcome, 'ongoing'>,
    }],
    deathContext: {
      known: true,
      expeditionId: request.expeditionId,
      battleId: request.battleId,
      encounterId: request.encounterId,
      encounterLabel: request.encounterLabel ?? null,
      seed: request.finalState.seed,
      rulesVersion: request.rulesVersion,
      outcome: request.finalState.result.outcome as Exclude<typeof request.finalState.result.outcome, 'ongoing'>,
      round: request.finalState.result.completedRound,
      attackerSourceId: attacker?.sourceId ?? null,
      observedDamageTypes,
      participantHeroIds: [...request.participantHeroIds].sort(),
    },
    provenance: 'official-resolution',
    historicalGaps,
    memorialOrder,
    resolutionId: request.resolutionId,
  } satisfies HeroMemorialRecord);
}
