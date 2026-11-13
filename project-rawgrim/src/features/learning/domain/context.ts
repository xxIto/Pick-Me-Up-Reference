import { getCombatSkill } from '../../combat/data/combatSkills.ts';
import {
  calculateMagicalDamage,
  calculatePhysicalDamage,
} from '../../combat/domain/calculations.ts';
import type { CombatAction, CombatState, CombatUnit } from '../../combat/domain/types.ts';
import type { LearningContextFeatures } from './types.ts';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hpRisk(unit: CombatUnit): number {
  return clamp01(1 - unit.currentHp / Math.max(1, unit.stats.maxHp));
}

function expectedOffensiveRatio(state: CombatState, actor: CombatUnit, action: CombatAction): number {
  const target = state.units.find((unit) => unit.id === action.targetId && unit.side !== actor.side && unit.alive);
  if (!target || action.type === 'defend') return 0;
  const skill = action.skillId ? getCombatSkill(action.skillId) : null;
  if (skill?.kind === 'healing') return 0;
  const multiplier = skill?.multiplier ?? 1;
  const damage = action.type === 'basic-magical' || skill?.kind === 'magical'
    ? calculateMagicalDamage(actor.stats, target.stats, multiplier)
    : calculatePhysicalDamage(actor.stats, target.stats, multiplier);
  return clamp01(damage / Math.max(1, target.currentHp));
}

export function extractLearningContext(
  state: CombatState,
  actor: CombatUnit,
  action: CombatAction,
): LearningContextFeatures {
  const hpRatio = actor.currentHp / Math.max(1, actor.stats.maxHp);
  const allies = state.units.filter((unit) => unit.side === actor.side && unit.id !== actor.id && unit.alive);
  const enemies = state.units.filter((unit) => unit.side !== actor.side && unit.alive);
  const allySurvivalRisk = allies.reduce((highest, ally) => Math.max(highest, hpRisk(ally)), 0);
  const enemyThreat = enemies.reduce((highest, enemy) => Math.max(
    highest,
    clamp01((enemy.stats.attack + enemy.stats.magic) / 300),
  ), 0);
  const healingOpportunity = allies.reduce((highest, ally) => Math.max(highest, hpRisk(ally)), 0);

  return {
    actorHpCritical: hpRatio <= 0.25 ? 1 : 0,
    actorHpLow: hpRatio > 0.25 && hpRatio <= 0.5 ? 1 : 0,
    actorHpMedium: hpRatio > 0.5 ? 1 : 0,
    allySurvivalRisk,
    enemyThreat,
    offensiveOpportunity: expectedOffensiveRatio(state, actor, action),
    defensiveOpportunity: hpRisk(actor),
    healingOpportunity,
  };
}
