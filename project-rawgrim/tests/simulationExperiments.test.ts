import { describe, expect, it } from 'vitest';
import { createExperiment, simulationPopulations } from '../src/features/simulation/data/experiments.ts';
import { validateSimulationExperiment } from '../src/features/simulation/domain/validation.ts';

describe('simulation experiment catalog', () => {
  it('provides valid baseline, personality, rarity, memory, social, and leadership populations', () => {
    const ids = simulationPopulations.map((population) => population.id);
    expect(ids).toEqual(expect.arrayContaining([
      'baseline', 'aggressive', 'disciplined', 'low-rarity-veterans', 'high-rarity-recruits',
      'relevant-trained', 'unrelated-trained', 'adverse-trained',
      'relevant-memory', 'irrelevant-memory', 'maximum-memory',
      'trusted-party', 'one-sided-trust', 'strong-rivalry', 'respect-without-affection',
      'familiar-low-trust', 'distrusted-leader', 'high-discipline-leader', 'low-discipline-leader', 'no-leader',
    ]));

    for (const population of simulationPopulations) {
      const experiment = createExperiment({
        id: `catalog:${population.id}`, scenarioId: 'skirmish', populationId: population.id,
        count: 1, baseSeed: 1,
      });
      expect(validateSimulationExperiment(experiment)).toEqual({ valid: true });
    }
  });

  it('keeps the maximum-memory benchmark within the existing retention capacity', () => {
    const population = simulationPopulations.find((entry) => entry.id === 'maximum-memory');
    const deployed = population?.roster.find((hero) => population.formation.frontline.includes(hero.id));
    expect(deployed?.memory?.memories).toHaveLength(100);
  });

  it('creates fresh experiment graphs without shared mutable profiles', () => {
    const first = createExperiment({
      id: 'first', scenarioId: 'skirmish', populationId: 'baseline', count: 1, baseSeed: 1,
    });
    const second = createExperiment({
      id: 'second', scenarioId: 'skirmish', populationId: 'baseline', count: 1, baseSeed: 1,
    });

    expect(first.population).not.toBe(second.population);
    expect(first.population.roster[0]?.personality).not.toBe(second.population.roster[0]?.personality);
    expect(first.population.roster[0]?.memory).not.toBe(second.population.roster[0]?.memory);
    expect(first.population.roster[0]?.relationships).not.toBe(second.population.roster[0]?.relationships);
  });
});
