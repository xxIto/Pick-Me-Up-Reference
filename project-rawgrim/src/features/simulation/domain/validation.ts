import { getAssignedHeroIds } from '../../heroes/domain/heroRules.ts';
import { validateLeaderAssignment } from '../../social/domain/leadership.ts';
import type { SimulationExperiment, SimulationValidationResult } from './types.ts';

export const MAXIMUM_SIMULATION_COUNT = 10_000;
export const MAXIMUM_TRACE_COUNT = 25;
export const MAXIMUM_DECISIONS_PER_TRACE = 100;

function duplicateValues(values: readonly number[]): boolean {
  return new Set(values).size !== values.length;
}

export function validateSimulationExperiment(experiment: SimulationExperiment): SimulationValidationResult {
  const errors: string[] = [];
  if (experiment.id.trim().length === 0) errors.push('Experiment id is required');
  if (experiment.aiVersion.trim().length === 0) errors.push('AI version is required');
  if (experiment.seeds.length < 1 || experiment.seeds.length > MAXIMUM_SIMULATION_COUNT) {
    errors.push(`Seed count must be between 1 and ${MAXIMUM_SIMULATION_COUNT}`);
  }
  if (experiment.seeds.some((seed) => !Number.isSafeInteger(seed))) {
    errors.push('Every seed must be a finite safe integer');
  }
  if (duplicateValues(experiment.seeds)) errors.push('Simulation seeds must be unique');
  if (!Number.isSafeInteger(experiment.traceLimit) || experiment.traceLimit < 0 ||
    experiment.traceLimit > MAXIMUM_TRACE_COUNT) {
    errors.push(`Trace limit must be between 0 and ${MAXIMUM_TRACE_COUNT}`);
  }
  if (!Number.isSafeInteger(experiment.maxDecisionsPerTrace) || experiment.maxDecisionsPerTrace < 1 ||
    experiment.maxDecisionsPerTrace > MAXIMUM_DECISIONS_PER_TRACE) {
    errors.push(`Decision trace limit must be between 1 and ${MAXIMUM_DECISIONS_PER_TRACE}`);
  }
  if (!Number.isSafeInteger(experiment.scenario.maxRounds) || experiment.scenario.maxRounds < 1) {
    errors.push('Scenario maximum rounds must be a positive integer');
  }
  if (experiment.scenario.enemies.length < 1 || experiment.scenario.enemies.length > 5) {
    errors.push('Scenario must contain between one and five enemies');
  }
  const enemyIds = experiment.scenario.enemies.map((enemy) => enemy.id);
  if (new Set(enemyIds).size !== enemyIds.length) errors.push('Scenario enemy ids must be unique');
  const assignedIds = getAssignedHeroIds(experiment.population.formation);
  if (assignedIds.length < 1 || assignedIds.length > 5) {
    errors.push('Population must deploy between one and five heroes');
  }
  if (new Set(assignedIds).size !== assignedIds.length) errors.push('Population cannot deploy duplicate heroes');
  const rosterIds = new Set(experiment.population.roster.map((hero) => hero.id));
  if (rosterIds.size !== experiment.population.roster.length) errors.push('Population hero ids must be unique');
  if (assignedIds.some((heroId) => !rosterIds.has(heroId))) errors.push('Every deployed hero must exist in the population roster');
  if (assignedIds.some((heroId) => {
    const hero = experiment.population.roster.find((entry) => entry.id === heroId);
    return !hero || hero.status === 'Dead' || hero.currentHp <= 0;
  })) errors.push('Every deployed simulation hero must be alive and available');
  const training = experiment.population.training;
  if (training) {
    if (!Number.isSafeInteger(training.repetitions) || training.repetitions < 1 || training.repetitions > 20) {
      errors.push('Training repetitions must be between 1 and 20');
    }
    if (!Number.isSafeInteger(training.baseSeed) || training.baseSeed < 0) {
      errors.push('Training seed must be a non-negative safe integer');
    }
    if (training.selectedHeroIds.length < 1 ||
      training.selectedHeroIds.some((heroId) => !assignedIds.includes(heroId))) {
      errors.push('Training heroes must be deployed members of the population');
    }
    if (new Set(training.selectedHeroIds).size !== training.selectedHeroIds.length) {
      errors.push('Training hero ids must be unique');
    }
    if (training.scenario.enemies.length < 1 || training.scenario.enemies.length > 5) {
      errors.push('Training scenario must contain between one and five enemies');
    }
  }
  const leaderValidation = validateLeaderAssignment(
    experiment.population.leaderId,
    experiment.population.roster,
    experiment.population.formation,
  );
  if (!leaderValidation.valid) errors.push(leaderValidation.error);
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function assertValidSimulationExperiment(experiment: SimulationExperiment): void {
  const result = validateSimulationExperiment(experiment);
  if (!result.valid) throw new Error(result.errors.join('; '));
}
