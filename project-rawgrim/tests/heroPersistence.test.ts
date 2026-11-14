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
import { createEmptyMemoryProfile } from '../src/features/memory/domain/memoryProfile.ts';
import { applyRelationshipEvent } from '../src/features/social/domain/relationshipEngine.ts';
import { createEmptyRelationshipProfile } from '../src/features/social/domain/relationshipProfile.ts';
import type { RelationshipEvent } from '../src/features/social/domain/types.ts';

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
    expect(migrated?.roster[0].memory).toEqual(createEmptyMemoryProfile('hero-1'));
    expect(migrated?.roster[0].relationships).toEqual(createEmptyRelationshipProfile('hero-1'));
    expect(migrated?.leaderId).toBeNull();
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

  it('migrates version-three personality saves with neutral contextual learning', () => {
    const legacyPersonality = migrateLegacyPersonality('hero-1');
    delete legacyPersonality.learning;
    const versionThree = {
      ...validState,
      version: 3,
      crystals: 480,
      teamStrategy: 'Aggressive',
      roster: [{
        ...validState.roster[0],
        personality: legacyPersonality,
      }],
    };

    const migrated = migrateGameState(versionThree, 3, 0);

    expect(migrated?.version).toBe(GAME_SAVE_VERSION);
    expect(migrated?.teamStrategy).toBe('Aggressive');
    expect(migrated?.roster[0].personality?.learning?.battlesProcessed).toBe(0);
    expect(migrated?.roster[0].personality?.innate).toEqual(versionThree.roster[0].personality.innate);
  });

  it('migrates version-four saves with independent empty memory profiles', () => {
    const versionFour = {
      ...validState,
      version: 4,
      crystals: 480,
      teamStrategy: 'Defensive',
      roster: [{
        ...validState.roster[0],
        personality: migrateLegacyPersonality('hero-1'),
      }],
    };

    const migrated = migrateGameState(versionFour, 4, 0);

    expect(migrated?.version).toBe(GAME_SAVE_VERSION);
    expect(migrated?.roster[0].memory).toEqual(createEmptyMemoryProfile('hero-1'));
    expect(migrated?.roster[0].memory).not.toBe(createEmptyMemoryProfile('another-hero'));
  });

  it('migrates version-five memory saves with neutral relationships and no fabricated leader', () => {
    const versionFive = {
      ...validState,
      version: 5,
      crystals: 480,
      teamStrategy: 'Balanced',
      roster: [{
        ...validState.roster[0],
        personality: migrateLegacyPersonality('hero-1'),
        memory: createEmptyMemoryProfile('hero-1'),
      }],
    };

    const migrated = migrateGameState(versionFive, 5, 0);
    expect(migrated?.leaderId).toBeNull();
    expect(migrated?.roster[0].relationships).toEqual(createEmptyRelationshipProfile('hero-1'));
  });

  it('round-trips a current game save without losing summoned heroes or crystals', () => {
    const learnedPersonality = migrateLegacyPersonality('hero-1');
    learnedPersonality.learned.offense = 1.25;
    if (learnedPersonality.learning) {
      learnedPersonality.learning.contextWeights.offense.offensiveOpportunity = 0.75;
      learnedPersonality.learning.battlesProcessed = 1;
      learnedPersonality.learning.processedBattleBits[0] = 4;
    }
    const relationshipEvent: RelationshipEvent = {
      id: 'relationship-1', sourceId: 'battle-1:shared', type: 'shared-battle',
      ownerHeroId: 'hero-1', targetHeroId: 'summoned-1', sessionId: 'battle-1', round: 2,
      changes: { familiarity: 2, sharedExperienceCount: 1 }, memoryIds: [],
      description: 'Completed a meaningful combat encounter together.', eventOrder: 1,
    };
    const state = {
      ...validState,
      version: GAME_SAVE_VERSION,
      crystals: 220,
      teamStrategy: 'Defensive' as const,
      leaderId: 'hero-1',
      roster: [
        {
          ...validState.roster[0],
          personality: learnedPersonality,
          memory: {
            ...createEmptyMemoryProfile('hero-1'),
            memories: [{
              id: 'memory:hero-1:battle-1:result', ownerHeroId: 'hero-1', sourceId: 'battle-1:result',
              category: 'Achievement' as const, title: 'Victory remembered',
              description: 'The party prevailed in the observed encounter.', participantIds: ['ash-hound'],
              context: {
                sessionId: 'battle-1', round: 2, encounterLabel: 'Ashen Warband',
                enemyCategoryIds: ['ash-hound'], combatOutcome: 'victory' as const, threatLevel: 0.8,
              },
              facts: { outcome: 'victory' as const, enemyCategoryIds: ['ash-hound'] },
              significance: {
                score: 80, severity: 0.6, personalRisk: 0.8,
                novelty: 1, outcomeImportance: 1, relevance: 1,
              },
              eventOrder: 1, relatedMemoryIds: [],
            }],
            nextEventOrder: 2,
          },
          relationships: applyRelationshipEvent(createEmptyRelationshipProfile('hero-1'), relationshipEvent),
        },
        {
          id: 'summoned-1', definitionId: 'tovin-ratcatcher', level: 1,
          experience: 0, currentHp: 510, status: 'Ready' as const,
          personality: migrateLegacyPersonality('summoned-1', 'ratcatcher-instinct'),
          memory: createEmptyMemoryProfile('summoned-1'),
          relationships: createEmptyRelationshipProfile('summoned-1'),
        },
      ],
    };

    expect(parsePersistedGameState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('clears invalid persisted leadership without deleting the save', () => {
    const parsed = parsePersistedGameState({
      ...validState,
      version: GAME_SAVE_VERSION,
      crystals: 100,
      teamStrategy: 'Balanced',
      leaderId: 'reserve-or-missing',
    });

    expect(parsed?.leaderId).toBeNull();
    expect(parsed?.roster).toHaveLength(1);
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
