import type {
  FormationSlot,
  HeroDefinition,
  HeroInstance,
  HeroStats,
  PartyFormation,
} from './types.ts';
import { generatePersonality, migrateLegacyPersonality } from './personality.ts';
import type { PersonalityRandom } from './personality.ts';

export const EMPTY_FORMATION: PartyFormation = {
  frontline: [null, null, null],
  backline: [null, null],
};

export function createHeroInstance(
  definition: HeroDefinition,
  id: string,
  personalityRandom?: PersonalityRandom,
): HeroInstance {
  if (id.trim().length === 0) {
    throw new Error('Hero instance id is required');
  }

  return {
    id,
    definitionId: definition.id,
    level: 1,
    experience: 0,
    currentHp: definition.baseStats.hp,
    status: 'Ready',
    personality: personalityRandom
      ? generatePersonality(`personality:${id}`, definition.trait.id, personalityRandom)
      : migrateLegacyPersonality(id, definition.trait.id),
  };
}

export function calculateDerivedStats(definition: HeroDefinition, level: number): HeroStats {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error('Hero level must be a positive integer');
  }

  const gainedLevels = level - 1;
  return {
    hp: definition.baseStats.hp + definition.growthStats.hp * gainedLevels,
    attack: definition.baseStats.attack + definition.growthStats.attack * gainedLevels,
    defense: definition.baseStats.defense + definition.growthStats.defense * gainedLevels,
    speed: definition.baseStats.speed + definition.growthStats.speed * gainedLevels,
  };
}

export function getAssignedHeroIds(formation: PartyFormation): string[] {
  return [...formation.frontline, ...formation.backline].filter(
    (heroId): heroId is string => heroId !== null,
  );
}

function isValidSlot(formation: PartyFormation, slot: FormationSlot): boolean {
  return Number.isInteger(slot.index) && slot.index >= 0 && slot.index < formation[slot.line].length;
}

export function assignHeroToSlot(
  formation: PartyFormation,
  hero: HeroInstance,
  slot: FormationSlot,
): PartyFormation {
  if (!isValidSlot(formation, slot)) {
    throw new Error('Invalid party slot');
  }
  if (hero.status === 'Dead' || hero.currentHp <= 0) {
    throw new Error('Dead heroes cannot be deployed');
  }
  if (getAssignedHeroIds(formation).includes(hero.id)) {
    throw new Error('Hero is already deployed');
  }

  const nextLine = [...formation[slot.line]];
  nextLine[slot.index] = hero.id;
  return { ...formation, [slot.line]: nextLine } as PartyFormation;
}

export function removeHeroFromSlot(formation: PartyFormation, slot: FormationSlot): PartyFormation {
  if (!isValidSlot(formation, slot)) {
    throw new Error('Invalid party slot');
  }

  const nextLine = [...formation[slot.line]];
  nextLine[slot.index] = null;
  return { ...formation, [slot.line]: nextLine } as PartyFormation;
}
