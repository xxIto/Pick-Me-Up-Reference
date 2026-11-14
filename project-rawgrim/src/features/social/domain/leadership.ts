import { getAssignedHeroIds } from '../../heroes/domain/heroRules.ts';
import { ensureHeroPersonality } from '../../heroes/domain/personality.ts';
import type { HeroInstance, PartyFormation } from '../../heroes/domain/types.ts';
import { createEmptyRelationshipProfile, getRelationship } from './relationshipProfile.ts';
import type { LeadershipEvaluation } from './types.ts';

export type LeaderValidationResult = { valid: true } | { valid: false; error: string };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));
}

function average(values: readonly number[], fallback: number): number {
  return values.length === 0 ? fallback : values.reduce((total, value) => total + value, 0) / values.length;
}

export function validateLeaderAssignment(
  leaderId: string | null,
  roster: readonly HeroInstance[],
  formation: PartyFormation,
): LeaderValidationResult {
  if (leaderId === null) return { valid: true };
  const leader = roster.find((hero) => hero.id === leaderId);
  if (!leader) return { valid: false, error: 'Leader does not exist in the roster' };
  if (!getAssignedHeroIds(formation).includes(leaderId)) {
    return { valid: false, error: 'Only a deployed hero can lead the party' };
  }
  if (leader.status === 'Dead' || leader.currentHp <= 0) {
    return { valid: false, error: 'A dead or unavailable hero cannot lead the party' };
  }
  return { valid: true };
}

function inactiveLeadership(leaderId: string | null): LeadershipEvaluation {
  return {
    active: false,
    leaderId,
    score: 0,
    components: {
      discipline: 0, courage: 0, resolve: 0, experience: 0, incomingTrust: 0, incomingRespect: 0,
    },
    explanations: [leaderId ? 'Assigned leader is unavailable.' : 'No party leader assigned.'],
  };
}

export function calculateLeadershipEffectiveness(
  leaderId: string | null,
  roster: readonly HeroInstance[],
  formation: PartyFormation,
): LeadershipEvaluation {
  if (!leaderId || !validateLeaderAssignment(leaderId, roster, formation).valid) {
    return inactiveLeadership(leaderId);
  }
  const leader = roster.find((hero) => hero.id === leaderId);
  if (!leader) return inactiveLeadership(leaderId);
  const deployedIds = getAssignedHeroIds(formation);
  const teammates = roster.filter((hero) => hero.id !== leaderId && deployedIds.includes(hero.id));
  const validIds = new Set(roster.map((hero) => hero.id));
  const incoming = teammates.map((teammate) => getRelationship(
    teammate.relationships ?? createEmptyRelationshipProfile(teammate.id),
    leaderId,
  ));
  const incomingTrust = clamp(50 + average(incoming.map((relationship) => relationship?.trust ?? 0), 0) / 2, 0, 100);
  const incomingRespect = clamp(50 + average(incoming.map((relationship) => relationship?.respect ?? 0), 0) / 2, 0, 100);
  const personality = ensureHeroPersonality(leader);
  const experience = clamp(leader.level * 2 + (personality.learning?.battlesProcessed ?? 0) * 3, 0, 100);
  const components = {
    discipline: clamp(personality.innate.discipline, 0, 100),
    courage: clamp(personality.innate.courage, 0, 100),
    resolve: clamp(personality.emotion.resolve, 0, 100),
    experience,
    incomingTrust,
    incomingRespect,
  };
  const score = Math.round((
    components.discipline * 0.25 + components.courage * 0.15 + components.resolve * 0.1 +
    components.experience * 0.15 + components.incomingTrust * 0.2 + components.incomingRespect * 0.15
  ) * 100) / 100;
  return {
    active: validIds.has(leaderId),
    leaderId,
    score,
    components,
    explanations: [
      `Discipline ${components.discipline} and courage ${components.courage} define intrinsic command.`,
      `Teammate trust ${components.incomingTrust} and respect ${components.incomingRespect} shape acceptance.`,
      `Relevant experience contributes ${components.experience}.`,
    ],
  };
}
