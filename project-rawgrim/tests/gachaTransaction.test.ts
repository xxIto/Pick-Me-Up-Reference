import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';
import { GACHA_CONFIG } from '../src/features/gacha/domain/gachaConfig.ts';
import {
  buildSummonTransaction,
  createSummonCoordinator,
} from '../src/features/gacha/domain/summonTransaction.ts';
import type { SummonGameState } from '../src/features/gacha/domain/types.ts';

const emptyState = (crystals: number): SummonGameState => ({ crystals, roster: [] });

function fixedIds() {
  let value = 0;
  return () => `hero-generated-${++value}`;
}

describe('summon transaction construction', () => {
  it('deducts one single-summon cost and appends one hero', () => {
    const before = emptyState(500);
    const result = buildSummonTransaction(before, 1, GACHA_CONFIG, heroDefinitions, () => 0, fixedIds());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextState.crystals).toBe(400);
    expect(result.nextState.roster).toHaveLength(1);
    expect(before).toEqual(emptyState(500));
  });

  it('deducts the ten-summon cost exactly once and appends ten heroes', () => {
    const result = buildSummonTransaction(emptyState(1500), 10, GACHA_CONFIG, heroDefinitions, () => 0, fixedIds());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextState.crystals).toBe(500);
    expect(result.nextState.roster).toHaveLength(10);
  });

  it('does not mutate state when crystals are insufficient', () => {
    const before = emptyState(99);
    const result = buildSummonTransaction(before, 1, GACHA_CONFIG, heroDefinitions, () => 0, fixedIds());

    expect(result).toEqual({ ok: false, code: 'insufficient-crystals', message: 'Not enough crystals' });
    expect(before).toEqual(emptyState(99));
  });

  it('does not mutate state when configuration or generation fails', () => {
    const before = emptyState(500);
    const invalidConfig = { ...GACHA_CONFIG, rarityProbabilities: [{ rarity: 5 as const, probability: 1 }] };
    const invalid = buildSummonTransaction(before, 1, invalidConfig, [], () => 0, fixedIds());
    const collision = buildSummonTransaction(
      { crystals: 500, roster: [{
        id: 'collision', definitionId: 'tovin-ratcatcher', level: 1, experience: 0, currentHp: 510, status: 'Ready',
      }] },
      1,
      GACHA_CONFIG,
      heroDefinitions,
      () => 0,
      () => 'collision',
    );

    expect(invalid.ok).toBe(false);
    expect(collision).toEqual({ ok: false, code: 'generation-failed', message: 'Generated hero instance ID already exists' });
    expect(before).toEqual(emptyState(500));
  });

  it('marks a repeated hero definition as a duplicate', () => {
    const before: SummonGameState = {
      crystals: 500,
      roster: [{ id: 'owned', definitionId: 'tovin-ratcatcher', level: 1, experience: 0, currentHp: 510, status: 'Ready' }],
    };
    const result = buildSummonTransaction(before, 1, GACHA_CONFIG, heroDefinitions, () => 0, fixedIds());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.results[0].isDuplicate).toBe(true);
  });
});

describe('summon coordinator', () => {
  it('allows sequential requests and deducts each completed summon once', async () => {
    let current = emptyState(300);
    const coordinator = createSummonCoordinator({
      read: () => current,
      persist: async () => undefined,
      commit: (state) => { current = state; },
    });
    const ids = fixedIds();

    const first = await coordinator.execute(1, GACHA_CONFIG, heroDefinitions, () => 0, ids);
    const second = await coordinator.execute(1, GACHA_CONFIG, heroDefinitions, () => 0, ids);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(current.crystals).toBe(100);
    expect(current.roster).toHaveLength(2);
  });

  it('does not commit when persistence fails', async () => {
    const before = emptyState(500);
    let committed: SummonGameState | null = null;
    const coordinator = createSummonCoordinator({
      read: () => before,
      persist: async () => { throw new Error('quota exceeded'); },
      commit: (state) => { committed = state; },
    });

    const result = await coordinator.execute(1, GACHA_CONFIG, heroDefinitions, () => 0, fixedIds());

    expect(result).toEqual({ ok: false, code: 'persistence-failed', message: 'Could not save summon results' });
    expect(committed).toBeNull();
    expect(before).toEqual(emptyState(500));
  });

  it('rejects an overlapping request while the first request is persisting', async () => {
    const before = emptyState(500);
    let releasePersistence: (() => void) | undefined;
    const persistenceGate = new Promise<void>((resolve) => { releasePersistence = resolve; });
    let current = before;
    const coordinator = createSummonCoordinator({
      read: () => current,
      persist: async () => persistenceGate,
      commit: (state) => { current = state; },
    });

    const first = coordinator.execute(1, GACHA_CONFIG, heroDefinitions, () => 0, fixedIds());
    const overlapping = await coordinator.execute(1, GACHA_CONFIG, heroDefinitions, () => 0, fixedIds());
    releasePersistence?.();
    const completed = await first;

    expect(overlapping).toEqual({ ok: false, code: 'request-in-progress', message: 'A summon is already in progress' });
    expect(completed.ok).toBe(true);
    expect(current.crystals).toBe(400);
    expect(current.roster).toHaveLength(1);
  });
});
