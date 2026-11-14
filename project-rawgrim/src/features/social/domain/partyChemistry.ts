import { getAssignedHeroIds } from '../../heroes/domain/heroRules.ts';
import { ensureHeroPersonality } from '../../heroes/domain/personality.ts';
import type { HeroInstance, PartyFormation } from '../../heroes/domain/types.ts';
import { calculateLeadershipEffectiveness } from './leadership.ts';
import { createEmptyRelationshipProfile, getRelationship } from './relationshipProfile.ts';
import type { PartyChemistry } from './types.ts';

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

function average(values: readonly number[], fallback: number): number {
  return values.length === 0 ? fallback : values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function evaluatePartyChemistry(
  roster: readonly HeroInstance[],
  formation: PartyFormation,
  leaderId: string | null,
): PartyChemistry {
  const deployedIds = getAssignedHeroIds(formation);
  const deployed = roster.filter((hero) => deployedIds.includes(hero.id));
  if (deployed.length === 0) {
    return {
      cohesion: 0, coordination: 0, conflictRisk: 0, leadershipStability: 0,
      explanations: ['No deployed heroes are available for chemistry evaluation.'],
    };
  }
  const directedPairs = deployed.flatMap((owner) => deployed
    .filter((target) => target.id !== owner.id)
    .map((target) => ({ owner, target })));
  const trust: number[] = [];
  const respect: number[] = [];
  const affection: number[] = [];
  const familiarity: number[] = [];
  const conflict: number[] = [];
  const compatibility: number[] = [];
  const friction: number[] = [];
  for (const { owner, target } of directedPairs) {
    const relationship = getRelationship(
      owner.relationships ?? createEmptyRelationshipProfile(owner.id),
      target.id,
    );
    trust.push(50 + (relationship?.trust ?? 0) / 2);
    respect.push(50 + (relationship?.respect ?? 0) / 2);
    affection.push(50 + (relationship?.affection ?? 0) / 2);
    familiarity.push(relationship?.familiarity ?? 0);
    conflict.push(((relationship?.rivalry ?? 0) + (relationship?.resentment ?? 0)) / 2);
    const ownerPersonality = ensureHeroPersonality(owner).innate;
    const targetPersonality = ensureHeroPersonality(target).innate;
    const difference = (
      Math.abs(ownerPersonality.discipline - targetPersonality.discipline) +
      Math.abs(ownerPersonality.empathy - targetPersonality.empathy) +
      Math.abs(ownerPersonality.aggression - targetPersonality.aggression)
    ) / 3;
    compatibility.push(100 - difference);
    friction.push((
      Math.abs(ownerPersonality.aggression - targetPersonality.aggression) +
      Math.abs(ownerPersonality.discipline - targetPersonality.discipline)
    ) / 2);
  }
  const neutralPairFallback = deployed.length === 1 ? 50 : 0;
  const averageTrust = average(trust, neutralPairFallback);
  const averageRespect = average(respect, neutralPairFallback);
  const averageAffection = average(affection, neutralPairFallback);
  const averageFamiliarity = average(familiarity, 0);
  const averageCompatibility = average(compatibility, 100);
  const socialConflict = average(conflict, 0);
  const personalityFriction = average(friction, 0);
  const leadership = calculateLeadershipEffectiveness(leaderId, roster, formation);
  const cohesion = clamp(
    averageTrust * 0.35 + averageFamiliarity * 0.25 + averageAffection * 0.2 + averageCompatibility * 0.2,
  );
  const coordination = clamp(
    averageRespect * 0.35 + averageFamiliarity * 0.25 + averageCompatibility * 0.2 + leadership.score * 0.2,
  );
  const conflictRisk = clamp(socialConflict * 0.6 + personalityFriction * 0.4);
  const teammateLeaderTrust = leaderId
    ? average(deployed.filter((hero) => hero.id !== leaderId).map((hero) =>
      50 + (getRelationship(hero.relationships ?? createEmptyRelationshipProfile(hero.id), leaderId)?.trust ?? 0) / 2), 50)
    : 0;
  const leadershipStability = leadership.active
    ? clamp(leadership.score * 0.7 + teammateLeaderTrust * 0.3)
    : 0;
  return {
    cohesion: round(cohesion),
    coordination: round(coordination),
    conflictRisk: round(conflictRisk),
    leadershipStability: round(leadershipStability),
    explanations: [
      `Cohesion reflects trust, familiarity, affection, and personality compatibility across ${directedPairs.length} directed ties.`,
      `Coordination combines mutual respect with leadership effectiveness ${leadership.score}.`,
      `Conflict risk combines recorded rivalry and resentment with personality friction.`,
    ],
  };
}
