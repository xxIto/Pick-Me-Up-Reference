import type { Hero, PlayerProfile, Resources, TowerProgression, Squad, ActiveExpedition } from '../types/index.ts';

// ─── Player ───────────────────────────────────────────────────────────────────

export const mockPlayer: PlayerProfile = {
  name: 'Commander Vex',
  level: 14,
  experience: 3400,
  experienceToNextLevel: 5000,
};

// ─── Resources ────────────────────────────────────────────────────────────────

export const mockResources: Resources = {
  gold: 24_750,
  crystals: 320,
  energy: 85,
  maxEnergy: 120,
};

// ─── Heroes ───────────────────────────────────────────────────────────────────

export const mockHeroes: Hero[] = [
  {
    id: 'h1',
    name: 'Valdris',
    class: 'Warrior',
    rarity: 'Legendary',
    level: 22,
    status: 'Active',
    hp: 1840,
    maxHp: 2100,
    attack: 318,
    defense: 245,
    speed: 88,
    portraitGradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a78bfa 100%)',
    initials: 'VD',
  },
  {
    id: 'h2',
    name: 'Sera',
    class: 'Mage',
    rarity: 'Epic',
    level: 19,
    status: 'Active',
    hp: 920,
    maxHp: 1100,
    attack: 445,
    defense: 110,
    speed: 112,
    portraitGradient: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #818cf8 100%)',
    initials: 'SR',
  },
  {
    id: 'h3',
    name: 'Kael',
    class: 'Ranger',
    rarity: 'Rare',
    level: 15,
    status: 'Injured',
    hp: 530,
    maxHp: 1300,
    attack: 290,
    defense: 155,
    speed: 140,
    portraitGradient: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #6ee7b7 100%)',
    initials: 'KL',
  },
  {
    id: 'h4',
    name: 'Lyra',
    class: 'Cleric',
    rarity: 'Epic',
    level: 18,
    status: 'Active',
    hp: 1200,
    maxHp: 1400,
    attack: 180,
    defense: 210,
    speed: 95,
    portraitGradient: 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #fcd34d 100%)',
    initials: 'LY',
  },
  {
    id: 'h5',
    name: 'Dusk',
    class: 'Warrior',
    rarity: 'Common',
    level: 10,
    status: 'Active',
    hp: 980,
    maxHp: 1050,
    attack: 210,
    defense: 190,
    speed: 78,
    portraitGradient: 'linear-gradient(135deg, #1f2937 0%, #4b5563 50%, #9ca3af 100%)',
    initials: 'DK',
  },
];

// ─── Active Squad ─────────────────────────────────────────────────────────────

export const mockSquad: Squad = {
  slots: mockHeroes,
};

// ─── Tower ────────────────────────────────────────────────────────────────────

export const mockTower: TowerProgression = {
  currentFloor: 3,
  maxFloor: 5,
  floors: [
    { floor: 1, name: 'The Ashen Gate',    cleared: true,  current: false },
    { floor: 2, name: 'Crypts of Malgrath', cleared: true,  current: false },
    { floor: 3, name: 'The Veil Bridge',    cleared: false, current: true  },
    { floor: 4, name: 'Throne of Dust',     cleared: false, current: false },
    { floor: 5, name: 'The Dread Citadel',  cleared: false, current: false },
  ],
};

// ─── Expedition ───────────────────────────────────────────────────────────────

export const mockExpedition: ActiveExpedition = {
  name: 'Ruins of Eldenmoor',
  timeRemainingMs: 4_320_000,   // 1 h 12 m remaining
  durationMs:      7_200_000,   // 2 h total
};

