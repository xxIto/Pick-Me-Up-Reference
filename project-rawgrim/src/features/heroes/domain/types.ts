import type { HeroPersonalityState } from './personalityTypes.ts';
import type { HeroMemoryProfile } from '../../memory/domain/types.ts';
import type { RelationshipProfile } from '../../social/domain/types.ts';

export const HERO_CLASSES = ['Warrior', 'Tank', 'Archer', 'Healer'] as const;
export type HeroClass = (typeof HERO_CLASSES)[number];

export const HERO_RARITIES = [1, 2, 3, 4, 5] as const;
export type HeroRarity = (typeof HERO_RARITIES)[number];

export const HERO_STATUSES = ['Ready', 'Injured', 'Dead'] as const;
export type HeroStatus = (typeof HERO_STATUSES)[number];

export interface HeroStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface HeroTrait {
  id: string;
  name: string;
  description: string;
}

export interface HeroSkill {
  id: string;
  name: string;
  description: string;
}

export interface HeroDefinition {
  id: string;
  name: string;
  class: HeroClass;
  rarity: HeroRarity;
  baseStats: HeroStats;
  growthStats: HeroStats;
  description: string;
  trait: HeroTrait;
  skillIds: readonly string[];
  portrait: {
    initials: string;
    gradient: string;
  };
}

export interface HeroInstance {
  id: string;
  definitionId: string;
  level: number;
  experience: number;
  currentHp: number;
  status: HeroStatus;
  /** Optional only for pre-TASK-005A saves; runtime migration supplies it once. */
  personality?: HeroPersonalityState;
  /** Optional only for saves created before TASK-005C; runtime migration supplies it once. */
  memory?: HeroMemoryProfile;
  /** Optional only for saves created before TASK-005D; runtime migration supplies it once. */
  relationships?: RelationshipProfile;
}

export interface PartyFormation {
  frontline: [string | null, string | null, string | null];
  backline: [string | null, string | null];
}
export type FormationLine = keyof PartyFormation;

export interface FormationSlot {
  line: FormationLine;
  index: number;
}

export type RosterSort = 'level' | 'rarity' | 'name';

export interface RosterQuery {
  search: string;
  heroClass: HeroClass | 'All';
  rarity: HeroRarity | 'All';
  sortBy: RosterSort;
}

export interface ResolvedHero {
  instance: HeroInstance;
  definition: HeroDefinition;
  stats: HeroStats;
}

