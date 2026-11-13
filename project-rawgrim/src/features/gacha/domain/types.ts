import type { HeroDefinition, HeroInstance, HeroRarity } from '../../heroes/domain/types.ts';

export type RandomSource = () => number;
export type HeroIdGenerator = () => string;
export type SummonCount = 1 | 10;

export interface RarityProbability {
  rarity: HeroRarity;
  probability: number;
}

export interface GachaConfig {
  rarityProbabilities: readonly RarityProbability[];
  costs: Readonly<Record<SummonCount, number>>;
  maximumRarity: HeroRarity;
}

export type GachaValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

export interface SummonGameState {
  crystals: number;
  roster: HeroInstance[];
}

export interface SummonResultEntry {
  instance: HeroInstance;
  definition: HeroDefinition;
  isDuplicate: boolean;
}

export type SummonFailureCode =
  | 'invalid-request'
  | 'invalid-configuration'
  | 'insufficient-crystals'
  | 'generation-failed'
  | 'request-in-progress'
  | 'persistence-failed';

export interface SummonFailure {
  ok: false;
  code: SummonFailureCode;
  message: string;
}

export interface SummonSuccess {
  ok: true;
  nextState: SummonGameState;
  results: SummonResultEntry[];
}

export type SummonTransactionResult = SummonSuccess | SummonFailure;
