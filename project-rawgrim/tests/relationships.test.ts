import { describe, expect, it } from 'vitest';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';
import { createEmptyMemoryProfile } from '../src/features/memory/domain/memoryProfile.ts';
import {
  applyRelationshipEvent,
  formPartyRelationships,
} from '../src/features/social/domain/relationshipEngine.ts';
import {
  createEmptyRelationshipProfile,
  getRelationship,
  normalizeRelationshipProfile,
  DEFAULT_RELATIONSHIP_CONFIG,
  validateRelationshipConfiguration,
} from '../src/features/social/domain/relationshipProfile.ts';
import type {
  RelationshipEvent,
  RelationshipFormationHero,
  RelationshipFormationSource,
} from '../src/features/social/domain/types.ts';
import type { CombatState, CombatUnit } from '../src/features/combat/domain/types.ts';
import type { CombatExperience, LearningObservation } from '../src/features/learning/domain/types.ts';

function unit(id: string, side: CombatUnit['side'] = 'allies', overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: `${side}:${id}`, sourceId: id, name: id, class: side === 'allies' ? 'Healer' : 'Enemy', side,
    position: { line: 'frontline', index: 0 },
    stats: { maxHp: 100, attack: 40, magic: 50, defense: 20, resistance: 20, speed: 40 },
    currentHp: 100, alive: true, defending: false, cooldowns: {}, skillIds: [], initiativeTie: 0,
    ...overrides,
  };
}

function observation(overrides: Partial<LearningObservation> = {}): LearningObservation {
  return {
    heroInstanceId: 'hero-b', sessionId: 'battle-1', observationSequence: 0, round: 1,
    actorClass: 'Healer',
    context: {
      actorHpCritical: 0, actorHpLow: 0, actorHpMedium: 1, allySurvivalRisk: 0.9,
      enemyThreat: 0.8, offensiveOpportunity: 0.4, defensiveOpportunity: 0.3, healingOpportunity: 0.9,
    },
    selectedCategory: 'healing',
    selectedAction: { actorId: 'allies:hero-b', type: 'skill', targetId: 'allies:hero-a', skillId: 'mending-light' },
    validAlternativeCategories: ['offense'], validCandidateActions: [],
    outcome: {
      damageDealt: 0, targetMaxHp: 100, healingDone: 35, healingCapacity: 40, wastedHealing: 5,
      targetEliminated: false, mitigatedDamage: 0, actorMaxHp: 100,
      severeSelfEndangerment: false, allyLosses: 0,
    },
    ...overrides,
  };
}

function source(observations: readonly LearningObservation[] = [observation()]): RelationshipFormationSource {
  const units = [unit('hero-a'), unit('hero-b'), unit('ash-hound', 'enemies', { alive: false, currentHp: 0 })];
  const finalState: CombatState = {
    seed: 1, round: 2, maxRounds: 5, units,
    turnOrder: { unitIds: units.map((entry) => entry.id), currentIndex: 0 },
    events: [], result: { outcome: 'victory', completedRound: 2, winningSide: 'allies' },
  };
  const experience: CombatExperience = {
    sessionId: 'battle-1', outcome: 'victory', observations, eligibleForLearning: true,
  };
  return { sessionId: 'battle-1', finalState, experience, eligibleForPersistence: true };
}

function hero(id: string, personalityId = id): RelationshipFormationHero {
  return {
    instanceId: id,
    personality: migrateLegacyPersonality(personalityId),
    memoryProfile: createEmptyMemoryProfile(id),
    relationshipProfile: createEmptyRelationshipProfile(id),
  };
}

