import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';
import {
  assignHeroToSlot,
  calculateDerivedStats,
  createHeroInstance,
  removeHeroFromSlot,
} from '../src/features/heroes/domain/heroRules.ts';
import { filterAndSortRoster } from '../src/features/heroes/domain/roster.ts';
import type { HeroInstance, PartyFormation } from '../src/features/heroes/domain/types.ts';

const makeHero = (overrides: Partial<HeroInstance> = {}): HeroInstance => ({
  id: 'instance-a',
  definitionId: 'valdris-ashen-blade',
  level: 1,
  experience: 0,
  currentHp: 820,
  status: 'Ready',
  ...overrides,
});

describe('hero instances', () => {
  it('provides ten definitions across all four classes and star levels', () => {
    expect(heroDefinitions).toHaveLength(10);
    expect(new Set(heroDefinitions.map((hero) => hero.class))).toEqual(
      new Set(['Warrior', 'Tank', 'Archer', 'Healer']),
    );
    expect(new Set(heroDefinitions.map((hero) => hero.rarity))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('creates a valid owned hero with the supplied stable id', () => {
    const hero = createHeroInstance(heroDefinitions[0], 'owned-valdris');

    expect(hero).toEqual(expect.objectContaining({
      id: 'owned-valdris',
      definitionId: heroDefinitions[0].id,
      level: 1,
      experience: 0,
      currentHp: heroDefinitions[0].baseStats.hp,
      status: 'Ready',
    }));
    expect(hero.personality?.identityId).toBe('personality:owned-valdris');
    expect(hero.personality?.innateTraitId).toBe(heroDefinitions[0].trait.id);
  });

  it('calculates level growth without mutating the definition', () => {
    const definition = heroDefinitions[0];
    const originalBaseHp = definition.baseStats.hp;

    expect(calculateDerivedStats(definition, 4)).toEqual({
      hp: definition.baseStats.hp + definition.growthStats.hp * 3,
      attack: definition.baseStats.attack + definition.growthStats.attack * 3,
      defense: definition.baseStats.defense + definition.growthStats.defense * 3,
      speed: definition.baseStats.speed + definition.growthStats.speed * 3,
    });
    expect(definition.baseStats.hp).toBe(originalBaseHp);
  });
});

describe('roster queries', () => {
  const roster = [
    makeHero({ id: 'low', definitionId: heroDefinitions[0].id, level: 2 }),
    makeHero({ id: 'high', definitionId: heroDefinitions[1].id, level: 9 }),
    makeHero({ id: 'middle', definitionId: heroDefinitions[2].id, level: 5 }),
  ];

  it('searches names case-insensitively and filters class and rarity', () => {
    const definition = heroDefinitions[0];
    const result = filterAndSortRoster(roster, heroDefinitions, {
      search: definition.name.toUpperCase(),
      heroClass: definition.class,
      rarity: definition.rarity,
      sortBy: 'name',
    });

    expect(result.map(({ instance }) => instance.id)).toEqual(['low']);
  });

  it('sorts by descending level without changing the source roster', () => {
    const originalIds = roster.map((hero) => hero.id);
    const result = filterAndSortRoster(roster, heroDefinitions, {
      search: '',
      heroClass: 'All',
      rarity: 'All',
      sortBy: 'level',
    });

    expect(result.map(({ instance }) => instance.id)).toEqual(['high', 'middle', 'low']);
    expect(roster.map((hero) => hero.id)).toEqual(originalIds);
  });
});

describe('party formation', () => {
  const emptyFormation: PartyFormation = {
    frontline: [null, null, null],
    backline: [null, null],
  };

  it('supports five assignments and rejects a sixth position', () => {
    let formation = emptyFormation;
    const heroes = Array.from({ length: 6 }, (_, index) => makeHero({ id: `hero-${index}` }));

    formation = assignHeroToSlot(formation, heroes[0], { line: 'frontline', index: 0 });
    formation = assignHeroToSlot(formation, heroes[1], { line: 'frontline', index: 1 });
    formation = assignHeroToSlot(formation, heroes[2], { line: 'frontline', index: 2 });
    formation = assignHeroToSlot(formation, heroes[3], { line: 'backline', index: 0 });
    formation = assignHeroToSlot(formation, heroes[4], { line: 'backline', index: 1 });

    expect(Object.values(formation).flat().filter(Boolean)).toHaveLength(5);
    expect(() => assignHeroToSlot(formation, heroes[5], { line: 'backline', index: 2 })).toThrow(
      'Invalid party slot',
    );
  });

  it('prevents duplicate assignments', () => {
    const hero = makeHero();
    const formation = assignHeroToSlot(emptyFormation, hero, { line: 'frontline', index: 0 });

    expect(() => assignHeroToSlot(formation, hero, { line: 'backline', index: 0 })).toThrow(
      'Hero is already deployed',
    );
  });

  it('prevents dead heroes from deployment', () => {
    expect(() =>
      assignHeroToSlot(emptyFormation, makeHero({ status: 'Dead', currentHp: 0 }), {
        line: 'frontline',
        index: 0,
      }),
    ).toThrow('Dead heroes cannot be deployed');
  });

  it('rejects negative and out-of-range slot indexes', () => {
    expect(() =>
      assignHeroToSlot(emptyFormation, makeHero(), { line: 'frontline', index: -1 }),
    ).toThrow('Invalid party slot');
    expect(() =>
      assignHeroToSlot(emptyFormation, makeHero(), { line: 'frontline', index: 3 }),
    ).toThrow('Invalid party slot');
  });

  it('removes an assignment immutably', () => {
    const formation = assignHeroToSlot(emptyFormation, makeHero(), { line: 'frontline', index: 0 });
    const result = removeHeroFromSlot(formation, { line: 'frontline', index: 0 });

    expect(result.frontline[0]).toBeNull();
    expect(formation.frontline[0]).toBe('instance-a');
  });
});
