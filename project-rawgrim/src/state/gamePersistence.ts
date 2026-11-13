import {
  HERO_SAVE_VERSION,
  parsePersistedHeroState,
} from '../features/heroes/domain/persistence.ts';
import type { HeroInstance, PartyFormation } from '../features/heroes/domain/types.ts';

export const GAME_SAVE_VERSION = 2;

export interface PersistedGameState {
  version: typeof GAME_SAVE_VERSION;
  roster: HeroInstance[];
  formation: PartyFormation;
  crystals: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePersistedGameState(value: unknown): PersistedGameState | null {
  if (!isRecord(value) || value.version !== GAME_SAVE_VERSION) return null;
  if (typeof value.crystals !== 'number' || !Number.isInteger(value.crystals) || value.crystals < 0) {
    return null;
  }

  const heroes = parsePersistedHeroState({
    version: HERO_SAVE_VERSION,
    roster: value.roster,
    formation: value.formation,
  });
  if (!heroes) return null;

  return {
    version: GAME_SAVE_VERSION,
    roster: heroes.roster,
    formation: heroes.formation,
    crystals: value.crystals,
  };
}

export function migrateGameState(
  value: unknown,
  persistedVersion: number,
  initialCrystals: number,
): PersistedGameState | null {
  if (persistedVersion === GAME_SAVE_VERSION) return parsePersistedGameState(value);
  if (persistedVersion !== HERO_SAVE_VERSION) return null;

  const heroes = parsePersistedHeroState(value);
  if (!heroes) return null;
  return {
    version: GAME_SAVE_VERSION,
    roster: heroes.roster,
    formation: heroes.formation,
    crystals: initialCrystals,
  };
}

export function createGameSaveEnvelope(state: PersistedGameState): string {
  return JSON.stringify({ state, version: GAME_SAVE_VERSION });
}
