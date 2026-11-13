import type { CombatOutcome } from '../../combat/domain/types.ts';
import type {
  LearningObservation,
  LearningSignal,
  LearningSignalComponents,
} from './types.ts';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateLearningSignal(
  observation: LearningObservation,
  battleOutcome: CombatOutcome,
): LearningSignal {
  const outcome = observation.outcome;
  const targetMaxHp = Math.max(1, safeNonNegative(outcome.targetMaxHp));
  const healingCapacity = safeNonNegative(outcome.healingCapacity);
  const actorMaxHp = Math.max(1, safeNonNegative(outcome.actorMaxHp));
  const damage = clamp(safeNonNegative(outcome.damageDealt) / targetMaxHp, 0, 1) * 0.6;
  const healing = clamp(safeNonNegative(outcome.healingDone) / Math.max(1, healingCapacity), 0, 1) * 0.6;
  const wastedHealing = healingCapacity > 0
    ? -clamp(safeNonNegative(outcome.wastedHealing) / healingCapacity, 0, 1) * 0.5
    : 0;
  const elimination = outcome.targetEliminated ? 0.35 : 0;
  const mitigation = clamp(safeNonNegative(outcome.mitigatedDamage) / actorMaxHp, 0, 1) * 0.5;
  const selfEndangerment = outcome.severeSelfEndangerment && observation.actorClass !== 'Tank' ? -0.35 : 0;
  const allyRisk = clamp(Number.isFinite(observation.context.allySurvivalRisk)
    ? observation.context.allySurvivalRisk : 0, 0, 1);
  const allyLoss = -Math.min(0.2, safeNonNegative(outcome.allyLosses) * 0.05) * allyRisk;
  const resultSignal = battleOutcome === 'victory' ? 0.1 : battleOutcome === 'defeat' ? -0.1 : 0;
  const components: LearningSignalComponents = {
    damage: round(damage),
    healing: round(healing),
    wastedHealing: round(wastedHealing),
    elimination,
    mitigation: round(mitigation),
    selfEndangerment,
    allyLoss: round(allyLoss),
    battleOutcome: resultSignal,
  };
  const rationale = Object.entries(components)
    .filter(([, value]) => value !== 0)
    .map(([name, value]) => `${name}:${value > 0 ? '+' : ''}${value}`);
  return {
    reward: round(clamp(Object.values(components).reduce((sum, value) => sum + value, 0), -1, 1)),
    components,
    rationale,
  };
}
