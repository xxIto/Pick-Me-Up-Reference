import { describe, expect, it } from 'vitest';
import { createMetricAccumulator, finalizeMetrics, recordBattleMetrics } from '../src/features/simulation/domain/metrics.ts';
import { wilsonInterval } from '../src/features/simulation/domain/statistics.ts';
import type { SimulationBattleResult } from '../src/features/simulation/domain/types.ts';

function battle(overrides: Partial<SimulationBattleResult> = {}): SimulationBattleResult {
  return {
    seed: 1, outcome: 'victory', rounds: 4, heroCount: 2, survivorCount: 2,
    damageDealt: 100, effectiveHealing: 20, wastedHealing: 5, defendCount: 1,
    invalidActionCount: 0, actionDistribution: { offense: 2, healing: 1, defense: 1, activeSkill: 0 },
    targetDistribution: { 'enemy:one': 2, 'ally:one': 1 }, severeRiskDecisions: 1, observedDecisions: 4,
    strategyAdherentDecisions: 2, strategyRelevantDecisions: 3,
    learningUpdateMagnitude: 0,
    learnedContributions: [1],
    memoryContributions: [2], relationshipContributions: [1], leadershipContributions: [0.5],
    classOutcomes: [{ heroClass: 'Warrior', survived: true }],
    rarityOutcomes: [{ rarity: 3, survived: true }],
    diagnostics: null, deaths: [],
    ...overrides,
  };
}

describe('simulation metric aggregation', () => {
  it('calculates Wilson intervals without non-finite values', () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 0 });
    const interval = wilsonInterval(50, 100);
    expect(interval.lower).toBeGreaterThan(0.39);
    expect(interval.upper).toBeLessThan(0.61);
  });

  it('aggregates deterministic rates, totals, and bounded modifier distributions', () => {
    const accumulator = createMetricAccumulator();
    recordBattleMetrics(accumulator, battle());
    recordBattleMetrics(accumulator, battle({
      seed: 2, outcome: 'defeat', survivorCount: 0, damageDealt: 20,
      memoryContributions: [-2], relationshipContributions: [-1], leadershipContributions: [-0.5],
      classOutcomes: [{ heroClass: 'Warrior', survived: false }],
      rarityOutcomes: [{ rarity: 3, survived: false }],
    }));
    const metrics = finalizeMetrics(accumulator);

    expect(metrics.battles).toBe(2);
    expect(metrics.winRate.rate).toBe(0.5);
    expect(metrics.survivalRate.rate).toBe(0.5);
    expect(metrics.averageDamageDealt).toBe(60);
    expect(metrics.memoryContribution.mean).toBe(0);
    expect(metrics.learnedContribution.mean).toBe(1);
    expect(metrics.actionDistribution.offense).toBe(4);
    expect(metrics.targetDistribution['enemy:one']).toBe(4);
    expect(metrics.riskTakingFrequency).toBe(0.25);
    expect(JSON.stringify(metrics)).not.toMatch(/NaN|Infinity/);
  });
});
