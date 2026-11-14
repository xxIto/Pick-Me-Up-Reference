import { getActionCategory } from '../../ai/domain/actionCategory.ts';
import { stepAutonomousCombat } from '../../ai/domain/autonomousCombat.ts';
import type { DecisionContextResolver, DecisionTrace } from '../../ai/domain/types.ts';
import { getCombatSkill } from '../../combat/data/combatSkills.ts';
import { calculateHealing } from '../../combat/domain/calculations.ts';
import { getCurrentActor } from '../../combat/domain/combatEngine.ts';
import type { CombatAction, CombatState, CombatUnit } from '../../combat/domain/types.ts';
import type { HeroClass } from '../../heroes/domain/types.ts';
import { extractLearningContext } from './context.ts';
import type { CombatExperience, LearningObservation } from './types.ts';

export interface LearningCombatOptions {
  sessionId: string;
  eligibleForLearning?: boolean;
}

export interface LearningCombatResult {
  state: CombatState;
  decisions: readonly DecisionTrace[];
  experience: CombatExperience;
}

function getUnit(state: CombatState, unitId: string): CombatUnit | null {
  return state.units.find((unit) => unit.id === unitId) ?? null;
}

function healingCapacity(actor: CombatUnit, action: CombatAction): number {
  const skill = action.skillId ? getCombatSkill(action.skillId) : null;
  return skill?.kind === 'healing' ? calculateHealing(actor.stats, skill.multiplier) : 0;
}

function createObservation(
  before: CombatState,
  after: CombatState,
  actor: CombatUnit,
  decision: DecisionTrace,
  sessionId: string,
  observationSequence: number,
): LearningObservation {
  const action = decision.selectedAction;
  const targetBefore = getUnit(before, action.targetId);
  const targetAfter = getUnit(after, action.targetId);
  const category = getActionCategory(action);
  const damageDealt = targetBefore && targetAfter && targetBefore.side !== actor.side
    ? Math.max(0, targetBefore.currentHp - targetAfter.currentHp)
    : 0;
  const healingDone = targetBefore && targetAfter && targetBefore.side === actor.side
    ? Math.max(0, targetAfter.currentHp - targetBefore.currentHp)
    : 0;
  const capacity = healingCapacity(actor, action);
  return {
    heroInstanceId: actor.sourceId,
    sessionId,
    observationSequence,
    round: before.round,
    actorClass: actor.class as HeroClass,
    context: extractLearningContext(before, actor, action),
    selectedCategory: category,
    selectedAction: { ...action },
    validAlternativeCategories: [...new Set(
      decision.candidates.map((candidate) => getActionCategory(candidate.action)),
    )].filter((candidate) => candidate !== category),
    validCandidateActions: decision.candidates.map((candidate) => ({ ...candidate.action })),
    outcome: {
      damageDealt,
      targetMaxHp: targetBefore?.stats.maxHp ?? 1,
      healingDone,
      healingCapacity: capacity,
      wastedHealing: Math.max(0, capacity - healingDone),
      targetEliminated: Boolean(targetBefore?.alive && targetAfter && !targetAfter.alive),
      mitigatedDamage: 0,
      actorMaxHp: actor.stats.maxHp,
      severeSelfEndangerment: category !== 'defense' && actor.currentHp / actor.stats.maxHp <= 0.25,
      allyLosses: 0,
    },
  };
}

export function runLearningCombat(
  initialState: CombatState,
  resolveContext: DecisionContextResolver,
  options: LearningCombatOptions,
): LearningCombatResult {
  if (options.sessionId.trim().length === 0) throw new Error('Learning session id is required');
  let state = initialState;
  const decisions: DecisionTrace[] = [];
  const observations: LearningObservation[] = [];
  const pendingDefense = new Map<string, number>();
  const maximumActions = state.maxRounds * Math.max(1, state.units.length);

  for (let index = 0; index < maximumActions && state.result.outcome === 'ongoing'; index += 1) {
    const before = state;
    const actor = getCurrentActor(before);
    const step = stepAutonomousCombat(before, resolveContext);
    if (step.decision) decisions.push(step.decision);

    const newEvents = step.state.events.slice(before.events.length);
    for (const event of newEvents) {
      if (event.type !== 'damage' || !event.targetId || !event.mitigatedAmount) continue;
      const target = getUnit(before, event.targetId);
      if (!target || target.side !== 'allies') continue;
      const observationIndex = pendingDefense.get(target.sourceId);
      if (observationIndex === undefined) continue;
      const observation = observations[observationIndex];
      observation.outcome.mitigatedDamage += event.mitigatedAmount;
    }

    if (actor?.alive && actor.side === 'allies' && actor.class !== 'Enemy' && step.decision) {
      const observation = createObservation(
        before,
        step.state,
        actor,
        step.decision,
        options.sessionId,
        observations.length,
      );
      observations.push(observation);
      if (observation.selectedCategory === 'defense') {
        pendingDefense.set(actor.sourceId, observations.length - 1);
      } else {
        pendingDefense.delete(actor.sourceId);
      }
    }
    if (step.state === state) break;
    state = step.state;
  }

  const defeatedAllies = state.units.filter((unit) => unit.side === 'allies' && !unit.alive);
  const finalized = observations.map((observation) => ({
    ...observation,
    selectedAction: { ...observation.selectedAction },
    context: { ...observation.context },
    validAlternativeCategories: [...observation.validAlternativeCategories],
    validCandidateActions: observation.validCandidateActions.map((action) => ({ ...action })),
    outcome: {
      ...observation.outcome,
      allyLosses: defeatedAllies.filter((unit) => unit.sourceId !== observation.heroInstanceId).length,
    },
  }));
  return {
    state,
    decisions,
    experience: {
      sessionId: options.sessionId,
      outcome: state.result.outcome,
      observations: finalized,
      eligibleForLearning: options.eligibleForLearning ?? false,
    },
  };
}
