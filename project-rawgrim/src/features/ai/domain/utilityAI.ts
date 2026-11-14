import { getCombatSkill } from '../../combat/data/combatSkills.ts';
import {
  calculateHealing,
  calculateMagicalDamage,
  calculatePhysicalDamage,
} from '../../combat/domain/calculations.ts';
import { getAvailableActions, getCurrentActor } from '../../combat/domain/combatEngine.ts';
import type { CombatAction, CombatState, CombatUnit } from '../../combat/domain/types.ts';
import type { PersonalityDimensions } from '../../heroes/domain/personalityTypes.ts';
import { extractLearningContext } from '../../learning/domain/context.ts';
import { calculateContextualLearnedContribution } from '../../learning/domain/learningEngine.ts';
import { recallMemories } from '../../memory/domain/memoryRecall.ts';
import type { MemoryRecallContext } from '../../memory/domain/types.ts';
import type { CandidateUtility, DecisionContext, DecisionTrace } from './types.ts';
import { getActionCategory } from './actionCategory.ts';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function actionKey(action: CombatAction): string {
  return `${action.type}:${action.skillId ?? ''}:${action.targetId}`;
}

function getUnit(state: CombatState, unitId: string): CombatUnit | null {
  return state.units.find((unit) => unit.id === unitId) ?? null;
}

function isOffensive(action: CombatAction): boolean {
  const skill = action.skillId ? getCombatSkill(action.skillId) : null;
  return action.type === 'basic-physical' || action.type === 'basic-magical' ||
    (action.type === 'skill' && skill?.kind !== 'healing');
}

function expectedAmount(state: CombatState, actor: CombatUnit, action: CombatAction): number {
  const target = getUnit(state, action.targetId);
  if (!target) return 0;
  const skill = action.skillId ? getCombatSkill(action.skillId) : null;
  if (skill?.kind === 'healing') {
    return Math.min(calculateHealing(actor.stats, skill.multiplier), target.stats.maxHp - target.currentHp);
  }
  if (action.type === 'defend') return 0;
  const magical = action.type === 'basic-magical' || skill?.kind === 'magical';
  return magical
    ? calculateMagicalDamage(actor.stats, target.stats, skill?.multiplier ?? 1)
    : calculatePhysicalDamage(actor.stats, target.stats, skill?.multiplier ?? 1);
}

function calculateBaseUtility(state: CombatState, actor: CombatUnit, action: CombatAction): number {
  const target = getUnit(state, action.targetId);
  if (!target) return 0;
  const actorRisk = 1 - actor.currentHp / actor.stats.maxHp;
  const category = getActionCategory(action);
  let score: number;

  if (category === 'healing') {
    const missingHp = target.stats.maxHp - target.currentHp;
    const heal = expectedAmount(state, actor, action);
    const allyRisk = 1 - target.currentHp / target.stats.maxHp;
    score = missingHp > 0 ? 30 + heal / missingHp * 30 + allyRisk * 40 : 0;
  } else if (category === 'defense') {
    score = 20 + actorRisk * 55;
  } else {
    const damage = expectedAmount(state, actor, action);
    const threat = clamp((target.stats.attack + target.stats.magic) / 300, 0, 1);
    const killBonus = damage >= target.currentHp ? 30 : 0;
    score = damage / target.stats.maxHp * 50 + threat * 20 + killBonus + (action.type === 'skill' ? 8 : 0);
  }

  if (actor.class === 'Warrior' && isOffensive(action)) score += 10;
  if (actor.class === 'Tank' && category === 'defense') score += 15;
  if (actor.class === 'Archer' && isOffensive(action)) score += 8;
  if (actor.class === 'Healer' && category === 'healing') score += 15;
  return clamp(score, 0, 100);
}

function calculatePersonalityContribution(
  action: CombatAction,
  personality: PersonalityDimensions,
  fear: number,
  anger: number,
): number {
  const category = getActionCategory(action);
  let score: number;
  if (category === 'offense' || category === 'activeSkill') {
    score = (personality.aggression - 50) * 0.2 + (personality.courage - 50) * 0.1 -
      (personality.selfPreservation - 50) * 0.08 + (anger - 25) * 0.05;
    if (category === 'activeSkill') score += (personality.ambition - 50) * 0.08;
  } else if (category === 'healing') {
    score = (personality.empathy - 50) * 0.2 + (personality.trust - 50) * 0.08;
  } else {
    score = (personality.selfPreservation - 50) * 0.2 + (fear - 25) * 0.1 -
      (personality.aggression - 50) * 0.08;
  }
  return clamp(score, -25, 25);
}

