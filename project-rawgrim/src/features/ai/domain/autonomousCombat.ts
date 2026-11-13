import { advanceTurn, getCurrentActor, resolveAction } from '../../combat/domain/combatEngine.ts';
import type { CombatState } from '../../combat/domain/types.ts';
import {
  createNeutralEmotionalState,
  createNeutralLearnedPreferences,
} from '../../heroes/domain/personality.ts';
import { createNeutralLearningProfile } from '../../learning/domain/learningProfile.ts';
import type { DecisionContext } from './types.ts';
import type { AutonomousStepResult, DecisionContextResolver, DecisionTrace } from './types.ts';
import { decideCombatAction } from './utilityAI.ts';

export function createNeutralDecisionContext(identityId: string): DecisionContext {
  return {
    teamStrategy: 'Balanced',
    personality: {
      identityId: `neutral:${identityId}`,
      innateTraitId: 'neutral-enemy',
      innate: {
        courage: 50, discipline: 50, aggression: 50, empathy: 50,
        selfPreservation: 50, ambition: 50, trust: 50,
      },
      learned: createNeutralLearnedPreferences(),
      emotion: createNeutralEmotionalState(),
      learning: createNeutralLearningProfile(),
    },
  };
}

export function stepAutonomousCombat(
  state: CombatState,
  resolveContext: DecisionContextResolver,
): AutonomousStepResult {
  if (state.result.outcome !== 'ongoing') return { state, decision: null };
  const actor = getCurrentActor(state);
  if (!actor?.alive) return { state: advanceTurn(state), decision: null };
  const context = actor.side === 'allies'
    ? resolveContext(actor.sourceId)
    : createNeutralDecisionContext(actor.sourceId);
  const decision = decideCombatAction(state, context);
  if (!decision) return { state, decision: null };
  const resolution = resolveAction(state, decision.selectedAction);
  if (!resolution.ok) return { state, decision };
  return {
    state: resolution.state.result.outcome === 'ongoing'
      ? advanceTurn(resolution.state)
      : resolution.state,
    decision,
  };
}

export interface AutonomousCombatResult {
  state: CombatState;
  decisions: readonly DecisionTrace[];
}

export function runAutonomousCombat(
  initialState: CombatState,
  resolveContext: DecisionContextResolver,
): AutonomousCombatResult {
  let state = initialState;
  const decisions: DecisionTrace[] = [];
  const maximumActions = state.maxRounds * Math.max(1, state.units.length);
  for (let index = 0; index < maximumActions && state.result.outcome === 'ongoing'; index += 1) {
    const step = stepAutonomousCombat(state, resolveContext);
    if (step.decision) decisions.push(step.decision);
    if (step.state === state) break;
    state = step.state;
  }
  return { state, decisions };
}
