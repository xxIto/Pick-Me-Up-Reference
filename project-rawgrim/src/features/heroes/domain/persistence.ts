import { HERO_STATUSES } from './types.ts';
import type { HeroInstance, PartyFormation } from './types.ts';

export const HERO_SAVE_VERSION = 1;

export interface PersistedHeroState {
  version: typeof HERO_SAVE_VERSION;
  roster: HeroInstance[];
  formation: PartyFormation;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHeroInstance(value: unknown): value is HeroInstance {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' && value.id.trim().length > 0 &&
    typeof value.definitionId === 'string' && value.definitionId.trim().length > 0 &&
    typeof value.level === 'number' && Number.isInteger(value.level) && value.level >= 1 &&
    typeof value.experience === 'number' && Number.isInteger(value.experience) && value.experience >= 0 &&
    typeof value.currentHp === 'number' && Number.isFinite(value.currentHp) && value.currentHp >= 0 &&
    typeof value.status === 'string' && HERO_STATUSES.some((status) => status === value.status) &&
    (value.status === 'Dead' ? value.currentHp === 0 : value.currentHp > 0)
  );
}

function isSlotArray(value: unknown, length: number): value is (string | null)[] {
  return Array.isArray(value) && value.length === length && value.every(
    (item) => item === null || (typeof item === 'string' && item.trim().length > 0),
  );
}

export function parsePersistedHeroState(value: unknown): PersistedHeroState | null {
  if (!isRecord(value) || value.version !== HERO_SAVE_VERSION || !Array.isArray(value.roster)) {
    return null;
  }
  if (!value.roster.every(isHeroInstance) || !isRecord(value.formation)) return null;
  if (!isSlotArray(value.formation.frontline, 3) || !isSlotArray(value.formation.backline, 2)) {
    return null;
  }

  const roster = value.roster;
  const rosterIds = roster.map((hero) => hero.id);
  if (new Set(rosterIds).size !== rosterIds.length) return null;

  const assignedIds = [...value.formation.frontline, ...value.formation.backline].filter(
    (id): id is string => id !== null,
  );
  if (new Set(assignedIds).size !== assignedIds.length) return null;
  if (assignedIds.some((id) => !rosterIds.includes(id))) return null;
  if (assignedIds.some((id) => roster.find((hero) => hero.id === id)?.status === 'Dead')) return null;

  return {
    version: HERO_SAVE_VERSION,
    roster: roster.map((hero) => ({ ...hero })),
    formation: {
      frontline: [...value.formation.frontline],
      backline: [...value.formation.backline],
    },
  } as PersistedHeroState;
}
