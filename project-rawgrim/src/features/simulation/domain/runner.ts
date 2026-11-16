import { getActionCategory } from '../../ai/domain/actionCategory.ts';
import type { DecisionContextResolver, DecisionTrace } from '../../ai/domain/types.ts';
import { heroDefinitions } from '../../heroes/data/heroDefinitions.ts';
import { ensureHeroPersonality } from '../../heroes/domain/personality.ts';
import type { HeroInstance } from '../../heroes/domain/types.ts';
import { runLearningCombat } from '../../learning/domain/experienceCollector.ts';
import { applyCombatExperience } from '../../learning/domain/learningEngine.ts';
import { runLearningLaboratory } from '../../learning/domain/trainingLab.ts';
import type { CombatExperience } from '../../learning/domain/types.ts';
import { normalizeMemoryProfile } from '../../memory/domain/memoryProfile.ts';
import { createPartySocialContexts } from '../../social/domain/socialInfluence.ts';
import { calculateLeadershipEffectiveness } from '../../social/domain/leadership.ts';
import { evaluatePartyChemistry } from '../../social/domain/partyChemistry.ts';
import { initializeCombat } from '../../combat/domain/initialization.ts';
import type { CombatAction, CombatState } from '../../combat/domain/types.ts';
import { createBattleTrace, analyzeDeaths } from './diagnostics.ts';
import { createMetricAccumulator, finalizeMetrics, recordBattleMetrics } from './metrics.ts';
import type { MetricAccumulator } from './metrics.ts';
import { createBalancingReport } from './reporting.ts';
import { assertValidSimulationExperiment } from './validation.ts';
import type {
  AsyncSimulationRunOptions,
  BattleTrace,
  SimulationBattleResult,
  SimulationExperiment,
  SimulationReport,
  SimulationRunOptions,
} from './types.ts';

const TASK_005E_LIMITATION = 'TASK 005E exists, but laboratory battles lack official-expedition authorization and cannot apply permanent consequences.';

function actionKey(action: CombatAction): string {
  return `${action.type}:${action.skillId ?? ''}:${action.targetId}`;
}

function cloneExperiment(experiment: SimulationExperiment): SimulationExperiment {
  return structuredClone(experiment);
}

function createResolver(experiment: SimulationExperiment): DecisionContextResolver {
  const { roster, formation, leaderId, teamStrategy } = experiment.population;
  const socialContexts = createPartySocialContexts(roster, formation, leaderId);
  return (heroInstanceId) => {
    const hero = roster.find((entry) => entry.id === heroInstanceId);
    if (!hero) throw new Error(`Simulation hero ${heroInstanceId} is missing`);
    const definition = heroDefinitions.find((entry) => entry.id === hero.definitionId);
    return {
      personality: ensureHeroPersonality(hero, definition),
      memoryProfile: normalizeMemoryProfile(hero.memory, hero.id),
      social: socialContexts.get(hero.id),
      teamStrategy,
    };
  };
}

function prepareTrainingPhase(experiment: SimulationExperiment): SimulationExperiment {
  const training = experiment.population.training;
  if (!training) return experiment;
  let roster = structuredClone(experiment.population.roster) as HeroInstance[];
  for (const [index, heroId] of training.selectedHeroIds.entries()) {
    const result = runLearningLaboratory({
      roster,
      formation: experiment.population.formation,
      definitions: heroDefinitions,
      enemies: training.scenario.enemies,
      selectedHeroId: heroId,
      teamStrategy: experiment.population.teamStrategy,
      leaderId: experiment.population.leaderId,
      seed: training.baseSeed + index * training.repetitions,
      repetitions: training.repetitions,
    });
    roster = roster.map((hero) => hero.id === heroId
      ? { ...hero, personality: result.trainedPersonality }
      : hero);
  }
  return {
    ...experiment,
    population: { ...experiment.population, roster },
  };
}

function selectedCandidate(decision: DecisionTrace) {
  const key = actionKey(decision.selectedAction);
  return decision.candidates.find((candidate) => actionKey(candidate.action) === key);
}

function hypotheticalLearningMagnitude(roster: readonly HeroInstance[], experience: CombatExperience): number {
  let magnitude = 0;
  for (const hero of roster) {
    const observations = experience.observations.filter((entry) => entry.heroInstanceId === hero.id);
    if (observations.length === 0) continue;
    const definition = heroDefinitions.find((entry) => entry.id === hero.definitionId);
    const result = applyCombatExperience(ensureHeroPersonality(hero, definition), {
      ...experience,
      eligibleForLearning: true,
      observations,
    });
    for (const update of result.updates) {
      magnitude += Math.abs(update.updatedValue - update.previousValue);
      magnitude += Object.values(update.contextWeightChanges)
        .reduce((total, change) => total + Math.abs(change.updated - change.previous), 0);
    }
  }
  return Math.round(magnitude * 10_000) / 10_000;
}

