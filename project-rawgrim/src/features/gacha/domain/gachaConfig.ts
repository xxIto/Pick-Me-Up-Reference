import type { GachaConfig } from './types.ts';

export const GACHA_CONFIG: GachaConfig = {
  rarityProbabilities: [
    { rarity: 1, probability: 0.5 },
    { rarity: 2, probability: 0.3 },
    { rarity: 3, probability: 0.15 },
    { rarity: 4, probability: 0.04 },
    { rarity: 5, probability: 0.01 },
  ],
  costs: {
    1: 100,
    10: 1_000,
  },
  maximumRarity: 5,
};
