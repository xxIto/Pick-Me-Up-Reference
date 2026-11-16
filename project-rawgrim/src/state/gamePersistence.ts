import { HERO_SAVE_VERSION, parsePersistedHeroState } from '../features/heroes/domain/persistence.ts';
import type { HeroInstance, PartyFormation } from '../features/heroes/domain/types.ts';
import { heroDefinitions } from '../features/heroes/data/heroDefinitions.ts';
import { ensureHeroPersonality, normalizeHeroPersonality, validatePersonalityDimensions } from '../features/heroes/domain/personality.ts';
import { TEAM_STRATEGIES } from '../features/heroes/domain/personalityTypes.ts';
import type { HeroPersonalityState, TeamStrategy } from '../features/heroes/domain/personalityTypes.ts';
import { normalizeMemoryProfile } from '../features/memory/domain/memoryProfile.ts';
import { normalizeRelationshipProfile } from '../features/social/domain/relationshipProfile.ts';
import { validateLeaderAssignment } from '../features/social/domain/leadership.ts';
import { createLegacyMemorial } from '../features/legacy/domain/memorial.ts';
import type { HeroMemorialRecord } from '../features/legacy/domain/types.ts';
import { MAX_PROCESSED_LEGACY_RESOLUTIONS } from '../features/legacy/domain/types.ts';
import { isHeroMemorialRecord, isSurvivorConsequenceProfile } from '../features/legacy/domain/validation.ts';

export const GAME_SAVE_VERSION = 7;

export interface PersistedGameState {
  version: typeof GAME_SAVE_VERSION;
  roster: HeroInstance[];
  formation: PartyFormation;
  crystals: number;
  teamStrategy: TeamStrategy;
  leaderId: string | null;
  memorials: HeroMemorialRecord[];
  processedLegacyResolutionIds: string[];
}

