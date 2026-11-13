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
    expect(migrateGameState(validState, HERO_SAVE_VERSION, 320)).toEqual({
      ...validState,
      version: GAME_SAVE_VERSION,
      crystals: 320,
    });
  });

  it('round-trips a current game save without losing summoned heroes or crystals', () => {
    const state = {
      ...validState,
      version: GAME_SAVE_VERSION,
      crystals: 220,
      roster: [
        ...validState.roster,
        {
          id: 'summoned-1', definitionId: 'tovin-ratcatcher', level: 1,
          experience: 0, currentHp: 510, status: 'Ready' as const,
        },
      ],
    };

    expect(parsePersistedGameState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('rejects a malformed crystal balance', () => {
    expect(parsePersistedGameState({ ...validState, version: GAME_SAVE_VERSION, crystals: -1 })).toBeNull();
  });
});
