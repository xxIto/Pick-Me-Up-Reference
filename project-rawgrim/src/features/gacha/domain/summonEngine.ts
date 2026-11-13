import { createHeroInstance } from '../../heroes/domain/heroRules.ts';
import type { HeroDefinition, HeroInstance, HeroRarity } from '../../heroes/domain/types.ts';
import type {
  GachaConfig,
  GachaValidationResult,
  HeroIdGenerator,
  RandomSource,
  RarityProbability,
} from './types.ts';

const PROBABILITY_TOLERANCE = 1e-9;

export function validateGachaConfig(
  config: GachaConfig,
  definitions: readonly HeroDefinition[],
): GachaValidationResult {
  const errors: string[] = [];
  const total = config.rarityProbabilities.reduce((sum, entry) => sum + entry.probability, 0);

  if (!Number.isFinite(total) || Math.abs(total - 1) > PROBABILITY_TOLERANCE) {
    errors.push('Rarity probabilities must sum to 1');
  }

  const seenRarities = new Set<HeroRarity>();
  for (const entry of config.rarityProbabilities) {
    if (!Number.isFinite(entry.probability) || entry.probability <= 0 || entry.probability > 1) {
      errors.push(`Rarity ${entry.rarity} must have a probability between 0 and 1`);
    }
    if (entry.rarity > config.maximumRarity) {
      errors.push(`Rarity ${entry.rarity} exceeds maximum rarity ${config.maximumRarity}`);
    }
    if (seenRarities.has(entry.rarity)) {
      errors.push(`Rarity ${entry.rarity} is configured more than once`);
    }
    seenRarities.add(entry.rarity);
    if (!definitions.some((definition) => definition.rarity === entry.rarity)) {
      errors.push(`Rarity ${entry.rarity} has no eligible hero definitions`);
    }
  }

  if (config.maximumRarity !== 5) errors.push('Maximum rarity must be 5');
  if (config.costs[1] !== 100) errors.push('Single summon cost must be 100 crystals');
  if (config.costs[10] !== 1_000) errors.push('Ten summon cost must be 1000 crystals');

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

function readRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Random source must return a number from 0 inclusive to 1 exclusive');
  }
  return value;
}

export function selectWeightedRarity(
  probabilities: readonly RarityProbability[],
  random: RandomSource,
): HeroRarity {
  const roll = readRandom(random);
  let cumulative = 0;
  for (const entry of probabilities) {
    cumulative += entry.probability;
    const normalizedThreshold = Math.round(cumulative * 1_000_000_000) / 1_000_000_000;
    if (roll < normalizedThreshold) return entry.rarity;
  }
  throw new Error('Rarity probabilities do not cover the random roll');
}

export function selectEligibleHero(
  definitions: readonly HeroDefinition[],
  rarity: HeroRarity,
  random: RandomSource,
): HeroDefinition {
  const eligible = definitions.filter((definition) => definition.rarity === rarity);
  if (eligible.length === 0) throw new Error(`No eligible heroes for rarity ${rarity}`);
  return eligible[Math.floor(readRandom(random) * eligible.length)];
}

export function generateHeroInstances(
  count: number,
  config: GachaConfig,
  definitions: readonly HeroDefinition[],
  random: RandomSource,
  generateId: HeroIdGenerator,
): HeroInstance[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('Summon count must be a positive integer');
  const validation = validateGachaConfig(config, definitions);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const generated: HeroInstance[] = [];
  const generatedIds = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const rarity = selectWeightedRarity(config.rarityProbabilities, random);
    const definition = selectEligibleHero(definitions, rarity, random);
    const id = generateId();
    if (generatedIds.has(id)) throw new Error('Generated hero instance IDs must be unique');
    generatedIds.add(id);
    generated.push(createHeroInstance(definition, id, random));
  }
  return generated;
}

export function summonSingle(
  config: GachaConfig,
  definitions: readonly HeroDefinition[],
  random: RandomSource,
  generateId: HeroIdGenerator,
): HeroInstance {
  return generateHeroInstances(1, config, definitions, random, generateId)[0];
}

export function summonTen(
  config: GachaConfig,
  definitions: readonly HeroDefinition[],
  random: RandomSource,
  generateId: HeroIdGenerator,
): HeroInstance[] {
  return generateHeroInstances(10, config, definitions, random, generateId);
}

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