interface PreLegacyState {
  roster: HeroInstance[];
  formation: PartyFormation;
  crystals: number;
  teamStrategy: TeamStrategy;
  leaderId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPersonalityState(value: unknown): value is HeroPersonalityState {
  if (!isRecord(value) || !isRecord(value.innate) || !isRecord(value.learned) || !isRecord(value.emotion)) return false;
  const { innate, learned, emotion } = value;
  if (!isFiniteNumber(innate.courage) || !isFiniteNumber(innate.discipline) ||
    !isFiniteNumber(innate.aggression) || !isFiniteNumber(innate.empathy) ||
    !isFiniteNumber(innate.selfPreservation) || !isFiniteNumber(innate.ambition) ||
    !isFiniteNumber(innate.trust)) return false;
  return typeof value.identityId === 'string' && value.identityId.length > 0 &&
    typeof value.innateTraitId === 'string' && value.innateTraitId.length > 0 &&
    validatePersonalityDimensions({
      courage: innate.courage, discipline: innate.discipline, aggression: innate.aggression,
      empathy: innate.empathy, selfPreservation: innate.selfPreservation,
      ambition: innate.ambition, trust: innate.trust,
    }) && isFiniteNumber(learned.offense) && isFiniteNumber(learned.healing) &&
    isFiniteNumber(learned.defense) && isFiniteNumber(learned.activeSkill) &&
    isFiniteNumber(emotion.fear) && isFiniteNumber(emotion.anger) && isFiniteNumber(emotion.resolve);
}

function normalizeRoster(roster: readonly HeroInstance[], knownHeroIds?: ReadonlySet<string>): HeroInstance[] | null {
  const validHeroIds = knownHeroIds ?? new Set(roster.map((hero) => hero.id));
  const normalized: HeroInstance[] = [];
  for (const hero of roster) {
    if (hero.survivorConsequences && !isSurvivorConsequenceProfile(hero.survivorConsequences, hero.id)) return null;
    const definition = heroDefinitions.find((candidate) => candidate.id === hero.definitionId);
    normalized.push({
      ...hero,
      personality: isPersonalityState(hero.personality)
        ? normalizeHeroPersonality(hero.personality)
        : ensureHeroPersonality(hero, definition),
      memory: normalizeMemoryProfile(hero.memory, hero.id),
      relationships: normalizeRelationshipProfile(hero.relationships, hero.id, validHeroIds),
      survivorConsequences: hero.survivorConsequences ? structuredClone(hero.survivorConsequences) : undefined,
    });
  }
  return normalized;
}

function hasUniquePersonalityIdentities(roster: readonly HeroInstance[]): boolean {
  const identities = roster.map((hero) => hero.personality?.identityId);
  return identities.every((identity): identity is string => typeof identity === 'string') &&
    new Set(identities).size === identities.length;
}

function parseHeroes(value: Record<string, unknown>): { roster: HeroInstance[]; formation: PartyFormation } | null {
  const heroes = parsePersistedHeroState({ version: HERO_SAVE_VERSION, roster: value.roster, formation: value.formation });
  if (!heroes) return null;
  const roster = normalizeRoster(heroes.roster);
  return roster && hasUniquePersonalityIdentities(roster) ? { roster, formation: heroes.formation } : null;
}

function parseCrystals(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseStrategy(value: unknown): TeamStrategy | null {
  return typeof value === 'string' ? TEAM_STRATEGIES.find((strategy) => strategy === value) ?? null : null;
}

function parseLegacyVersion(value: unknown, version: 2 | 3 | 4 | 5 | 6): PreLegacyState | null {
  if (!isRecord(value) || value.version !== version) return null;
  const crystals = parseCrystals(value.crystals);
  const heroes = parseHeroes(value);
  if (crystals === null || !heroes) return null;
  const teamStrategy = version === 2 ? 'Balanced' : parseStrategy(value.teamStrategy);
  if (!teamStrategy) return null;
  const requestedLeaderId = version === 6 && (value.leaderId === null || typeof value.leaderId === 'string')
    ? value.leaderId : null;
  const leaderId = validateLeaderAssignment(requestedLeaderId, heroes.roster, heroes.formation).valid
    ? requestedLeaderId : null;
  return { ...heroes, crystals, teamStrategy, leaderId };
}

function upgradeLegacyState(state: PreLegacyState): PersistedGameState | null {
  const knownHeroIds = new Set(state.roster.map((hero) => hero.id));
  const roster = normalizeRoster(state.roster, knownHeroIds);
  if (!roster) return null;
  const deadHeroes = roster.filter((hero) => hero.status === 'Dead');
  const memorials: HeroMemorialRecord[] = [];
  for (const [index, hero] of deadHeroes.entries()) {
    const definition = heroDefinitions.find((entry) => entry.id === hero.definitionId);
    if (!definition) return null;
    memorials.push(createLegacyMemorial(hero, definition, index + 1));
  }
  const deadIds = new Set(deadHeroes.map((hero) => hero.id));
  const formation: PartyFormation = {
    frontline: state.formation.frontline.map((id) => id && deadIds.has(id) ? null : id) as PartyFormation['frontline'],
    backline: state.formation.backline.map((id) => id && deadIds.has(id) ? null : id) as PartyFormation['backline'],
  };
  return {
    version: GAME_SAVE_VERSION,
    roster: roster.filter((hero) => !deadIds.has(hero.id)),
    formation,
    crystals: state.crystals,
    teamStrategy: state.teamStrategy,
    leaderId: state.leaderId && deadIds.has(state.leaderId) ? null : state.leaderId,
    memorials,
    processedLegacyResolutionIds: [],
  };
}

export function parsePersistedGameState(value: unknown): PersistedGameState | null {
  if (!isRecord(value) || value.version !== GAME_SAVE_VERSION) return null;
  const crystals = parseCrystals(value.crystals);
  const teamStrategy = parseStrategy(value.teamStrategy);
  if (crystals === null || !teamStrategy || !Array.isArray(value.memorials) ||
    !value.memorials.every(isHeroMemorialRecord) || !Array.isArray(value.processedLegacyResolutionIds) ||
    value.processedLegacyResolutionIds.length > MAX_PROCESSED_LEGACY_RESOLUTIONS ||
    !value.processedLegacyResolutionIds.every((id) => typeof id === 'string' && id.length > 0) ||
    new Set(value.processedLegacyResolutionIds).size !== value.processedLegacyResolutionIds.length) return null;
  const memorials = structuredClone(value.memorials) as HeroMemorialRecord[];
  const memorialIds = memorials.map((entry) => entry.id);
  const archivedHeroIds = memorials.map((entry) => entry.heroInstanceId);
  if (new Set(memorialIds).size !== memorialIds.length || new Set(archivedHeroIds).size !== archivedHeroIds.length) return null;
  const heroes = parsePersistedHeroState({ version: HERO_SAVE_VERSION, roster: value.roster, formation: value.formation });
  if (!heroes || heroes.roster.some((hero) => hero.status === 'Dead')) return null;
  const activeIds = new Set(heroes.roster.map((hero) => hero.id));
  if (archivedHeroIds.some((id) => activeIds.has(id))) return null;
  const knownHeroIds = new Set([...activeIds, ...archivedHeroIds]);
  const roster = normalizeRoster(heroes.roster, knownHeroIds);
  if (!roster || !hasUniquePersonalityIdentities(roster)) return null;
  const requestedLeaderId = value.leaderId === null || typeof value.leaderId === 'string' ? value.leaderId : null;
  const leaderId = validateLeaderAssignment(requestedLeaderId, roster, heroes.formation).valid ? requestedLeaderId : null;
  return {
    version: GAME_SAVE_VERSION,
    roster,
    formation: heroes.formation,
    crystals,
    teamStrategy,
    leaderId,
    memorials,
    processedLegacyResolutionIds: [...value.processedLegacyResolutionIds] as string[],
  };
}

export function migrateGameState(value: unknown, persistedVersion: number, initialCrystals: number): PersistedGameState | null {
  if (persistedVersion === GAME_SAVE_VERSION) return parsePersistedGameState(value);
  if (persistedVersion >= 2 && persistedVersion <= 6) {
    const previous = parseLegacyVersion(value, persistedVersion as 2 | 3 | 4 | 5 | 6);
    return previous ? upgradeLegacyState(previous) : null;
  }
  if (persistedVersion !== HERO_SAVE_VERSION) return null;
  const heroes = parsePersistedHeroState(value);
  if (!heroes) return null;
  const roster = normalizeRoster(heroes.roster);
  if (!roster || !hasUniquePersonalityIdentities(roster)) return null;
  return upgradeLegacyState({
    roster, formation: heroes.formation, crystals: initialCrystals,
    teamStrategy: 'Balanced', leaderId: null,
  });
}

export function createGameSaveEnvelope(state: PersistedGameState): string {
  return JSON.stringify({ state, version: GAME_SAVE_VERSION });
}