function summarizeBattle(
  experiment: SimulationExperiment,
  seed: number,
  finalState: CombatState,
  decisions: readonly DecisionTrace[],
  experience: CombatExperience,
  captureTrace: boolean,
): SimulationBattleResult {
  const alliedIds = new Set(finalState.units.filter((unit) => unit.side === 'allies').map((unit) => unit.id));
  const damageDealt = finalState.events.filter((event) =>
    event.type === 'damage' && event.actorId && alliedIds.has(event.actorId))
    .reduce((total, event) => total + (event.amount ?? 0), 0);
  const effectiveHealing = finalState.events.filter((event) =>
    event.type === 'healing' && event.actorId && alliedIds.has(event.actorId))
    .reduce((total, event) => total + (event.amount ?? 0), 0);
  const wastedHealing = experience.observations.reduce((total, observation) =>
    total + observation.outcome.wastedHealing, 0);
  const actionDistribution = { offense: 0, healing: 0, defense: 0, activeSkill: 0 };
  const memoryContributions: number[] = [];
  const learnedContributions: number[] = [];
  const relationshipContributions: number[] = [];
  const leadershipContributions: number[] = [];
  const targetDistribution: Record<string, number> = {};
  let strategyAdherentDecisions = 0;
  let strategyRelevantDecisions = 0;
  let invalidActionCount = 0;
  for (const decision of decisions.filter((entry) => alliedIds.has(entry.selectedAction.actorId))) {
    actionDistribution[getActionCategory(decision.selectedAction)] += 1;
    targetDistribution[decision.selectedTargetId] = (targetDistribution[decision.selectedTargetId] ?? 0) + 1;
    const selected = selectedCandidate(decision);
    if (!selected || decision.candidates.some((candidate) => !Number.isFinite(candidate.finalUtility))) {
      invalidActionCount += 1;
    }
    if (!selected) {
      continue;
    }
    if (selected.teamStrategyContribution !== 0) {
      strategyRelevantDecisions += 1;
      if (selected.teamStrategyContribution > 0) strategyAdherentDecisions += 1;
    }
    memoryContributions.push(selected.memoryContribution);
    learnedContributions.push(selected.learnedPreferenceContribution);
    relationshipContributions.push(selected.relationshipContribution);
    leadershipContributions.push(selected.leadershipContribution);
  }
  const classOutcomes = finalState.units.filter((unit) => unit.side === 'allies').flatMap((unit) => {
    const hero = experiment.population.roster.find((entry) => entry.id === unit.sourceId);
    const definition = hero ? heroDefinitions.find((entry) => entry.id === hero.definitionId) : undefined;
    return definition ? [{ heroClass: definition.class, survived: unit.alive }] : [];
  });
  const rarityOutcomes = finalState.units.filter((unit) => unit.side === 'allies').flatMap((unit) => {
    const hero = experiment.population.roster.find((entry) => entry.id === unit.sourceId);
    const definition = hero ? heroDefinitions.find((entry) => entry.id === hero.definitionId) : undefined;
    return definition ? [{ rarity: definition.rarity, survived: unit.alive }] : [];
  });
  const deaths = analyzeDeaths(finalState, experience, decisions);
  return {
    seed,
    outcome: finalState.result.outcome,
    rounds: finalState.result.completedRound,
    heroCount: finalState.units.filter((unit) => unit.side === 'allies').length,
    survivorCount: finalState.units.filter((unit) => unit.side === 'allies' && unit.alive).length,
    damageDealt,
    effectiveHealing,
    wastedHealing,
    defendCount: actionDistribution.defense,
    invalidActionCount,
    actionDistribution,
    targetDistribution,
    severeRiskDecisions: experience.observations.filter((observation) => observation.outcome.severeSelfEndangerment).length,
    observedDecisions: experience.observations.length,
    strategyAdherentDecisions,
    strategyRelevantDecisions,
    learningUpdateMagnitude: hypotheticalLearningMagnitude(experiment.population.roster, experience),
    learnedContributions,
    memoryContributions,
    relationshipContributions,
    leadershipContributions,
    classOutcomes,
    rarityOutcomes,
    diagnostics: captureTrace
      ? createBattleTrace(seed, finalState, experience, decisions, experiment.maxDecisionsPerTrace)
      : null,
    deaths,
  };
}

function simulateSeed(
  experiment: SimulationExperiment,
  resolver: DecisionContextResolver,
  seed: number,
  captureTrace: boolean,
): SimulationBattleResult {
  const initialState = initializeCombat(
    experiment.population.roster,
    experiment.population.formation,
    heroDefinitions,
    experiment.scenario.enemies,
    { seed, maxRounds: experiment.scenario.maxRounds },
  );
  const result = runLearningCombat(initialState, resolver, {
    sessionId: `simulation:${experiment.id}:${seed}`,
    eligibleForLearning: false,
  });
  return summarizeBattle(experiment, seed, result.state, result.decisions, result.experience, captureTrace);
}

