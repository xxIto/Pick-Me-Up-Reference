import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';
import { createEmptyMemoryProfile } from '../src/features/memory/domain/memoryProfile.ts';
import { createEmptyRelationshipProfile } from '../src/features/social/domain/relationshipProfile.ts';
import type { HeroInstance } from '../src/features/heroes/domain/types.ts';
import { createLegacyMemorial } from '../src/features/legacy/domain/memorial.ts';

describe('hero memorials', () => {
  it('preserves a stable independent snapshot and marks unavailable legacy history as unknown', () => {
    const hero: HeroInstance = {
      id: 'legacy-dead', definitionId: 'sable-witch', level: 7, experience: 75,
      currentHp: 0, status: 'Dead', personality: migrateLegacyPersonality('legacy-dead'),
      memory: createEmptyMemoryProfile('legacy-dead'),
      relationships: createEmptyRelationshipProfile('legacy-dead'),
    };
    const definition = heroDefinitions.find((entry) => entry.id === hero.definitionId)!;
    const memorial = createLegacyMemorial(hero, definition, 1);

    hero.personality!.emotion.fear = 100;
    expect(memorial.id).toBe('memorial:legacy:legacy-dead');
    expect(memorial.provenance).toBe('legacy-import');
    expect(memorial.deathContext.known).toBe(false);
    expect(memorial.historicalGaps).toContain('death-context');
    expect(memorial.personality.emotion.fear).not.toBe(100);
    expect(memorial.achievements).toEqual([]);
  });
});
