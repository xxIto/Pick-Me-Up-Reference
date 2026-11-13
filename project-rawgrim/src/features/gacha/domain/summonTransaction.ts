import type { HeroDefinition } from '../../heroes/domain/types.ts';
import { summonSingle, summonTen, validateGachaConfig } from './summonEngine.ts';
import type {
  GachaConfig,
  HeroIdGenerator,
  RandomSource,
  SummonCount,
  SummonFailure,
  SummonGameState,
  SummonTransactionResult,
} from './types.ts';

function failure(code: SummonFailure['code'], message: string): SummonFailure {
  return { ok: false, code, message };
}

export function buildSummonTransaction(
  state: SummonGameState,
  count: SummonCount,
  config: GachaConfig,
  definitions: readonly HeroDefinition[],
  random: RandomSource,
  generateId: HeroIdGenerator,
): SummonTransactionResult {
  if (count !== 1 && count !== 10) return failure('invalid-request', 'Summon count must be 1 or 10');
  const validation = validateGachaConfig(config, definitions);
  if (!validation.valid) {
    return failure('invalid-configuration', validation.errors.join('; '));
  }
  const cost = config.costs[count];
  if (!Number.isInteger(state.crystals) || state.crystals < 0) {
    return failure('invalid-request', 'Crystal balance is invalid');
  }
  if (state.crystals < cost) return failure('insufficient-crystals', 'Not enough crystals');

  try {
    const generated = count === 1
      ? [summonSingle(config, definitions, random, generateId)]
      : summonTen(config, definitions, random, generateId);
    const existingIds = new Set(state.roster.map((hero) => hero.id));
    if (generated.some((hero) => existingIds.has(hero.id))) {
      return failure('generation-failed', 'Generated hero instance ID already exists');
    }

    const seenDefinitions = new Set(state.roster.map((hero) => hero.definitionId));
    const results = generated.map((instance) => {
      const definition = definitions.find((candidate) => candidate.id === instance.definitionId);
      if (!definition) throw new Error('Generated hero definition is missing');
      const isDuplicate = seenDefinitions.has(instance.definitionId);
      seenDefinitions.add(instance.definitionId);
      return { instance, definition, isDuplicate };
    });

    return {
      ok: true,
      nextState: {
        crystals: state.crystals - cost,
        roster: [...state.roster, ...generated],
      },
      results,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hero generation failed';
    return failure('generation-failed', message);
  }
}

interface SummonCoordinatorDependencies {
  read: () => SummonGameState;
  persist: (state: SummonGameState) => Promise<void>;
  commit: (state: SummonGameState) => void;
}

export interface SummonCoordinator {
  execute: (
    count: SummonCount,
    config: GachaConfig,
    definitions: readonly HeroDefinition[],
    random: RandomSource,
    generateId: HeroIdGenerator,
  ) => Promise<SummonTransactionResult>;
  isActive: () => boolean;
}

export function createSummonCoordinator(dependencies: SummonCoordinatorDependencies): SummonCoordinator {
  let active = false;
  return {
    isActive: () => active,
    execute: async (count, config, definitions, random, generateId) => {
      if (active) return failure('request-in-progress', 'A summon is already in progress');
      active = true;
      try {
        const transaction = buildSummonTransaction(
          dependencies.read(), count, config, definitions, random, generateId,
        );
        if (!transaction.ok) return transaction;
        try {
          await dependencies.persist(transaction.nextState);
        } catch {
          return failure('persistence-failed', 'Could not save summon results');
        }
        dependencies.commit(transaction.nextState);
        return transaction;
      } finally {
        active = false;
      }
    },
  };
}
