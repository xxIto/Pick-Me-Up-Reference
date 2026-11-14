import { describe, expect, it } from 'vitest';
import {
  createEmptyMemoryProfile,
  DEFAULT_MEMORY_CONFIG,
  retainMemoryProfile,
  validateMemoryConfiguration,
  validateEpisodicMemory,
} from '../src/features/memory/domain/memoryProfile.ts';
import { calculateMemorySignificance } from '../src/features/memory/domain/significance.ts';
import { formHeroMemories } from '../src/features/memory/domain/memoryFormation.ts';
import { recallMemories } from '../src/features/memory/domain/memoryRecall.ts';
import type {
  EpisodicMemory,
  MemoryFormationSource,
  MemoryRecallContext,
} from '../src/features/memory/domain/types.ts';
import type { CombatState, CombatUnit } from '../src/features/combat/domain/types.ts';
import type { CombatExperience, LearningObservation } from '../src/features/learning/domain/types.ts';

function unit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally:a', sourceId: 'hero-a', name: 'Hero', class: 'Warrior', side: 'allies',
    position: { line: 'frontline', index: 0 },
    stats: { maxHp: 100, attack: 50, magic: 30, defense: 25, resistance: 20, speed: 50 },
    currentHp: 20, alive: true, defending: false, cooldowns: {}, skillIds: [], initiativeTie: 0,
    ...overrides,
  };
}

function state(units: readonly CombatUnit[], outcome: CombatState['result']['outcome'] = 'victory'): CombatState {
  return {
    seed: 1, round: 2, maxRounds: 5, units,
    turnOrder: { unitIds: units.map((entry) => entry.id), currentIndex: 0 },
    events: [
      { sequence: 1, round: 1, type: 'battle-started', message: 'Battle started.' },
      {
        sequence: 2, round: 1, type: 'damage', actorId: 'enemy:a', targetId: 'ally:a',
        amount: 30, damageType: 'physical', message: 'Observed damage.',
      },
      { sequence: 3, round: 2, type: 'battle-ended', message: 'Battle ended.' },
    ],
    result: { outcome, completedRound: 2, winningSide: outcome === 'victory' ? 'allies' : 'enemies' },
  };
}

function observation(overrides: Partial<LearningObservation> = {}): LearningObservation {
  return {
    heroInstanceId: 'hero-a', sessionId: 'battle-1', observationSequence: 0, round: 1,
    actorClass: 'Warrior',
    context: {
      actorHpCritical: 1, actorHpLow: 0, actorHpMedium: 0, allySurvivalRisk: 0.8,
      enemyThreat: 0.8, offensiveOpportunity: 0.7, defensiveOpportunity: 0.8,
      healingOpportunity: 0,
    },
    selectedCategory: 'offense',
    selectedAction: { actorId: 'ally:a', type: 'basic-physical', targetId: 'enemy:a' },
    validAlternativeCategories: ['defense'],
    validCandidateActions: [],
    outcome: {
      damageDealt: 50, targetMaxHp: 100, healingDone: 0, healingCapacity: 0,
      wastedHealing: 0, targetEliminated: true, mitigatedDamage: 0, actorMaxHp: 100,
      severeSelfEndangerment: true, allyLosses: 0,
    },
    ...overrides,
  };
}

function formationSource(overrides: Partial<MemoryFormationSource> = {}): MemoryFormationSource {
  const hero = unit();
  const enemy = unit({ id: 'enemy:a', sourceId: 'ash-hound', side: 'enemies', class: 'Enemy', alive: false, currentHp: 0 });
  const finalState = state([hero, enemy]);
  const experience: CombatExperience = {
    sessionId: 'battle-1', outcome: 'victory', observations: [observation()], eligibleForLearning: true,
  };
  return {
    heroInstanceId: 'hero-a', sessionId: 'battle-1', finalState, experience,
    eligibleForPersistence: true, encounterLabel: 'Ashen Warband',
    ...overrides,
  };
}

