import { describe, expect, it } from 'vitest';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';
import { createEmptyRelationshipProfile } from '../src/features/social/domain/relationshipProfile.ts';
import { applyRelationshipEvent } from '../src/features/social/domain/relationshipEngine.ts';
import type { HeroInstance } from '../src/features/heroes/domain/types.ts';
import {
  applySurvivorLosses,
  applySurvivorRecovery,
  calculateSurvivorResponse,
  createEmptySurvivorProfile,
} from '../src/features/legacy/domain/survivorConsequences.ts';

function hero(id: string, personalityId: string): HeroInstance {
  return {
    id,
    definitionId: 'valdris-ashen-blade',
    level: 10,
    experience: 0,
    currentHp: 100,
    status: 'Ready',
    personality: migrateLegacyPersonality(personalityId),
    relationships: createEmptyRelationshipProfile(id),
  };
}

describe('survivor consequences', () => {
  it('uses directed relationship and personality evidence instead of assigning one universal response', () => {
    const attached = hero('attached', 'attached');
    attached.personality!.innate.empathy = 100;
    attached.personality!.innate.aggression = 0;
    attached.relationships = applyRelationshipEvent(attached.relationships!, {
      id: 'bond', sourceId: 'bond', type: 'shared-battle', ownerHeroId: attached.id,
      targetHeroId: 'fallen', sessionId: 'past', round: 1,
      changes: { trust: 80, affection: 80, familiarity: 80, sharedExperienceCount: 5 },
      memoryIds: [], description: 'Shared history.', eventOrder: 1,
    });
    const aggressive = hero('aggressive', 'aggressive');
    aggressive.personality!.innate.empathy = 0;
    aggressive.personality!.innate.aggression = 100;
    aggressive.relationships = applyRelationshipEvent(aggressive.relationships!, {
      id: 'rivalry', sourceId: 'rivalry', type: 'reckless-action', ownerHeroId: aggressive.id,
      targetHeroId: 'fallen', sessionId: 'past', round: 1,
      changes: { rivalry: 100 }, memoryIds: [], description: 'Rivalry.', eventOrder: 1,
    });

    const grief = calculateSurvivorResponse(attached, 'fallen', 'resolution-1', 0.8, 1);
    const anger = calculateSurvivorResponse(aggressive, 'fallen', 'resolution-1', 0.8, 1);

    expect(grief.dominantResponse).toBe('grief');
    expect(anger.dominantResponse).toBe('anger');
    expect(grief.scores.guilt).toBe(0);
    expect(anger.scores.guilt).toBe(0);
  });

  it('keeps emotion and retained experiences bounded and rejects duplicate resolution effects', () => {
    let survivor = hero('survivor', 'cautious');
    survivor.personality!.innate.selfPreservation = 100;
    survivor.personality!.innate.discipline = 0;
    survivor.personality!.emotion.fear = 98;

    for (let index = 0; index < 25; index += 1) {
      const response = calculateSurvivorResponse(survivor, `fallen-${index}`, `resolution-${index}`, 1, index + 1);
      survivor = response.hero;
    }
    const duplicate = calculateSurvivorResponse(survivor, 'fallen-24', 'resolution-24', 1, 26);

    expect(survivor.personality!.emotion.fear).toBe(100);
    expect(survivor.survivorConsequences?.experiences).toHaveLength(20);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.hero).toBe(survivor);
  });

  it('recovers temporary emotion deterministically without erasing persistent experience', () => {
    const survivor = hero('survivor', 'recovery');
    survivor.personality!.emotion = { fear: 70, anger: 40, resolve: 30 };
    survivor.survivorConsequences = createEmptySurvivorProfile(survivor.id);

    const first = applySurvivorRecovery(survivor, 'recovery-1');
    const duplicate = applySurvivorRecovery(first.hero, 'recovery-1');

    expect(first.hero.personality!.emotion).toEqual({ fear: 65, anger: 35, resolve: 35 });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.hero).toBe(first.hero);
  });

  it('aggregates simultaneous losses before applying one bounded emotional update', () => {
    const survivor = hero('survivor', 'multi-loss');
    const single = calculateSurvivorResponse(survivor, 'fallen-a', 'resolution-single', 1, 1);

    const multiple = applySurvivorLosses(
      survivor,
      ['fallen-a', 'fallen-b'],
      'resolution-multiple',
      1,
    );

    expect(multiple.hero.personality?.emotion).toEqual(single.hero.personality?.emotion);
    expect(multiple.hero.survivorConsequences?.experiences).toHaveLength(2);
  });
});
