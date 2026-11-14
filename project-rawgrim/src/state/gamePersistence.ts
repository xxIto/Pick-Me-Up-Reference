import {
  HERO_SAVE_VERSION,
  parsePersistedHeroState,
} from '../features/heroes/domain/persistence.ts';
import type { HeroInstance, PartyFormation } from '../features/heroes/domain/types.ts';
import { heroDefinitions } from '../features/heroes/data/heroDefinitions.ts';
import {
  ensureHeroPersonality,
  normalizeHeroPersonality,
  validatePersonalityDimensions,
} from '../features/heroes/domain/personality.ts';
import { TEAM_STRATEGIES } from '../features/heroes/domain/personalityTypes.ts';
import type {
  HeroPersonalityState,
  TeamStrategy,
} from '../features/heroes/domain/personalityTypes.ts';
import { normalizeMemoryProfile } from '../features/memory/domain/memoryProfile.ts';

export const GAME_SAVE_VERSION = 5;

export interface PersistedGameState {
  version: typeof GAME_SAVE_VERSION;
  roster: HeroInstance[];
  formation: PartyFormation;
  crystals: number;
  teamStrategy: TeamStrategy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPersonalityState(value: unknown): value is HeroPersonalityState {
  if (!isRecord(value) || !isRecord(value.innate) || !isRecord(value.learned) || !isRecord(value.emotion)) {
    return false;
  }
  const { innate, learned, emotion } = value;
  if (
    !isFiniteNumber(innate.courage) || !isFiniteNumber(innate.discipline) ||
    !isFiniteNumber(innate.aggression) || !isFiniteNumber(innate.empathy) ||
    !isFiniteNumber(innate.selfPreservation) || !isFiniteNumber(innate.ambition) ||
    !isFiniteNumber(innate.trust)
  ) return false;
  return (
    typeof value.identityId === 'string' && value.identityId.length > 0 &&
    typeof value.innateTraitId === 'string' && value.innateTraitId.length > 0 &&
    validatePersonalityDimensions({
      courage: innate.courage,
      discipline: innate.discipline,
      aggression: innate.aggression,
      empathy: innate.empathy,
      selfPreservation: innate.selfPreservation,
      ambition: innate.ambition,
      trust: innate.trust,
    }) &&
    isFiniteNumber(learned.offense) && isFiniteNumber(learned.healing) &&
    isFiniteNumber(learned.defense) && isFiniteNumber(learned.activeSkill) &&
    isFiniteNumber(emotion.fear) && isFiniteNumber(emotion.anger) &&
    isFiniteNumber(emotion.resolve)
  );
}

function normalizeRoster(roster: readonly HeroInstance[]): HeroInstance[] {
  return roster.map((hero) => {
    const definition = heroDefinitions.find((candidate) => candidate.id === hero.definitionId);
    return {
      ...hero,
      personality: isPersonalityState(hero.personality)
        ? normalizeHeroPersonality(hero.personality)
        : ensureHeroPersonality(hero, definition),
      memory: normalizeMemoryProfile(hero.memory, hero.id),
    };
  });
}

function hasUniquePersonalityIdentities(roster: readonly HeroInstance[]): boolean {
  const identities = roster.map((hero) => hero.personality?.identityId);
  return identities.every((identity): identity is string => typeof identity === 'string') &&
    new Set(identities).size === identities.length;
}

function parseVersionTwoState(value: unknown): Omit<PersistedGameState, 'version' | 'teamStrategy'> | null {
  if (!isRecord(value) || value.version !== 2) return null;
  if (typeof value.crystals !== 'number' || !Number.isInteger(value.crystals) || value.crystals < 0) return null;
  const heroes = parsePersistedHeroState({
    version: HERO_SAVE_VERSION,
    roster: value.roster,
    formation: value.formation,
  });
  if (!heroes) return null;
  const roster = normalizeRoster(heroes.roster);
  return hasUniquePersonalityIdentities(roster) ? {
    roster,
    formation: heroes.formation,
    crystals: value.crystals,
  } : null;
}

function parseVersionThreeState(value: unknown): Omit<PersistedGameState, 'version'> | null {
  if (!isRecord(value) || value.version !== 3) return null;
  if (typeof value.crystals !== 'number' || !Number.isInteger(value.crystals) || value.crystals < 0) return null;
  const teamStrategy = typeof value.teamStrategy === 'string'
    ? TEAM_STRATEGIES.find((strategy) => strategy === value.teamStrategy)
    : undefined;
  if (!teamStrategy) return null;
  const heroes = parsePersistedHeroState({
    version: HERO_SAVE_VERSION,
    roster: value.roster,
    formation: value.formation,
  });
  if (!heroes) return null;
  const roster = normalizeRoster(heroes.roster);
  return hasUniquePersonalityIdentities(roster) ? {
    roster,
    formation: heroes.formation,
    crystals: value.crystals,
    teamStrategy,
  } : null;
}

function parseVersionFourState(value: unknown): Omit<PersistedGameState, 'version'> | null {
  if (!isRecord(value) || value.version !== 4) return null;
  if (typeof value.crystals !== 'number' || !Number.isInteger(value.crystals) || value.crystals < 0) return null;
  const teamStrategy = typeof value.teamStrategy === 'string'
    ? TEAM_STRATEGIES.find((strategy) => strategy === value.teamStrategy)
    : undefined;
  if (!teamStrategy) return null;
  const heroes = parsePersistedHeroState({
    version: HERO_SAVE_VERSION,
    roster: value.roster,
    formation: value.formation,
  });
  if (!heroes) return null;
  const roster = normalizeRoster(heroes.roster);
  return hasUniquePersonalityIdentities(roster) ? {
    roster,
    formation: heroes.formation,
    crystals: value.crystals,
    teamStrategy,
  } : null;
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

  const teamStrategy = typeof value.teamStrategy === 'string'
    ? TEAM_STRATEGIES.find((strategy) => strategy === value.teamStrategy)
    : undefined;
  if (!teamStrategy) return null;
  const roster = normalizeRoster(heroes.roster);
  if (!hasUniquePersonalityIdentities(roster)) return null;
  return {
    version: GAME_SAVE_VERSION,
    roster,
    formation: heroes.formation,
    crystals: value.crystals,
    teamStrategy,
  };
}

export function migrateGameState(
  value: unknown,
  persistedVersion: number,
  initialCrystals: number,
): PersistedGameState | null {
  if (persistedVersion === GAME_SAVE_VERSION) return parsePersistedGameState(value);
  if (persistedVersion === 4) {
    const previous = parseVersionFourState(value);
    return previous ? { ...previous, version: GAME_SAVE_VERSION } : null;
  }
  if (persistedVersion === 3) {
    const previous = parseVersionThreeState(value);
    return previous ? { ...previous, version: GAME_SAVE_VERSION } : null;
  }
  if (persistedVersion === 2) {
    const previous = parseVersionTwoState(value);
    return previous ? { ...previous, version: GAME_SAVE_VERSION, teamStrategy: 'Balanced' } : null;
  }
  if (persistedVersion !== HERO_SAVE_VERSION) return null;

  const heroes = parsePersistedHeroState(value);
  if (!heroes) return null;
  const roster = normalizeRoster(heroes.roster);
  if (!hasUniquePersonalityIdentities(roster)) return null;
  return {
    version: GAME_SAVE_VERSION,
    roster,
    formation: heroes.formation,
    crystals: initialCrystals,
    teamStrategy: 'Balanced',
  };
}

export function createGameSaveEnvelope(state: PersistedGameState): string {
  return JSON.stringify({ state, version: GAME_SAVE_VERSION });
}
