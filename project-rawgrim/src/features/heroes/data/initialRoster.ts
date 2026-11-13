import type { HeroInstance, PartyFormation } from '../domain/types.ts';
import { migrateLegacyPersonality } from '../domain/personality.ts';
import { heroDefinitions } from './heroDefinitions.ts';

const legacyHeroRoster: HeroInstance[] = [
  { id: 'hero-valdris-001', definitionId: 'valdris-ashen-blade', level: 22, experience: 340, currentHp: 2180, status: 'Ready' },
  { id: 'hero-mara-001', definitionId: 'mara-bloodbound', level: 12, experience: 180, currentHp: 1210, status: 'Injured' },
  { id: 'hero-garran-001', definitionId: 'garran-stoneward', level: 18, experience: 90, currentHp: 2600, status: 'Ready' },
  { id: 'hero-brunna-001', definitionId: 'brunna-ironhide', level: 8, experience: 40, currentHp: 1504, status: 'Ready' },
  { id: 'hero-kael-001', definitionId: 'kael-nightfeather', level: 15, experience: 230, currentHp: 680, status: 'Injured' },
  { id: 'hero-nyx-001', definitionId: 'nyx-veilrunner', level: 19, experience: 510, currentHp: 1484, status: 'Ready' },
  { id: 'hero-tovin-001', definitionId: 'tovin-ratcatcher', level: 6, experience: 20, currentHp: 705, status: 'Ready' },
  { id: 'hero-lyra-001', definitionId: 'lyra-dawnless', level: 18, experience: 455, currentHp: 1534, status: 'Ready' },
  { id: 'hero-orren-001', definitionId: 'orren-bellkeeper', level: 11, experience: 160, currentHp: 1280, status: 'Ready' },
  { id: 'hero-sable-001', definitionId: 'sable-witch', level: 7, experience: 75, currentHp: 0, status: 'Dead' },
];

export const initialHeroRoster: HeroInstance[] = legacyHeroRoster.map((hero) => {
  const definition = heroDefinitions.find((candidate) => candidate.id === hero.definitionId);
  return {
    ...hero,
    personality: migrateLegacyPersonality(hero.id, definition?.trait.id),
  };
});

export const initialPartyFormation: PartyFormation = {
  frontline: ['hero-valdris-001', 'hero-garran-001', 'hero-brunna-001'],
  backline: ['hero-nyx-001', 'hero-lyra-001'],
};
