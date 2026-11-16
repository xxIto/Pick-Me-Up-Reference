import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';
import { initialHeroRoster, initialPartyFormation } from '../src/features/heroes/data/initialRoster.ts';
import { initializeCombat } from '../src/features/combat/domain/initialization.ts';
import { SANDBOX_ENEMIES } from '../src/features/combat/data/enemyDefinitions.ts';
import type { OfficialDeathResolutionRequest } from '../src/features/legacy/domain/types.ts';
import { createDeathTransactionCoordinator } from '../src/features/legacy/domain/deathTransaction.ts';
import { migrateGameState } from '../src/state/gamePersistence.ts';
import type { PersistedGameState } from '../src/state/gamePersistence.ts';

function state(): PersistedGameState {
  return migrateGameState({
    version: 6,
    roster: structuredClone(initialHeroRoster),
    formation: structuredClone(initialPartyFormation),
    crystals: 900,
    teamStrategy: 'Balanced',
    leaderId: 'hero-valdris-001',
  }, 6, 0)!;
}

function request(): OfficialDeathResolutionRequest {
  const initial = initializeCombat(
    initialHeroRoster, initialPartyFormation, heroDefinitions, SANDBOX_ENEMIES, { seed: 7 },
  );
  const finalState = {
    ...initial,
    round: 4,
    units: initial.units.map((unit) => unit.sourceId === 'hero-valdris-001'
      ? { ...unit, alive: false, currentHp: 0 }
      : unit.side === 'enemies' ? { ...unit, alive: false, currentHp: 0 } : unit),
    result: { outcome: 'victory' as const, completedRound: 4, winningSide: 'allies' as const },
  };
  return {
    authorization: 'official-expedition', finalized: true,
    expeditionId: 'exp-transaction', battleId: 'battle-transaction', resolutionId: 'resolution-transaction',
    encounterId: 'encounter-1', rulesVersion: 'combat-v1',
    participantHeroIds: initialPartyFormation.frontline.concat(initialPartyFormation.backline)
      .filter((id): id is string => id !== null),
    leaderIdSnapshot: 'hero-valdris-001', finalState,
    experience: {
      sessionId: 'battle-transaction', outcome: 'victory', observations: [], eligibleForLearning: true,
    },
  };
}

describe('permadeath transaction coordinator', () => {
  it('does not commit when persistence pre-write fails', async () => {
    const current = state();
    let commits = 0;
    const coordinator = createDeathTransactionCoordinator({
      read: () => current,
      persist: async () => { throw new Error('storage unavailable'); },
      commit: () => { commits += 1; },
    }, heroDefinitions);

    const result = await coordinator.execute(request());

    expect(result).toEqual({ ok: false, error: 'storage unavailable' });
    expect(commits).toBe(0);
    expect(current.roster.some((hero) => hero.id === 'hero-valdris-001')).toBe(true);
  });

  it('persists then commits exactly once and treats a repeated request as idempotent', async () => {
    let current = state();
    let persists = 0;
    let commits = 0;
    const coordinator = createDeathTransactionCoordinator({
      read: () => current,
      persist: async () => { persists += 1; },
      commit: (next) => { current = next; commits += 1; },
    }, heroDefinitions);

    const first = await coordinator.execute(request());
    const duplicate = await coordinator.execute(request());

    expect(first.ok).toBe(true);
    expect(duplicate).toEqual({ ok: true, duplicate: true, memorialIds: [] });
    expect(persists).toBe(1);
    expect(commits).toBe(1);
    expect(current.memorials).toHaveLength(2);
    expect(current.crystals).toBe(900);
  });

  it('rejects an overlapping request while the first pre-write is pending', async () => {
    let current = state();
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const coordinator = createDeathTransactionCoordinator({
      read: () => current,
      persist: () => pending,
      commit: (next) => { current = next; },
    }, heroDefinitions);

    const first = coordinator.execute(request());
    const overlap = await coordinator.execute({ ...request(), resolutionId: 'other-resolution' });
    release?.();
    await first;

    expect(overlap).toEqual({ ok: false, error: 'A permanent-death resolution is already in progress' });
  });
});
