import type { PlayerProfile, Resources, TowerProgression, ActiveExpedition } from '../types/index.ts';

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

