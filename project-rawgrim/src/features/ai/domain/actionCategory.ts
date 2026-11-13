import { getCombatSkill } from '../../combat/data/combatSkills.ts';
import type { CombatAction } from '../../combat/domain/types.ts';
import type { LearnedPreferences } from '../../heroes/domain/personalityTypes.ts';

export type ActionCategory = keyof LearnedPreferences;

export function getActionCategory(action: CombatAction): ActionCategory {
  if (action.type === 'defend') return 'defense';
  const skill = action.skillId ? getCombatSkill(action.skillId) : null;
  if (skill?.kind === 'healing') return 'healing';
  if (action.type === 'skill') return 'activeSkill';
  return 'offense';
}
