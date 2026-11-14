import type { DecisionTrace } from '../../ai/domain/types.ts';
import type { CombatAction, CombatState } from '../../combat/domain/types.ts';
import type { CombatExperience } from '../../learning/domain/types.ts';
import type { BattleTrace, DeathAnalysisEntry, DecisionDiagnostic } from './types.ts';

function sameAction(left: CombatAction, right: CombatAction): boolean {
  return left.type === right.type && left.targetId === right.targetId && left.skillId === right.skillId;
}

function decisionWarnings(decision: DecisionTrace): string[] {
  const warnings: string[] = [];
  const selected = decision.candidates.find((candidate) => sameAction(candidate.action, decision.selectedAction));
  if (!selected) warnings.push('Selected action was absent from the candidate set.');
  if (decision.candidates.some((candidate) => !Number.isFinite(candidate.finalUtility))) {
    warnings.push('A candidate contained a non-finite final utility.');
  }
  if (selected && Math.abs(
    selected.memoryContribution + selected.relationshipContribution + selected.leadershipContribution,
  ) > 30) {
    warnings.push('Combined adaptive and social modifiers exceeded the expected diagnostic threshold.');
  }
  return warnings;
}

export function createDecisionDiagnostic(decision: DecisionTrace): DecisionDiagnostic {
  const selected = decision.candidates.find((candidate) => sameAction(candidate.action, decision.selectedAction));
  return {
    heroInstanceId: decision.heroInstanceId,
    selectedAction: { ...decision.selectedAction },
    selectedUtility: selected?.finalUtility ?? 0,
    alternatives: decision.candidates.map((candidate) => structuredClone(candidate)),
    warnings: decisionWarnings(decision),
  };
}

export function analyzeDeaths(
  state: CombatState,
  experience: CombatExperience,
  decisions: readonly DecisionTrace[],
): DeathAnalysisEntry[] {
  return state.units.filter((unit) => unit.side === 'allies' && !unit.alive).map((unit) => {
    const observations = experience.observations.filter((entry) => entry.heroInstanceId === unit.sourceId);
    const risky = observations.some((entry) => entry.outcome.severeSelfEndangerment);
    const defensiveAlternative = observations.some((entry) => entry.validAlternativeCategories.includes('defense'));
    const invalidDecision = decisions.some((decision) =>
      decision.heroInstanceId === unit.sourceId &&
      !decision.candidates.some((candidate) => sameAction(candidate.action, decision.selectedAction)));
    const evidence = [
      `Hero was defeated by round ${state.result.completedRound}.`,
      ...(risky ? ['Hero acted while at or below the severe self-endangerment threshold.'] : []),
      ...(defensiveAlternative ? ['At least one earlier decision exposed a legal defensive alternative.'] : []),
      'No controlled counterfactual replay was executed for this death.',
    ];
    return {
      heroInstanceId: unit.sourceId,
      cause: invalidDecision ? 'invalid-game-state' : 'insufficient-evidence',
      evidence,
      legalAlternativeObserved: defensiveAlternative,
      counterfactualTested: false,
      counterfactualPreventedDeath: null,
    };
  });
}

export function createBattleTrace(
  seed: number,
  state: CombatState,
  experience: CombatExperience,
  decisions: readonly DecisionTrace[],
  maximumDecisions: number,
): BattleTrace {
  const selectedKeys = decisions.map((decision) =>
    `${decision.selectedAction.type}:${decision.selectedAction.skillId ?? ''}:${decision.selectedAction.targetId}`);
  const frequencies = new Map<string, number>();
  selectedKeys.forEach((key) => frequencies.set(key, (frequencies.get(key) ?? 0) + 1));
  const maximumFrequency = Math.max(0, ...frequencies.values());
  return {
    seed,
    outcome: state.result.outcome,
    rounds: state.result.completedRound,
    decisions: decisions.slice(0, maximumDecisions).map(createDecisionDiagnostic),
    deaths: analyzeDeaths(state, experience, decisions),
    warnings: decisions.length >= 10 && maximumFrequency / decisions.length >= 0.9
      ? ['At least 90% of decisions repeated the same action and target; inspect scenario validity and utility separation.']
      : [],
  };
}
