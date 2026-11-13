import type { CombatStats } from './types.ts';

function roundedMinimumOne(value: number): number {
  return Math.max(1, Math.floor(value));
}

/** Temporary MVP formula. All fractional results round down before the minimum is applied. */
export function calculatePhysicalDamage(
  attacker: Pick<CombatStats, 'attack'>,
  defender: Pick<CombatStats, 'defense'>,
  multiplier: number,
): number {
  return roundedMinimumOne(attacker.attack * multiplier * 100 / (100 + defender.defense));
}

/** Temporary MVP formula. All fractional results round down before the minimum is applied. */
export function calculateMagicalDamage(
  attacker: Pick<CombatStats, 'magic'>,
  defender: Pick<CombatStats, 'resistance'>,
  multiplier: number,
): number {
  return roundedMinimumOne(attacker.magic * multiplier * 100 / (100 + defender.resistance));
}

/** Temporary MVP formula. All fractional results round down before the minimum is applied. */
export function calculateHealing(
  healer: Pick<CombatStats, 'magic'>,
  multiplier: number,
): number {
  return roundedMinimumOne(healer.magic * multiplier);
}

/** Defend halves incoming damage until the defender starts its next action. */
export function applyDefendReduction(damage: number, defending: boolean): number {
  return defending ? Math.max(1, Math.floor(damage * 0.5)) : damage;
}
