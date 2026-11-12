import type { HeroSkill } from '../domain/types.ts';

export const heroSkills: readonly HeroSkill[] = [
  { id: 'cleaving-strike', name: 'Cleaving Strike', description: 'A broad slash that punishes clustered foes.' },
  { id: 'iron-vow', name: 'Iron Vow', description: 'Hardens resolve and reduces incoming harm.' },
  { id: 'shield-bastion', name: 'Shield Bastion', description: 'Raises a warding shield over the frontline.' },
  { id: 'grave-challenge', name: 'Grave Challenge', description: 'Draws enemy attention with a death-marked oath.' },
  { id: 'black-arrow', name: 'Black Arrow', description: 'Fires a precise shot into a weakened target.' },
  { id: 'volley-of-thorns', name: 'Volley of Thorns', description: 'Rains barbed arrows across the enemy ranks.' },
  { id: 'mending-light', name: 'Mending Light', description: 'Restores health to the most wounded ally.' },
  { id: 'last-rites', name: 'Last Rites', description: 'Protects a dying ally with a brief sacred veil.' },
];

export function getSkillsByIds(skillIds: readonly string[]): HeroSkill[] {
  return skillIds.flatMap((id) => {
    const skill = heroSkills.find((candidate) => candidate.id === id);
    return skill ? [skill] : [];
  });
}
