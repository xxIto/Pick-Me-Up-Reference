import type { HeroDefinition } from '../../heroes/domain/types.ts';
import { parsePersistedGameState } from '../../../state/gamePersistence.ts';
import type { PersistedGameState } from '../../../state/gamePersistence.ts';
import { resolveAuthorizedPermadeath } from './deathResolution.ts';
import type { OfficialDeathResolutionRequest } from './types.ts';

export interface DeathTransactionAdapter {
  read: () => PersistedGameState;
  persist: (state: PersistedGameState) => Promise<void>;
  commit: (state: PersistedGameState) => void;
}

export type DeathTransactionResult =
  | { ok: true; duplicate: boolean; memorialIds: readonly string[] }
  | { ok: false; error: string };

export interface DeathTransactionCoordinator {
  execute: (request: OfficialDeathResolutionRequest) => Promise<DeathTransactionResult>;
}

export function createDeathTransactionCoordinator(
  adapter: DeathTransactionAdapter,
  definitions: readonly HeroDefinition[],
): DeathTransactionCoordinator {
  let inFlight = false;
  return {
    execute: async (request) => {
      if (inFlight) return { ok: false, error: 'A permanent-death resolution is already in progress' };
      inFlight = true;
      try {
        const current = adapter.read();
        const resolution = resolveAuthorizedPermadeath(current, request, definitions);
        if (!resolution.ok) return { ok: false, error: resolution.errors.join('; ') };
        if (resolution.duplicate) return { ok: true, duplicate: true, memorialIds: [] };
        const proposed: PersistedGameState = {
          ...current,
          ...resolution.state,
          version: current.version,
        };
        const validated = parsePersistedGameState(proposed);
        if (!validated) return { ok: false, error: 'Proposed permanent-death state failed validation' };
        await adapter.persist(validated);
        adapter.commit(validated);
        return {
          ok: true,
          duplicate: false,
          memorialIds: resolution.memorials.map((entry) => entry.id),
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Permanent-death transaction failed' };
      } finally {
        inFlight = false;
      }
    },
  };
}