interface ExecutionState {
  accumulator: MetricAccumulator;
  traces: BattleTrace[];
  warnings: Set<string>;
}

function createExecutionState(): ExecutionState {
  return { accumulator: createMetricAccumulator(), traces: [], warnings: new Set() };
}

function recordResult(state: ExecutionState, result: SimulationBattleResult): void {
  recordBattleMetrics(state.accumulator, result);
  if (result.diagnostics) {
    state.traces.push(result.diagnostics);
    result.diagnostics.decisions.flatMap((decision) => decision.warnings)
      .forEach((warning) => state.warnings.add(warning));
    result.diagnostics.warnings.forEach((warning) => state.warnings.add(warning));
  }
  if (result.invalidActionCount > 0) state.warnings.add('One or more decisions were invalid or non-finite.');
}

function finalizeReport(
  experiment: SimulationExperiment,
  state: ExecutionState,
  runtimeMs: number,
  memoryDeltaBytes: number | null,
): SimulationReport {
  const firstSeed = experiment.seeds[0] ?? 0;
  const lastSeed = experiment.seeds[experiment.seeds.length - 1] ?? 0;
  const metrics = finalizeMetrics(state.accumulator, runtimeMs, memoryDeltaBytes);
  return {
    reportId: `${experiment.id}:${experiment.aiVersion}:${firstSeed}-${lastSeed}:${experiment.seeds.length}`,
    experimentId: experiment.id,
    aiVersion: experiment.aiVersion,
    configuration: cloneExperiment(experiment),
    seeds: [...experiment.seeds],
    metrics,
    traces: state.traces.map((trace) => structuredClone(trace)),
    warnings: [...state.warnings].sort((left, right) => left.localeCompare(right)),
    limitations: [
      TASK_005E_LIMITATION,
      'Death causality remains insufficient evidence unless a controlled counterfactual replay is performed.',
      'Runtime measurements depend on the executing device and are not deterministic balance evidence.',
    ],
    balancingReport: createBalancingReport(experiment, metrics),
    partyChemistry: evaluatePartyChemistry(
      experiment.population.roster,
      experiment.population.formation,
      experiment.population.leaderId,
    ),
    leadership: calculateLeadershipEffectiveness(
      experiment.population.leaderId,
      experiment.population.roster,
      experiment.population.formation,
    ),
  };
}

export function runSimulationExperiment(
  experiment: SimulationExperiment,
  options: SimulationRunOptions = {},
): SimulationReport {
  assertValidSimulationExperiment(experiment);
  const now = options.now ?? Date.now;
  const started = now();
  const startingMemory = options.memoryUsageBytes?.() ?? null;
  const prepared = prepareTrainingPhase(experiment);
  const state = createExecutionState();
  const resolver = createResolver(prepared);
  prepared.seeds.forEach((seed, index) => {
    const captureTrace = prepared.debugTracing && state.traces.length < prepared.traceLimit;
    recordResult(state, simulateSeed(prepared, resolver, seed, captureTrace && index < prepared.traceLimit));
  });
  const endingMemory = options.memoryUsageBytes?.() ?? null;
  return finalizeReport(
    prepared,
    state,
    Math.max(0, now() - started),
    startingMemory === null || endingMemory === null ? null : endingMemory - startingMemory,
  );
}

function defaultYield(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function runSimulationExperimentAsync(
  experiment: SimulationExperiment,
  options: AsyncSimulationRunOptions = {},
): Promise<SimulationReport> {
  assertValidSimulationExperiment(experiment);
  const chunkSize = options.chunkSize ?? 25;
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) throw new Error('Simulation chunk size must be a positive integer');
  if (options.isCancelled?.()) throw new Error('Simulation cancelled');
  const now = options.now ?? Date.now;
  const started = now();
  const startingMemory = options.memoryUsageBytes?.() ?? null;
  const prepared = prepareTrainingPhase(experiment);
  const state = createExecutionState();
  const resolver = createResolver(prepared);
  for (let index = 0; index < prepared.seeds.length; index += 1) {
    if (options.isCancelled?.()) throw new Error('Simulation cancelled');
    const captureTrace = prepared.debugTracing && state.traces.length < prepared.traceLimit;
    recordResult(state, simulateSeed(prepared, resolver, prepared.seeds[index], captureTrace));
    options.onProgress?.({
      completed: index + 1,
      total: prepared.seeds.length,
      fraction: (index + 1) / prepared.seeds.length,
    });
    if ((index + 1) % chunkSize === 0 && index + 1 < prepared.seeds.length) {
      await (options.yieldControl ?? defaultYield)();
    }
  }
  const endingMemory = options.memoryUsageBytes?.() ?? null;
  return finalizeReport(
    prepared,
    state,
    Math.max(0, now() - started),
    startingMemory === null || endingMemory === null ? null : endingMemory - startingMemory,
  );
}
