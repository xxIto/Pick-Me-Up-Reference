import type { EnemyDefinition } from '../domain/types.ts';

export const SANDBOX_ENEMIES: readonly EnemyDefinition[] = [
  {
    id: 'ash-hound-a', name: 'Ash Hound', position: { line: 'frontline', index: 0 },
    stats: { maxHp: 720, attack: 96, magic: 35, defense: 52, resistance: 35, speed: 92 },
    skillIds: ['power-strike'],
  },
  {
    id: 'grave-guard-a', name: 'Grave Guard', position: { line: 'frontline', index: 1 },
    stats: { maxHp: 980, attack: 82, magic: 30, defense: 88, resistance: 58, speed: 58 },
    skillIds: ['power-strike'],
  },
  {
    id: 'grave-guard-b', name: 'Grave Guard', position: { line: 'frontline', index: 2 },
    stats: { maxHp: 980, attack: 82, magic: 30, defense: 88, resistance: 58, speed: 58 },
    skillIds: ['power-strike'],
  },
  {
    id: 'veil-cultist-a', name: 'Veil Cultist', position: { line: 'backline', index: 0 },
    stats: { maxHp: 610, attack: 42, magic: 108, defense: 35, resistance: 68, speed: 78 },
    skillIds: ['shadow-bolt'],
  },
  {
    id: 'plague-seer-a', name: 'Plague Seer', position: { line: 'backline', index: 1 },
    stats: { maxHp: 650, attack: 38, magic: 98, defense: 42, resistance: 74, speed: 70 },
    skillIds: ['mending-light', 'shadow-bolt'],
  },
];
