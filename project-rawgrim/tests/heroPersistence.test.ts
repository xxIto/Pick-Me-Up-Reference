import { describe, expect, it } from 'vitest';
import {
  HERO_SAVE_VERSION,
  parsePersistedHeroState,
} from '../src/features/heroes/domain/persistence.ts';

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
