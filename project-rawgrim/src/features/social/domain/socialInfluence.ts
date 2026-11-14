import { getActionCategory } from '../../ai/domain/actionCategory.ts';
import type { CombatAction, CombatState, CombatUnit } from '../../combat/domain/types.ts';
import { getAssignedHeroIds } from '../../heroes/domain/heroRules.ts';
import type { HeroInstance, PartyFormation } from '../../heroes/domain/types.ts';
import type { TeamStrategy } from '../../heroes/domain/personalityTypes.ts';
import type { MemoryContribution } from '../../memory/domain/types.ts';
import { calculateLeadershipEffectiveness } from './leadership.ts';
import { evaluatePartyChemistry } from './partyChemistry.ts';
import {
  createEmptyRelationshipProfile,
  DEFAULT_RELATIONSHIP_CONFIG,
  getRelationship,
  normalizeRelationshipProfile,
} from './relationshipProfile.ts';
import type { SocialContribution, SocialDecisionContext } from './types.ts';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getUnit(state: CombatState, unitId: string): CombatUnit | null {
  return state.units.find((unit) => unit.id === unitId) ?? null;
}

function strategyDirection(action: CombatAction, strategy: TeamStrategy): number {
  const category = getActionCategory(action);
  if (strategy === 'Aggressive') {
    if (category === 'offense' || category === 'activeSkill') return 1;
    if (category === 'defense') return -2 / 3;
    return -0.2;
  }
  if (strategy === 'Defensive') {
    if (category === 'defense') return 1;
    if (category === 'healing') return 2 / 3;
    return -0.4;
  }
  return 0;
}

function relationshipUtility(
  state: CombatState,
  actor: CombatUnit,
  action: CombatAction,
  social: SocialDecisionContext,
  recalledMemories: readonly MemoryContribution[],
): { value: number; explanations: string[] } {
  if (getActionCategory(action) !== 'healing') return { value: 0, explanations: [] };
  const target = getUnit(state, action.targetId);
  if (!target || target.side !== actor.side || target.sourceId === actor.sourceId) {
    return { value: 0, explanations: [] };
  }
  const relationship = getRelationship(social.actorRelationshipProfile, target.sourceId);
  if (!relationship) return { value: 0, explanations: [] };
  let value = relationship.trust * 0.04 + relationship.affection * 0.02 - relationship.resentment * 0.05;
  const overlapsSocialMemory = recalledMemories.some((recalled) =>
    recalled.memory.category === 'Social' && recalled.memory.participantIds.includes(target.sourceId));
  if (overlapsSocialMemory) value *= 0.5;
  value = clamp(
    value,
    -DEFAULT_RELATIONSHIP_CONFIG.maximumRelationshipUtility,
    DEFAULT_RELATIONSHIP_CONFIG.maximumRelationshipUtility,
  );
  return {
    value,
    explanations: [
      `Relationship toward ${target.sourceId}: trust ${relationship.trust}, affection ${relationship.affection}, resentment ${relationship.resentment}.`,
      ...(overlapsSocialMemory ? ['Contribution halved because a matching Social memory was recalled.'] : []),
    ],
  };
}

function leadershipUtility(
  state: CombatState,
  actor: CombatUnit,
  action: CombatAction,
  strategy: TeamStrategy,
  discipline: number,
  social: SocialDecisionContext,
): { value: number; explanations: string[] } {
  const leaderUnit = social.leaderId
    ? state.units.find((unit) => unit.sourceId === social.leaderId && unit.side === actor.side)
    : undefined;
  if (!social.leadership.active || !social.leaderId) return { value: 0, explanations: [] };
  if (!leaderUnit?.alive) {
    return { value: 0, explanations: ['Assigned leader is unavailable in current combat.'] };
  }
  const direction = strategyDirection(action, strategy);
  if (direction === 0) return { value: 0, explanations: [] };
  const relationship = actor.sourceId === social.leaderId
    ? null
    : getRelationship(social.actorRelationshipProfile, social.leaderId);
  const acceptance = actor.sourceId === social.leaderId
    ? 1
    : clamp((100 + (relationship?.trust ?? 0) - (relationship?.resentment ?? 0)) / 200, 0, 1);
  const value = clamp(
    direction * DEFAULT_RELATIONSHIP_CONFIG.maximumLeadershipUtility *
      social.leadership.score / 100 * clamp(discipline, 0, 100) / 100 * acceptance *
      social.chemistry.coordination / 100,
    -DEFAULT_RELATIONSHIP_CONFIG.maximumLeadershipUtility,
    DEFAULT_RELATIONSHIP_CONFIG.maximumLeadershipUtility,
  );
  return {
    value,
    explanations: [
      `Leader effectiveness ${social.leadership.score}, coordination ${social.chemistry.coordination}, acceptance ${round(acceptance * 100)}%.`,
      `Actor discipline ${clamp(discipline, 0, 100)} scales strategy adherence.`,
    ],
  };
}

export function calculateSocialContribution(
  state: CombatState,
  actor: CombatUnit,
  action: CombatAction,
  strategy: TeamStrategy,
  discipline: number,
  social: SocialDecisionContext,
  recalledMemories: readonly MemoryContribution[],
): SocialContribution {
  const relationship = relationshipUtility(state, actor, action, social, recalledMemories);
  const leadership = leadershipUtility(state, actor, action, strategy, discipline, social);
  return {
    relationshipContribution: round(relationship.value),
    leadershipContribution: round(leadership.value),
    explanations: [...relationship.explanations, ...leadership.explanations],
  };
}

export function createPartySocialContexts(
  roster: readonly HeroInstance[],
  formation: PartyFormation,
  leaderId: string | null,
): ReadonlyMap<string, SocialDecisionContext> {
  const deployedIds = getAssignedHeroIds(formation);
  const validHeroIds = new Set(roster.map((hero) => hero.id));
  const leadership = calculateLeadershipEffectiveness(leaderId, roster, formation);
  const chemistry = evaluatePartyChemistry(roster, formation, leaderId);
  return new Map<string, SocialDecisionContext>(roster
    .filter((hero) => deployedIds.includes(hero.id))
    .map((hero): [string, SocialDecisionContext] => [hero.id, {
      actorRelationshipProfile: hero.relationships
        ? normalizeRelationshipProfile(hero.relationships, hero.id, validHeroIds)
        : createEmptyRelationshipProfile(hero.id),
      leaderId,
      leadership,
      chemistry,
    }]));
}
