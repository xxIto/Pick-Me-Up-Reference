import { describe, expect, it } from 'vitest';
import { createExperiment, simulationPopulations, simulationScenarios } from '../src/features/simulation/data/experiments.ts';
import { validateSimulationExperiment } from '../src/features/simulation/domain/validation.ts';

describe('simulation experiment validation', () => {
  it('accepts a reproducible experiment with explicit seeds', () => {
    const experiment = createExperiment({
      id: 'validation', scenarioId: 'skirmish', populationId: 'baseline', count: 3, baseSeed: 10,
    });

    expect(validateSimulationExperiment(experiment)).toEqual({ valid: true });
    expect(experiment.seeds).toEqual([10, 11, 12]);
  });

  it('constructs the supported 100, 1000, and 10000 battle seed batches', () => {
    for (const count of [100, 1_000, 10_000]) {
      const experiment = createExperiment({
        id: `batch-${count}`, scenarioId: 'skirmish', populationId: 'baseline', count, baseSeed: 50,
      });
      expect(experiment.seeds).toHaveLength(count);
      expect(experiment.seeds.at(-1)).toBe(49 + count);
    }
  });

  it('rejects empty, duplicate, non-finite, and oversized seed sets', () => {
    const base = createExperiment({
      id: 'invalid-seeds', scenarioId: 'skirmish', populationId: 'baseline', count: 2, baseSeed: 1,
    });

    expect(validateSimulationExperiment({ ...base, seeds: [] }).valid).toBe(false);
    expect(validateSimulationExperiment({ ...base, seeds: [1, 1] }).valid).toBe(false);
    expect(validateSimulationExperiment({ ...base, seeds: [1, Number.NaN] }).valid).toBe(false);
    expect(validateSimulationExperiment({ ...base, seeds: Array.from({ length: 10_001 }, (_, index) => index) }).valid).toBe(false);
  });

  it('rejects invalid trace limits and leadership references', () => {
    const base = createExperiment({
      id: 'invalid-leader', scenarioId: 'skirmish', populationId: 'baseline', count: 1, baseSeed: 1,
    });

    expect(validateSimulationExperiment({ ...base, traceLimit: -1 }).valid).toBe(false);
    expect(validateSimulationExperiment({
      ...base,
      population: { ...base.population, leaderId: 'missing' },
    }).valid).toBe(false);
  });

  it('keeps catalog identifiers unique and configurations independent', () => {
    expect(new Set(simulationScenarios.map((entry) => entry.id)).size).toBe(simulationScenarios.length);
    expect(new Set(simulationPopulations.map((entry) => entry.id)).size).toBe(simulationPopulations.length);
    expect(simulationPopulations[0]?.roster).not.toBe(simulationPopulations[1]?.roster);
  });
});
