import type { CombatState, CombatUnit, TargetSelection } from './types.ts';

function sortByPosition(left: CombatUnit, right: CombatUnit): number {
  return left.position.index - right.position.index || left.id.localeCompare(right.id);
}

export function selectOffensiveTarget(state: CombatState, actor: CombatUnit): TargetSelection {
  const livingEnemies = state.units.filter((unit) => unit.alive && unit.side !== actor.side);
  const frontline = livingEnemies.filter((unit) => unit.position.line === 'frontline').sort(sortByPosition);
  const candidates = frontline.length > 0 ? frontline : livingEnemies.sort(sortByPosition);
  return candidates[0]
    ? { targetId: candidates[0].id, reason: 'frontline-priority' }
    : { targetId: null, reason: 'none' };
}

export function selectHealingTarget(state: CombatState, actor: CombatUnit): TargetSelection {
  const injured = state.units
    .filter((unit) => unit.alive && unit.side === actor.side && unit.currentHp < unit.stats.maxHp)
    .slice()
    .sort((left, right) =>
      left.currentHp / left.stats.maxHp - right.currentHp / right.stats.maxHp ||
      sortByPosition(left, right),
    );
  return injured[0]
    ? { targetId: injured[0].id, reason: 'lowest-health' }
    : { targetId: null, reason: 'none' };
}
