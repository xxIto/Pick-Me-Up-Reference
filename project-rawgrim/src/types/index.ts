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

