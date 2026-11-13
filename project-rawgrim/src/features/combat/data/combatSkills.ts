import type { CombatSkill } from '../domain/types.ts';

export const COMBAT_SKILLS: readonly CombatSkill[] = [
  {
    id: 'power-strike',
    name: 'Power Strike',
    description: 'A committed physical blow with increased damage.',
    kind: 'physical',
    multiplier: 1.5,
    cooldown: 2,
    target: 'enemy',
  },
  {
    id: 'shadow-bolt',
    name: 'Shadow Bolt',
    description: 'A condensed magical projectile that tests resistance.',
    kind: 'magical',
    multiplier: 1.35,
    cooldown: 2,
    target: 'enemy',
  },
  {
    id: 'mending-light',
    name: 'Mending Light',
    description: 'Restores health to one injured living ally.',
    kind: 'healing',
    multiplier: 1.2,
    cooldown: 2,
    target: 'ally',
  },
];

export function getCombatSkill(skillId: string): CombatSkill | null {
  return COMBAT_SKILLS.find((skill) => skill.id === skillId) ?? null;
}