function calculateStrategyContribution(action: CombatAction, context: DecisionContext): number {
  const category = getActionCategory(action);
  let raw = 0;
  if (context.teamStrategy === 'Aggressive') {
    raw = category === 'offense' || category === 'activeSkill' ? 15 : category === 'defense' ? -10 : -3;
  } else if (context.teamStrategy === 'Defensive') {
    raw = category === 'defense' ? 15 : category === 'healing' ? 10 : -6;
  }
  return clamp(raw * context.personality.innate.discipline / 100, -15, 15);
}

function createMemoryRecallContext(
  state: CombatState,
  actor: CombatUnit,
  action: CombatAction,
): MemoryRecallContext {
  const features = extractLearningContext(state, actor, action);
  const target = getUnit(state, action.targetId);
  return {
    heroInstanceId: actor.sourceId,
    enemyCategoryIds: state.units
      .filter((unit) => unit.side !== actor.side && unit.alive)
      .map((unit) => unit.sourceId),
    participantIds: target ? [target.sourceId] : [],
    threatLevel: features.enemyThreat,
    actorHpBand: features.actorHpCritical > 0 ? 'critical' : features.actorHpLow > 0 ? 'low' : 'medium',
    actionCategory: getActionCategory(action),
    allySurvivalRisk: features.allySurvivalRisk,
  };
}

export function scoreCandidateAction(
  state: CombatState,
  actor: CombatUnit,
  action: CombatAction,
  context: DecisionContext,
): CandidateUtility {
  const baseUtility = calculateBaseUtility(state, actor, action);
  const personalityContribution = calculatePersonalityContribution(
    action,
    context.personality.innate,
    context.personality.emotion.fear,
    context.personality.emotion.anger,
  );
  const teamStrategyContribution = calculateStrategyContribution(action, context);
  const learningContext = extractLearningContext(state, actor, action);
  const learnedPreferenceContribution = calculateContextualLearnedContribution(
    context.personality,
    getActionCategory(action),
    learningContext,
  );
  const recalled = context.memoryProfile
    ? recallMemories(context.memoryProfile, createMemoryRecallContext(state, actor, action))
    : { memories: [], totalUtilityContribution: 0 };
  const memoryContribution = recalled.totalUtilityContribution;
  const finalUtility = clamp(
    baseUtility + personalityContribution + teamStrategyContribution + learnedPreferenceContribution + memoryContribution,
    -50,
    150,
  );
  return {
    action,
    baseUtility: roundScore(baseUtility),
    personalityContribution: roundScore(personalityContribution),
    teamStrategyContribution: roundScore(teamStrategyContribution),
    learnedPreferenceContribution: roundScore(learnedPreferenceContribution),
    memoryContribution: roundScore(memoryContribution),
    recalledMemories: recalled.memories,
    finalUtility: roundScore(finalUtility),
    summary: `${getActionCategory(action)} utility ${roundScore(finalUtility)}`,
  };
}

export function decideCombatAction(state: CombatState, context: DecisionContext): DecisionTrace | null {
  const actor = getCurrentActor(state);
  if (!actor?.alive) return null;
  const candidates = getAvailableActions(state, actor.id)
    .map((action) => scoreCandidateAction(state, actor, action, context))
    .sort((left, right) => right.finalUtility - left.finalUtility ||
      actionKey(left.action).localeCompare(actionKey(right.action)));
  const selected = candidates[0];
  if (!selected) return null;
  return {
    heroInstanceId: actor.sourceId,
    selectedAction: selected.action,
    selectedTargetId: selected.action.targetId,
    candidates,
    recalledMemories: selected.recalledMemories,
    reason: `Selected ${actionKey(selected.action)} with the highest bounded utility (${selected.finalUtility}).`,
  };
}
