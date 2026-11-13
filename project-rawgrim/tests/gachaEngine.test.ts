import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';
import { GACHA_CONFIG } from '../src/features/gacha/domain/gachaConfig.ts';
import {
  createSeededRandom,
  generateHeroInstances,
  selectWeightedRarity,
  summonSingle,
  summonTen,
  validateGachaConfig,
} from '../src/features/gacha/domain/summonEngine.ts';
import type { RandomSource } from '../src/features/gacha/domain/types.ts';

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) throw new Error('Random sequence exhausted');
    return value;
  };
}

describe('gacha configuration', () => {
  it('accepts the configured probability table and eligible definitions', () => {
    expect(validateGachaConfig(GACHA_CONFIG, heroDefinitions)).toEqual({ valid: true });
  });

  it('rejects probabilities that do not total one hundred percent', () => {
    const result = validateGachaConfig(
      { ...GACHA_CONFIG, rarityProbabilities: [{ rarity: 1, probability: 0.9 }] },
      heroDefinitions,
    );

    expect(result).toEqual({
      valid: false,
      errors: ['Rarity probabilities must sum to 1'],
    });
  });

  it('rejects enabled rarities without an eligible hero definition', () => {
    const result = validateGachaConfig(GACHA_CONFIG, heroDefinitions.filter((hero) => hero.rarity !== 5));

    expect(result).toEqual({
      valid: false,
      errors: ['Rarity 5 has no eligible hero definitions'],
    });
  });

  it('rejects non-finite probability values', () => {
    const result = validateGachaConfig(
      { ...GACHA_CONFIG, rarityProbabilities: [{ rarity: 1, probability: Number.NaN }] },
      heroDefinitions,
    );

    expect(result.valid).toBe(false);
  });
});

describe('weighted rarity selection', () => {
  it.each([
    [0, 1],
    [0.499999, 1],
    [0.5, 2],
    [0.799999, 2],
    [0.8, 3],
    [0.949999, 3],
    [0.95, 4],
    [0.989999, 4],
    [0.99, 5],
    [0.999999, 5],
  ] as const)('maps roll %s to %s-star', (roll, expected) => {
    expect(selectWeightedRarity(GACHA_CONFIG.rarityProbabilities, () => roll)).toBe(expected);
  });
});

describe('hero generation', () => {
  it('exposes single and ten summon operations with the requested counts', () => {
    const single = summonSingle(GACHA_CONFIG, heroDefinitions, () => 0, () => 'single');
    let id = 0;
    const ten = summonTen(GACHA_CONFIG, heroDefinitions, () => 0, () => `ten-${++id}`);

    expect(single.id).toBe('single');
    expect(ten).toHaveLength(10);
  });

  it('replays the same summon sequence from the same seed', () => {
    const summon = (seed: number) => generateHeroInstances(
      10,
      GACHA_CONFIG,
      heroDefinitions,
      createSeededRandom(seed),
      (() => { let id = 0; return () => `seeded-${++id}`; })(),
    ).map((hero) => hero.definitionId);

    expect(summon(42)).toEqual(summon(42));
  });

  it('produces deterministic heroes with an injected random source', () => {
    const random = sequenceRandom([0.99, 0, 0, 0]);
    const ids = ['summon-a', 'summon-b'];
    let idIndex = 0;

    const heroes = generateHeroInstances(2, GACHA_CONFIG, heroDefinitions, random, () => ids[idIndex++]);

    expect(heroes.map((hero) => ({ id: hero.id, definitionId: hero.definitionId }))).toEqual([
      { id: 'summon-a', definitionId: 'valdris-ashen-blade' },
      { id: 'summon-b', definitionId: 'tovin-ratcatcher' },
    ]);
  });

  it('creates unique instances when the same definition is summoned twice', () => {
    const heroes = generateHeroInstances(
      2,
      GACHA_CONFIG,
      heroDefinitions,
      sequenceRandom([0.99, 0, 0.99, 0]),
      (() => {
        let id = 0;
        return () => `unique-${++id}`;
      })(),
    );

    expect(heroes[0].definitionId).toBe(heroes[1].definitionId);
    expect(heroes[0].id).not.toBe(heroes[1].id);
  });

  it('rejects duplicate generated instance ids', () => {
    expect(() =>
      generateHeroInstances(
        2,
        GACHA_CONFIG,
        heroDefinitions,
        sequenceRandom([0, 0, 0, 0]),
        () => 'collision',
      ),
    ).toThrow('Generated hero instance IDs must be unique');
  });
});
