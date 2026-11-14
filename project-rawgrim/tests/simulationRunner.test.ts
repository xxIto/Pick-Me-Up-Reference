import { describe, expect, it } from 'vitest';
import { createExperiment } from '../src/features/simulation/data/experiments.ts';
import { runSimulationExperiment, runSimulationExperimentAsync } from '../src/features/simulation/domain/runner.ts';
import { compareSimulationReports } from '../src/features/simulation/domain/reporting.ts';

describe('headless simulation runner', () => {
  it('reproduces identical reports for identical experiments apart from measured runtime', () => {
    const experiment = createExperiment({
      id: 'reproducibility', scenarioId: 'skirmish', populationId: 'baseline', count: 3, baseSeed: 31,
    });
    const first = runSimulationExperiment(experiment, { now: () => 0 });
    const second = runSimulationExperiment(structuredClone(experiment), { now: () => 0 });

    expect(first).toEqual(second);
    expect(first.metrics.battles).toBe(3);
    expect(first.seeds).toEqual([31, 32, 33]);
    expect(JSON.stringify(first)).not.toMatch(/NaN|Infinity/);
    expect(first.balancingReport.executiveSummary.length).toBeGreaterThan(0);
    expect(compareSimulationReports(first, second)).toMatchObject({
      matchedSeeds: true,
      sampleSize: 3,
      absoluteDifferences: { winRate: 0, survivalRate: 0 },
    });
  });

  it('does not mutate roster, learning, memory, relationships, formation, or status', () => {
    const experiment = createExperiment({
      id: 'isolation', scenarioId: 'skirmish', populationId: 'trusted-party', count: 2, baseSeed: 7,
    });
    const snapshot = structuredClone(experiment);

    const report = runSimulationExperiment(experiment, { now: () => 0 });

    expect(experiment).toEqual(snapshot);
    expect(report.limitations).toContain('TASK 005E permanent-death and survivor-consequence systems are not present in this repository.');
  });

  it('bounds detailed traces while aggregating every battle', () => {
    const experiment = createExperiment({
      id: 'bounded-traces', scenarioId: 'skirmish', populationId: 'baseline', count: 4, baseSeed: 1,
      traceLimit: 1,
    });
    const report = runSimulationExperiment(experiment, { now: () => 0 });

    expect(report.metrics.battles).toBe(4);
    expect(report.traces.length).toBeLessThanOrEqual(1);
    expect(report.traces[0]?.decisions.length).toBeLessThanOrEqual(experiment.maxDecisionsPerTrace);
  });

  it('separates relevant memory influence from irrelevant memory', () => {
    const relevant = runSimulationExperiment(createExperiment({
      id: 'relevant-memory-check', scenarioId: 'skirmish', populationId: 'relevant-memory', count: 1, baseSeed: 9,
    }), { now: () => 0 });
    const irrelevant = runSimulationExperiment(createExperiment({
      id: 'irrelevant-memory-check', scenarioId: 'skirmish', populationId: 'irrelevant-memory', count: 1, baseSeed: 9,
    }), { now: () => 0 });

    expect(relevant.metrics.memoryContribution.meanAbsolute).toBeGreaterThan(0);
    expect(irrelevant.metrics.memoryContribution.meanAbsolute).toBe(0);
  });

  it('supports asynchronous progress and cancellation without returning a partial complete report', async () => {
    const experiment = createExperiment({
      id: 'cancel', scenarioId: 'skirmish', populationId: 'baseline', count: 4, baseSeed: 1,
    });
    let cancelled = false;
    const progress: number[] = [];

    await expect(runSimulationExperimentAsync(experiment, {
      chunkSize: 1,
      isCancelled: () => cancelled,
      onProgress: (update) => {
        progress.push(update.completed);
        if (update.completed === 1) cancelled = true;
      },
      yieldControl: async () => undefined,
      now: () => 0,
    })).rejects.toThrow('Simulation cancelled');
    expect(progress).toEqual([1]);
  });
});
