// ─── Hero ─────────────────────────────────────────────────────────────────────

export type HeroClass = 'Warrior' | 'Mage' | 'Ranger' | 'Cleric';
export type HeroRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type HeroStatus = 'Active' | 'Injured' | 'Dead';

export interface Hero {
  id: string;
  name: string;
  class: HeroClass;
  rarity: HeroRarity;
  level: number;
  status: HeroStatus;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  /** CSS gradient string used as portrait fallback */
  portraitGradient: string;
  /** Initials shown inside the portrait */
  initials: string;
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface PlayerProfile {
  name: string;
  level: number;
  experience: number;
  experienceToNextLevel: number;
}

// ─── Resources ────────────────────────────────────────────────────────────────

export interface Resources {
  gold: number;
  crystals: number;
  energy: number;
  maxEnergy: number;
}

// ─── Tower ────────────────────────────────────────────────────────────────────

export interface TowerFloor {
  floor: number;
  name: string;
  cleared: boolean;
  current: boolean;
}

export interface TowerProgression {
  currentFloor: number;
  maxFloor: number;
  floors: TowerFloor[];
}

// ─── Expedition ───────────────────────────────────────────────────────────────

export interface ActiveExpedition {
  name: string;
  timeRemainingMs: number;
  durationMs: number;
}

// ─── Squad ────────────────────────────────────────────────────────────────────

export interface Squad {
  slots: (Hero | null)[];
}