function memory(overrides: Partial<EpisodicMemory> = {}): EpisodicMemory {
  return {
    id: 'memory:hero-a:battle-1:victory', ownerHeroId: 'hero-a', sourceId: 'battle-1:result',
    category: 'Achievement', title: 'Victory remembered',
    description: 'The party survived the observed encounter.', participantIds: ['ash-hound'],
    context: { sessionId: 'battle-1', round: 2, encounterLabel: 'Ashen Warband', enemyCategoryIds: ['ash-hound'], combatOutcome: 'victory', threatLevel: 0.8 },
    facts: { outcome: 'victory', enemyCategoryIds: ['ash-hound'] },
    significance: { score: 80, severity: 0.6, personalRisk: 0.8, novelty: 1, outcomeImportance: 1, relevance: 1 },
    eventOrder: 1, relatedMemoryIds: [],
    ...overrides,
  };
}

describe('memory schema and formation', () => {
  it('creates independent empty profiles linked to stable hero ids', () => {
    const first = createEmptyMemoryProfile('hero-a');
    const second = createEmptyMemoryProfile('hero-b');
    expect(first.ownerHeroId).toBe('hero-a');
    expect(second.ownerHeroId).toBe('hero-b');
    expect(first.memories).not.toBe(second.memories);
    expect(first.enemyKnowledge).not.toBe(second.enemyKnowledge);
  });

  it('accepts factual bounded memories and rejects invalid ownership or significance', () => {
    expect(validateEpisodicMemory(memory(), 'hero-a')).toBe(true);
    expect(validateEpisodicMemory(memory({ ownerHeroId: 'hero-b' }), 'hero-a')).toBe(false);
    expect(validateEpisodicMemory(memory({ significance: { ...memory().significance, score: 101 } }), 'hero-a')).toBe(false);
    expect(validateEpisodicMemory({ ...memory(), sourceId: '' }, 'hero-a')).toBe(false);
  });

  it('bounds significance from observable factors', () => {
    expect(calculateMemorySignificance({ severity: -1, personalRisk: 0, novelty: 0, outcomeImportance: 0, relevance: 0 }).score).toBe(0);
    expect(calculateMemorySignificance({ severity: 2, personalRisk: 2, novelty: 2, outcomeImportance: 2, relevance: 2 }).score).toBe(100);
  });

  it('rejects unsafe memory capacity and utility configuration', () => {
    expect(validateMemoryConfiguration(DEFAULT_MEMORY_CONFIG)).toEqual({ valid: true });
    expect(validateMemoryConfiguration({ ...DEFAULT_MEMORY_CONFIG, maximumRecall: 101 }).valid).toBe(false);
    expect(validateMemoryConfiguration({ ...DEFAULT_MEMORY_CONFIG, maximumUtilityContribution: Number.NaN }).valid).toBe(false);
  });

  it('forms factual survival, encounter, and victory memories plus enemy knowledge', () => {
    const result = formHeroMemories(createEmptyMemoryProfile('hero-a'), formationSource());
    expect(result.createdMemories.some((entry) => entry.category === 'Survival')).toBe(true);
    expect(result.createdMemories.some((entry) => entry.category === 'Achievement')).toBe(true);
    expect(result.profile.enemyKnowledge[0].enemyCategoryId).toBe('ash-hound');
    expect(result.profile.enemyKnowledge[0].observedAttackTypes).toContain('physical');
    expect(result.createdMemories.every((entry) => entry.sourceId.startsWith('battle-1'))).toBe(true);
  });

  it('does not fabricate social memories without an observed rescue', () => {
    const result = formHeroMemories(createEmptyMemoryProfile('hero-a'), formationSource());
    expect(result.createdMemories.some((entry) => entry.category === 'Social')).toBe(false);
  });

  it('prevents duplicate source processing', () => {
    const first = formHeroMemories(createEmptyMemoryProfile('hero-a'), formationSource());
    const duplicate = formHeroMemories(first.profile, formationSource());
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.profile).toEqual(first.profile);
    expect(duplicate.createdMemories).toHaveLength(0);
  });

  it('does not persist sandbox results without an explicit eligible boundary', () => {
    const profile = createEmptyMemoryProfile('hero-a');
    const result = formHeroMemories(profile, formationSource({ eligibleForPersistence: false }));

    expect(result.profile).toBe(profile);
    expect(result.createdMemories).toHaveLength(0);
    expect(result.duplicate).toBe(false);
  });

  it('updates bounded enemy knowledge from separately identified encounters', () => {
    const first = formHeroMemories(createEmptyMemoryProfile('hero-a'), formationSource());
    const secondSource = formationSource({
      sessionId: 'battle-2',
      experience: {
        ...formationSource().experience,
        sessionId: 'battle-2',
        observations: [observation({ sessionId: 'battle-2' })],
      },
    });
    const second = formHeroMemories(first.profile, secondSource);

    expect(second.profile.enemyKnowledge[0].encounterCount).toBe(2);
    expect(second.profile.enemyKnowledge[0].damageObservationCount).toBe(2);
    expect(second.profile.enemyKnowledge[0].totalObservedDamage).toBe(60);
  });
});

