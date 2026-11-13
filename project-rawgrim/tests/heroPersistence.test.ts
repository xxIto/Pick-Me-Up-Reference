import { describe, expect, it } from 'vitest';
import {
  HERO_SAVE_VERSION,
  parsePersistedHeroState,
} from '../src/features/heroes/domain/persistence.ts';
import {
  GAME_SAVE_VERSION,
  migrateGameState,
  parsePersistedGameState,
} from '../src/state/gamePersistence.ts';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';

const validState = {
  version: HERO_SAVE_VERSION,
  roster: [
    {
      id: 'hero-1',
      definitionId: 'valdris-ashen-blade',
      level: 2,
      experience: 50,
      currentHp: 850,
      status: 'Ready',
    },
  ],
  formation: {
    frontline: ['hero-1', null, null],
    backline: [null, null],
  },
};

describe('hero save validation', () => {
  it('accepts a valid current-version save', () => {
    expect(parsePersistedHeroState(validState)).toEqual(validState);
  });

  it('rejects an outdated version', () => {
    expect(parsePersistedHeroState({ ...validState, version: 0 })).toBeNull();
  });

  it('rejects malformed roster data', () => {
    expect(
      parsePersistedHeroState({
        ...validState,
        roster: [{ ...validState.roster[0], level: 'two' }],
      }),
    ).toBeNull();
  });

  it('rejects duplicate and unknown formation assignments', () => {
    expect(
      parsePersistedHeroState({
        ...validState,
        formation: { frontline: ['hero-1', 'hero-1', null], backline: [null, null] },
      }),
    ).toBeNull();
    expect(
      parsePersistedHeroState({
        ...validState,
        formation: { frontline: ['missing', null, null], backline: [null, null] },
      }),
    ).toBeNull();
  });

  it('rejects dead hero assignments', () => {
    expect(
      parsePersistedHeroState({
        ...validState,
        roster: [{ ...validState.roster[0], status: 'Dead', currentHp: 0 }],
      }),
    ).toBeNull();
  });
});

describe('game save migration', () => {
  it('preserves a version-one roster and formation while adding crystals', () => {
    const migrated = migrateGameState(validState, HERO_SAVE_VERSION, 320);

    expect(migrated).toEqual(expect.objectContaining({
      version: GAME_SAVE_VERSION,
      formation: validState.formation,
      crystals: 320,
      teamStrategy: 'Balanced',
    }));
    expect(migrated?.roster[0]).toEqual(expect.objectContaining(validState.roster[0]));
    const traitId = heroDefinitions.find((hero) => hero.id === 'valdris-ashen-blade')?.trait.id;
    expect(migrated?.roster[0].personality).toEqual(
      migrateLegacyPersonality('hero-1', traitId),
    );
  });

  it('migrates version-two game saves with a deterministic identity and balanced strategy', () => {
    const versionTwo = {
      ...validState,
      version: 2,
      crystals: 480,
    };

    const first = migrateGameState(versionTwo, 2, 0);
    const second = migrateGameState(versionTwo, 2, 999);

    expect(first).toEqual(second);
    expect(first?.teamStrategy).toBe('Balanced');
    expect(first?.crystals).toBe(480);
    expect(first?.roster[0].personality?.identityId).toBe('personality:hero-1');
  });

  it('round-trips a current game save without losing summoned heroes or crystals', () => {
    const state = {
      ...validState,
      version: GAME_SAVE_VERSION,
      crystals: 220,
      teamStrategy: 'Defensive' as const,
      roster: [
        {
          ...validState.roster[0],
          personality: migrateLegacyPersonality('hero-1'),
        },
        {
          id: 'summoned-1', definitionId: 'tovin-ratcatcher', level: 1,
          experience: 0, currentHp: 510, status: 'Ready' as const,
          personality: migrateLegacyPersonality('summoned-1', 'ratcatcher-instinct'),
        },
      ],
    };

    expect(parsePersistedGameState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('rejects a malformed crystal balance', () => {
    expect(parsePersistedGameState({
      ...validState,
      version: GAME_SAVE_VERSION,
      crystals: -1,
      teamStrategy: 'Balanced',
    })).toBeNull();
  });

  it('rejects an unknown team strategy in a current save', () => {
    expect(parsePersistedGameState({
      ...validState,
      version: GAME_SAVE_VERSION,
      crystals: 100,
      teamStrategy: 'Reckless',
    })).toBeNull();
  });

  it('rejects duplicate personality identities in a current save', () => {
    const sharedPersonality = migrateLegacyPersonality('shared');
    expect(parsePersistedGameState({
      ...validState,
      version: GAME_SAVE_VERSION,
      crystals: 100,
      teamStrategy: 'Balanced',
      roster: [
        { ...validState.roster[0], personality: sharedPersonality },
        {
          id: 'hero-2',
          definitionId: 'tovin-ratcatcher',
          level: 1,
          experience: 0,
          currentHp: 510,
          status: 'Ready',
          personality: sharedPersonality,
        },
      ],
    })).toBeNull();
  });
});
