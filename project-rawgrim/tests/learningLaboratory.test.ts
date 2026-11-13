import { describe, expect, it } from 'vitest';
import { SANDBOX_ENEMIES } from '../src/features/combat/data/enemyDefinitions.ts';
import { runLearningLaboratory } from '../src/features/learning/domain/trainingLab.ts';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';
import { initialHeroRoster, initialPartyFormation } from '../src/features/heroes/data/initialRoster.ts';

describe('learning laboratory', () => {
  it('is deterministic and keeps source hero profiles isolated', () => {
    const snapshot = structuredClone(initialHeroRoster);
    const options = {
      roster: initialHeroRoster,
      formation: initialPartyFormation,
      definitions: heroDefinitions,
      enemies: SANDBOX_ENEMIES,
      selectedHeroId: 'hero-valdris-001',
      teamStrategy: 'Balanced' as const,
      seed: 42,
      repetitions: 2,
    };

    const first = runLearningLaboratory(options);
    const second = runLearningLaboratory(options);

    expect(first).toEqual(second);
    expect(first.updates.length).toBeGreaterThan(0);
    expect(first.trainedPersonality.innate).toEqual(
      initialHeroRoster.find((hero) => hero.id === options.selectedHeroId)?.personality?.innate,
    );
    expect(initialHeroRoster).toEqual(snapshot);
  });

  it('compares the same evaluation encounter before and after training', () => {
    const result = runLearningLaboratory({
      roster: initialHeroRoster,
      formation: initialPartyFormation,
      definitions: heroDefinitions,
      enemies: SANDBOX_ENEMIES,
      selectedHeroId: 'hero-valdris-001',
      teamStrategy: 'Balanced',
      seed: 77,
      repetitions: 1,
    });

    expect(result.evaluationSeed).toBe(77);
    expect(result.beforeDecision?.heroInstanceId).toBe('hero-valdris-001');
    expect(result.afterDecision?.heroInstanceId).toBe('hero-valdris-001');
  });
});
