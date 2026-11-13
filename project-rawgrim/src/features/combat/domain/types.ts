import type { HeroClass } from '../../heroes/domain/types.ts';

export type CombatSide = 'allies' | 'enemies';
export type CombatLine = 'frontline' | 'backline';
export type CombatOutcome = 'ongoing' | 'victory' | 'defeat' | 'draw';
export type CombatDamageType = 'physical' | 'magical';
export type CombatActionType = 'basic-physical' | 'basic-magical' | 'skill' | 'defend';
export type CombatSkillKind = 'physical' | 'magical' | 'healing';
export type CombatTargetRule = 'enemy' | 'ally' | 'self';

export interface CombatStats {
  maxHp: number;
  attack: number;
  magic: number;
  defense: number;
  resistance: number;
  speed: number;
}

export interface CombatSkill {
  id: string;
  name: string;
  description: string;
  kind: CombatSkillKind;
  multiplier: number;
  cooldown: number;
  target: CombatTargetRule;
}

export interface CombatEffect {
  type: 'damage' | 'healing' | 'defend';
  amount?: number;
  damageType?: CombatDamageType;
  duration?: 'until-next-action';
}

export interface CombatPosition {
  line: CombatLine;
  index: number;
}

export interface CombatUnit {
  id: string;
  sourceId: string;
  name: string;
  class: HeroClass | 'Enemy';
  side: CombatSide;
  position: CombatPosition;
  stats: CombatStats;
  currentHp: number;
  alive: boolean;
  defending: boolean;
  cooldowns: Readonly<Record<string, number>>;
  skillIds: readonly string[];
  initiativeTie: number;
}

export interface TurnOrder {
  unitIds: readonly string[];
  currentIndex: number;
}

export interface TargetSelection {
  targetId: string | null;
  reason: 'frontline-priority' | 'lowest-health' | 'self' | 'none';
}

export interface CombatAction {
  actorId: string;
  type: CombatActionType;
  targetId: string;
  skillId?: string;
}

export interface CombatEvent {
  sequence: number;
  round: number;
  type: 'battle-started' | 'round-started' | 'damage' | 'healing' | 'defend' | 'defeated' | 'battle-ended';
  actorId?: string;
  targetId?: string;
  skillId?: string;
  amount?: number;
  mitigatedAmount?: number;
  message: string;
}

export interface CombatResult {
  outcome: CombatOutcome;
  completedRound: number;
  winningSide: CombatSide | null;
}

export interface CombatState {
  seed: number;
  round: number;
  maxRounds: number;
  units: readonly CombatUnit[];
  turnOrder: TurnOrder;
  events: readonly CombatEvent[];
  result: CombatResult;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  position: CombatPosition;
  stats: CombatStats;
  skillIds: readonly string[];
}

export interface CombatInitializationOptions {
  seed: number;
  maxRounds?: number;
}

export type ActionResolution =
  | { ok: true; state: CombatState }
  | { ok: false; error: string; state: CombatState };
