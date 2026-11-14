import type { ActionCategory } from '../../ai/domain/actionCategory.ts';
import type { HeroClass, HeroRarity } from '../../heroes/domain/types.ts';
import {
  createDistributionAccumulator,
  createRateMetric,
  finalizeDistribution,
  recordDistributionValue,
} from './statistics.ts';
import type { DistributionAccumulator } from './statistics.ts';
import type {
  GroupOutcomeMetric,
  SimulationBattleResult,
  SimulationMetrics,
} from './types.ts';

interface GroupAccumulator {
  battles: number;
  survived: number;
}

export interface MetricAccumulator {
  battles: number;
  victories: number;
  heroCount: number;
  survivors: number;
  rounds: number;
  damage: number;
  healing: number;
  wastedHealing: number;
  defendCount: number;
  decisionCount: number;
  invalidActionCount: number;
  strategyAdherent: number;
  strategyRelevant: number;
  actionDistribution: Record<ActionCategory, number>;
  targetDistribution: Map<string, number>;
  severeRiskDecisions: number;
  observedDecisions: number;
  learning: DistributionAccumulator;
  memory: DistributionAccumulator;
  relationship: DistributionAccumulator;
  leadership: DistributionAccumulator;
  perClass: Map<HeroClass, GroupAccumulator>;
  perRarity: Map<HeroRarity, GroupAccumulator>;
}

function round(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000;
}

export function createMetricAccumulator(): MetricAccumulator {
  return {
    battles: 0, victories: 0, heroCount: 0, survivors: 0, rounds: 0,
    damage: 0, healing: 0, wastedHealing: 0, defendCount: 0, decisionCount: 0,
    invalidActionCount: 0, strategyAdherent: 0, strategyRelevant: 0,
    actionDistribution: { offense: 0, healing: 0, defense: 0, activeSkill: 0 },
    targetDistribution: new Map(), severeRiskDecisions: 0, observedDecisions: 0,
    learning: createDistributionAccumulator(), memory: createDistributionAccumulator(),
    relationship: createDistributionAccumulator(), leadership: createDistributionAccumulator(),
    perClass: new Map(), perRarity: new Map(),
  };
}

function recordGroup<TKey extends string | number>(
  groups: Map<TKey, GroupAccumulator>,
  key: TKey,
  survived: boolean,
): void {
  const current = groups.get(key) ?? { battles: 0, survived: 0 };
  groups.set(key, { battles: current.battles + 1, survived: current.survived + (survived ? 1 : 0) });
}

export function recordBattleMetrics(accumulator: MetricAccumulator, battle: SimulationBattleResult): void {
  accumulator.battles += 1;
  accumulator.victories += battle.outcome === 'victory' ? 1 : 0;
  accumulator.heroCount += battle.heroCount;
  accumulator.survivors += battle.survivorCount;
  accumulator.rounds += battle.rounds;
  accumulator.damage += battle.damageDealt;
  accumulator.healing += battle.effectiveHealing;
  accumulator.wastedHealing += battle.wastedHealing;
  accumulator.defendCount += battle.defendCount;
  accumulator.invalidActionCount += battle.invalidActionCount;
  accumulator.strategyAdherent += battle.strategyAdherentDecisions;
  accumulator.strategyRelevant += battle.strategyRelevantDecisions;
  accumulator.severeRiskDecisions += battle.severeRiskDecisions;
  accumulator.observedDecisions += battle.observedDecisions;
  for (const category of Object.keys(battle.actionDistribution) as ActionCategory[]) {
    accumulator.actionDistribution[category] += battle.actionDistribution[category];
    accumulator.decisionCount += battle.actionDistribution[category];
  }
  for (const [targetId, count] of Object.entries(battle.targetDistribution)) {
    accumulator.targetDistribution.set(targetId, (accumulator.targetDistribution.get(targetId) ?? 0) + count);
  }
  recordDistributionValue(accumulator.learning, battle.learningUpdateMagnitude);
  battle.memoryContributions.forEach((value) => recordDistributionValue(accumulator.memory, value));
  battle.relationshipContributions.forEach((value) => recordDistributionValue(accumulator.relationship, value));
  battle.leadershipContributions.forEach((value) => recordDistributionValue(accumulator.leadership, value));
  battle.classOutcomes.forEach((entry) => recordGroup(accumulator.perClass, entry.heroClass, entry.survived));
  battle.rarityOutcomes.forEach((entry) => recordGroup(accumulator.perRarity, entry.rarity, entry.survived));
}

function finalizeGroups<TKey extends string | number>(
  groups: Map<TKey, GroupAccumulator>,
): Partial<Record<TKey, GroupOutcomeMetric>> {
  return Object.fromEntries([...groups.entries()].map(([key, value]) => [key, {
    battles: value.battles,
    survived: value.survived,
    survivalRate: createRateMetric(value.survived, value.battles),
  }])) as Partial<Record<TKey, GroupOutcomeMetric>>;
}

export function finalizeMetrics(
  accumulator: MetricAccumulator,
  runtimeMs = 0,
  memoryDeltaBytes: number | null = null,
): SimulationMetrics {
  const battles = accumulator.battles;
  const deaths = accumulator.heroCount - accumulator.survivors;
  return {
    battles,
    winRate: createRateMetric(accumulator.victories, battles),
    survivalRate: createRateMetric(accumulator.survivors, accumulator.heroCount),
    deathRate: createRateMetric(deaths, accumulator.heroCount),
    averageRounds: battles > 0 ? round(accumulator.rounds / battles) : 0,
    averageDamageDealt: battles > 0 ? round(accumulator.damage / battles) : 0,
    averageEffectiveHealing: battles > 0 ? round(accumulator.healing / battles) : 0,
    averageWastedHealing: battles > 0 ? round(accumulator.wastedHealing / battles) : 0,
    defendFrequency: accumulator.decisionCount > 0 ? round(accumulator.defendCount / accumulator.decisionCount) : 0,
    invalidActionCount: accumulator.invalidActionCount,
    actionDistribution: { ...accumulator.actionDistribution },
    targetDistribution: Object.fromEntries([...accumulator.targetDistribution.entries()]
      .sort(([left], [right]) => left.localeCompare(right))),
    riskTakingFrequency: accumulator.observedDecisions > 0
      ? round(accumulator.severeRiskDecisions / accumulator.observedDecisions)
      : 0,
    strategyAdherence: createRateMetric(accumulator.strategyAdherent, accumulator.strategyRelevant),
    learningUpdateMagnitude: finalizeDistribution(accumulator.learning),
    memoryContribution: finalizeDistribution(accumulator.memory),
    relationshipContribution: finalizeDistribution(accumulator.relationship),
    leadershipContribution: finalizeDistribution(accumulator.leadership),
    perClass: finalizeGroups(accumulator.perClass),
    perRarity: finalizeGroups(accumulator.perRarity),
    runtimeMs: round(runtimeMs),
    averageRuntimePerBattleMs: battles > 0 ? round(runtimeMs / battles) : 0,
    memoryDeltaBytes: memoryDeltaBytes === null ? null : Math.round(Number.isFinite(memoryDeltaBytes) ? memoryDeltaBytes : 0),
  };
}
