import { describe, expect, it } from 'vitest';
import { initialHeroRoster, initialPartyFormation } from '../src/features/heroes/data/initialRoster.ts';
import {
  GAME_SAVE_VERSION,
  createGameSaveEnvelope,
  migrateGameState,
  parsePersistedGameState,
} from '../src/state/gamePersistence.ts';

function versionSixState() {
  return {
    version: 6,
    roster: structuredClone(initialHeroRoster),
    formation: structuredClone(initialPartyFormation),
    crystals: 12_345,
    teamStrategy: 'Balanced',
    leaderId: null,
  };
}

describe('legacy and memorial persistence', () => {
  it('migrates legacy dead heroes into unknown-history memorials without survivor effects', () => {
    const migrated = migrateGameState(versionSixState(), 6, 1_000);

    expect(migrated?.version).toBe(7);
    expect(migrated?.crystals).toBe(12_345);
    expect(migrated?.roster.some((hero) => hero.id === 'hero-sable-001')).toBe(false);
    expect(migrated?.memorials).toHaveLength(1);
    expect(migrated?.memorials[0]?.provenance).toBe('legacy-import');
    expect(migrated?.memorials[0]?.deathContext.known).toBe(false);
    expect(migrated?.roster.every((hero) => !hero.survivorConsequences?.experiences.length)).toBe(true);
  });

  it('round-trips a valid version-seven save envelope', () => {
    const migrated = migrateGameState(versionSixState(), 6, 1_000)!;
    const envelope = JSON.parse(createGameSaveEnvelope(migrated)) as { state: unknown; version: number };

    expect(envelope.version).toBe(GAME_SAVE_VERSION);
    expect(parsePersistedGameState(envelope.state)).toEqual(migrated);
  });

  it('rejects an identity that appears in both active roster and memorial archive', () => {
    const migrated = migrateGameState(versionSixState(), 6, 1_000)!;
    const invalid = {
      ...migrated,
      roster: [...migrated.roster, {
        ...initialHeroRoster.find((hero) => hero.id === 'hero-sable-001')!,
        status: 'Ready' as const,
        currentHp: 1,
      }],
    };

    expect(parsePersistedGameState(invalid)).toBeNull();
  });

  it('rejects malformed survivor ranges instead of partially hydrating them', () => {
    const migrated = migrateGameState(versionSixState(), 6, 1_000)!;
    const hero = migrated.roster[0];
    const invalid = {
      ...migrated,
      roster: migrated.roster.map((entry) => entry.id === hero.id ? {
        ...entry,
        survivorConsequences: {
          version: 1,
          ownerHeroId: entry.id,
          experiences: [{
            id: 'invalid', resolutionId: 'r', fallenHeroId: 'f', dominantResponse: 'fear',
            intensity: 101,
            scores: { grief: 0, fear: 101, anger: 0, resolve: 0, numbness: 0, guilt: 0 },
            emotionDelta: { fear: 1, anger: 0, resolve: 0 }, evidence: [], eventOrder: 1,
          }],
          processedDeathIds: ['r:f'], processedRecoveryIds: [], nextEventOrder: 2,
        },
      } : entry),
    };

    expect(parsePersistedGameState(invalid)).toBeNull();
  });

  it('rejects malformed personality snapshots inside memorial records', () => {
    const migrated = migrateGameState(versionSixState(), 6, 1_000)!;
    const memorial = migrated.memorials[0]!;
    const invalid = {
      ...migrated,
      memorials: [{
        ...memorial,
        personality: {
          ...memorial.personality,
          emotion: { ...memorial.personality.emotion, fear: 999 },
        },
      }],
    };

    expect(parsePersistedGameState(invalid)).toBeNull();
  });

  it('rejects malformed nested memorial evidence', () => {
    const migrated = migrateGameState(versionSixState(), 6, 1_000)!;
    const memorial = migrated.memorials[0]!;
    const invalid = {
      ...migrated,
      memorials: [{ ...memorial, significantMemories: [{}] }],
    };

    expect(parsePersistedGameState(invalid)).toBeNull();
  });

  it('rejects duplicate processed resolution IDs', () => {
    const migrated = migrateGameState(versionSixState(), 6, 1_000)!;
    const invalid = {
      ...migrated,
      processedLegacyResolutionIds: ['resolution-1', 'resolution-1'],
    };

    expect(parsePersistedGameState(invalid)).toBeNull();
  });
});