describe('memory retention and recall', () => {
  it('enforces capacity with deterministic pruning while preserving a major milestone', () => {
    const entries = Array.from({ length: 105 }, (_, index) => memory({
      id: `memory-${index}`, sourceId: `source-${index}`, eventOrder: index + 1,
      category: index === 0 ? 'Milestone' : 'Combat',
      significance: { ...memory().significance, score: index === 0 ? 95 : 10 + index % 40 },
    }));
    const base = createEmptyMemoryProfile('hero-a');
    const first = retainMemoryProfile({ ...base, memories: entries });
    const second = retainMemoryProfile({ ...base, memories: [...entries].reverse() });
    expect(first.memories).toHaveLength(100);
    expect(first.memories.some((entry) => entry.id === 'memory-0')).toBe(true);
    expect(first.memories.map((entry) => entry.id)).toEqual(second.memories.map((entry) => entry.id));
  });

  it('recalls at most five relevant memories with stable ordering and bounded contribution', () => {
    const profile = {
      ...createEmptyMemoryProfile('hero-a'),
      memories: Array.from({ length: 8 }, (_, index) => memory({
        id: `memory-${index}`, sourceId: `source-${index}`, eventOrder: index + 1,
      })),
    };
    const context: MemoryRecallContext = {
      heroInstanceId: 'hero-a', enemyCategoryIds: ['ash-hound'], participantIds: [],
      threatLevel: 0.8, actorHpBand: 'critical', actionCategory: 'defense', allySurvivalRisk: 0.4,
    };
    const first = recallMemories(profile, context);
    const second = recallMemories(structuredClone(profile), context);
    expect(first).toEqual(second);
    expect(first.memories).toHaveLength(5);
    expect(Math.abs(first.totalUtilityContribution)).toBeLessThanOrEqual(15);
    expect(first.memories.map((entry) => entry.memory.id)).toEqual([...first.memories.map((entry) => entry.memory.id)].sort());
  });

  it('clamps combined memory utility to the configured contribution limit', () => {
    const profile = {
      ...createEmptyMemoryProfile('hero-a'),
      memories: Array.from({ length: 5 }, (_, index) => memory({
        id: `survival-${index}`, sourceId: `survival-source-${index}`,
        category: 'Survival', eventOrder: index + 1,
      })),
    };
    const context: MemoryRecallContext = {
      heroInstanceId: 'hero-a', enemyCategoryIds: ['ash-hound'], participantIds: [],
      threatLevel: 0.8, actorHpBand: 'critical', actionCategory: 'defense', allySurvivalRisk: 0.4,
    };
    const recalled = recallMemories(profile, context, {
      ...DEFAULT_MEMORY_CONFIG,
      maximumUtilityContribution: 1,
    });

    expect(Math.abs(recalled.totalUtilityContribution)).toBeLessThanOrEqual(1);
  });
});