describe('directional relationship profiles', () => {
  it('creates independent neutral profiles linked to their owner', () => {
    const first = createEmptyRelationshipProfile('hero-a');
    const second = createEmptyRelationshipProfile('hero-b');

    expect(first.ownerHeroId).toBe('hero-a');
    expect(second.ownerHeroId).toBe('hero-b');
    expect(first.relationships).not.toBe(second.relationships);
    expect(getRelationship(first, 'hero-b')).toBeNull();
  });

  it('rejects unsafe capacity, threshold, and utility configuration', () => {
    expect(validateRelationshipConfiguration(DEFAULT_RELATIONSHIP_CONFIG)).toEqual({ valid: true });
    expect(validateRelationshipConfiguration({ ...DEFAULT_RELATIONSHIP_CONFIG, maximumHistoryPerRelationship: 0 }).valid).toBe(false);
    expect(validateRelationshipConfiguration({ ...DEFAULT_RELATIONSHIP_CONFIG, minimumSharedBattleThreat: 2 }).valid).toBe(false);
    expect(validateRelationshipConfiguration({ ...DEFAULT_RELATIONSHIP_CONFIG, maximumLeadershipUtility: Number.NaN }).valid).toBe(false);
  });

  it('keeps opposite relationship directions independent after a rescue', () => {
    const result = formPartyRelationships([hero('hero-a'), hero('hero-b')], source());
    const aToB = getRelationship(result.profiles.find((entry) => entry.ownerHeroId === 'hero-a')!, 'hero-b');
    const bToA = getRelationship(result.profiles.find((entry) => entry.ownerHeroId === 'hero-b')!, 'hero-a');

    expect(aToB?.trust).toBeGreaterThan(bToA?.trust ?? 0);
    expect(aToB?.affection).toBeGreaterThan(bToA?.affection ?? 0);
    expect(aToB?.familiarity).toBeGreaterThan(0);
    expect(bToA?.familiarity).toBeGreaterThan(0);
  });

  it('does not fabricate a rescue below the meaningful-healing threshold', () => {
    const weakHeal = observation({ outcome: { ...observation().outcome, healingDone: 10 } });
    const result = formPartyRelationships([hero('hero-a'), hero('hero-b')], source([weakHeal]));
    const aToB = getRelationship(result.profiles.find((entry) => entry.ownerHeroId === 'hero-a')!, 'hero-b');

    expect(aToB?.history.some((event) => event.type === 'meaningful-rescue')).toBe(false);
    expect(aToB?.trust).toBe(0);
  });

  it('lets disciplined and aggressive observers react differently to observed recklessness', () => {
    const reckless = observation({
      heroInstanceId: 'hero-a', actorClass: 'Warrior', selectedCategory: 'offense',
      context: { ...observation().context, enemyThreat: 0.5 },
      selectedAction: { actorId: 'allies:hero-a', type: 'basic-physical', targetId: 'enemies:ash-hound' },
      outcome: { ...observation().outcome, healingDone: 0, severeSelfEndangerment: true },
    });
    const disciplined = hero('hero-b', 'disciplined');
    disciplined.personality.innate.discipline = 100;
    disciplined.personality.innate.aggression = 0;
    const aggressive = hero('hero-c', 'aggressive');
    aggressive.personality.innate.discipline = 0;
    aggressive.personality.innate.aggression = 100;
    const base = source([reckless]);
    const heroC = unit('hero-c');
    const result = formPartyRelationships([hero('hero-a'), disciplined, aggressive], {
      ...base,
      finalState: { ...base.finalState, units: [...base.finalState.units, heroC] },
    });

    const bToA = getRelationship(result.profiles.find((entry) => entry.ownerHeroId === 'hero-b')!, 'hero-a');
    const cToA = getRelationship(result.profiles.find((entry) => entry.ownerHeroId === 'hero-c')!, 'hero-a');
    expect(bToA?.trust).toBeLessThan(0);
    expect(bToA?.respect).toBeLessThan(0);
    expect(cToA?.respect).toBeGreaterThan(0);
  });

  it('bounds dimensions and retains bounded history', () => {
    let profile = createEmptyRelationshipProfile('hero-a');
    for (let index = 0; index < 40; index += 1) {
      const event: RelationshipEvent = {
        id: `event-${index}`, sourceId: `source-${index}`, type: 'major-victory',
        ownerHeroId: 'hero-a', targetHeroId: 'hero-b', sessionId: `battle-${index}`,
        round: 1, changes: { trust: 20, rivalry: 20, familiarity: 20 },
        memoryIds: [], description: 'Observed shared victory.', eventOrder: index + 1,
      };
      profile = applyRelationshipEvent(profile, event);
    }
    const relationship = getRelationship(profile, 'hero-b');

    expect(relationship?.trust).toBe(100);
    expect(relationship?.rivalry).toBe(100);
    expect(relationship?.familiarity).toBe(100);
    expect(relationship?.history).toHaveLength(20);
  });

  it('prevents duplicate battle processing and ignores ineligible sandbox results', () => {
    const first = formPartyRelationships([hero('hero-a'), hero('hero-b')], source());
    const heroes = first.profiles.map((profile) => ({
      ...hero(profile.ownerHeroId), relationshipProfile: profile,
    }));
    const duplicate = formPartyRelationships(heroes, source());
    const sandbox = formPartyRelationships([hero('hero-a'), hero('hero-b')], {
      ...source(), eligibleForPersistence: false,
    });

    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.profiles).toEqual(first.profiles);
    expect(sandbox.profiles.map((profile) => profile.relationships)).toEqual([[], []]);
  });

  it('drops invalid target references while preserving valid dead-hero relationships', () => {
    const event: RelationshipEvent = {
      id: 'valid', sourceId: 'valid', type: 'shared-battle', ownerHeroId: 'hero-a',
      targetHeroId: 'hero-dead', sessionId: 'battle', round: 1,
      changes: { familiarity: 2 }, memoryIds: [], description: 'Fought together.', eventOrder: 1,
    };
    const withValid = applyRelationshipEvent(createEmptyRelationshipProfile('hero-a'), event);
    const withInvalid = {
      ...withValid,
      relationships: [...withValid.relationships, { ...withValid.relationships[0], targetHeroId: 'missing' }],
    };

    const normalized = normalizeRelationshipProfile(withInvalid, 'hero-a', new Set(['hero-a', 'hero-dead']));
    expect(normalized.relationships.map((entry) => entry.targetHeroId)).toEqual(['hero-dead']);
  });
});
