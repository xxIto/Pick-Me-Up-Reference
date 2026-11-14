import { describe, expect, it } from 'vitest';
import { decideCombatAction } from '../src/features/ai/domain/utilityAI.ts';
import type { CombatState, CombatUnit } from '../src/features/combat/domain/types.ts';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';
import { createEmptyMemoryProfile } from '../src/features/memory/domain/memoryProfile.ts';
import type { EpisodicMemory } from '../src/features/memory/domain/types.ts';

function unit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally:a', sourceId: 'hero-a', name: 'Hero', class: 'Warrior', side: 'allies',
    position: { line: 'frontline', index: 0 },
    stats: { maxHp: 100, attack: 50, magic: 50, defense: 25, resistance: 25, speed: 50 },
    currentHp: 20, alive: true, defending: false, cooldowns: {}, skillIds: [], initiativeTie: 0,
    ...overrides,
  };
}

function combatState(): CombatState {
  const actor = unit();
  const enemy = unit({ id: 'enemy:a', sourceId: 'ash-hound', side: 'enemies', class: 'Enemy' });
  return {
    seed: 1, round: 1, maxRounds: 3, units: [actor, enemy],
    turnOrder: { unitIds: [actor.id, enemy.id], currentIndex: 0 }, events: [],
    result: { outcome: 'ongoing', completedRound: 0, winningSide: null },
  };
}

function survivalMemory(): EpisodicMemory {
  return {
    id: 'memory-survival', ownerHeroId: 'hero-a', sourceId: 'old-battle:survival',
    category: 'Survival', title: 'Near-death survival',
    description: 'Hero survived after acting at critical health.', participantIds: ['ash-hound'],
    context: { sessionId: 'old-battle', round: 2, enemyCategoryIds: ['ash-hound'], combatOutcome: 'victory', threatLevel: 0.8 },
    facts: { survivedCriticalHealth: true, enemyCategoryIds: ['ash-hound'] },
    significance: { score: 90, severity: 1, personalRisk: 1, novelty: 1, outcomeImportance: 0.8, relevance: 1 },
    eventOrder: 1, relatedMemoryIds: [],
  };
}

describe('memory-aware utility AI', () => {
  it('adds a separate bounded memory contribution without mutating personality or learning', () => {
    const state = combatState();
    const personality = migrateLegacyPersonality('hero-a');
    const personalitySnapshot = structuredClone(personality);
    const memoryProfile = { ...createEmptyMemoryProfile('hero-a'), memories: [survivalMemory()] };
    const memorySnapshot = structuredClone(memoryProfile);
    const decision = decideCombatAction(state, { personality, memoryProfile, teamStrategy: 'Balanced' });
    const defend = decision?.candidates.find((candidate) => candidate.action.type === 'defend');

    expect(defend?.memoryContribution).toBeGreaterThan(0);
    expect(Math.abs(defend?.memoryContribution ?? 0)).toBeLessThanOrEqual(15);
    expect(decision?.recalledMemories.length).toBeGreaterThan(0);
    expect(personality).toEqual(personalitySnapshot);
    expect(memoryProfile).toEqual(memorySnapshot);
  });

  it('does not apply memory as a second learned-preference update', () => {
    const personality = migrateLegacyPersonality('hero-a');
    personality.learned.defense = 2;
    const memoryProfile = { ...createEmptyMemoryProfile('hero-a'), memories: [survivalMemory()] };
    const decision = decideCombatAction(combatState(), { personality, memoryProfile, teamStrategy: 'Balanced' });
    const defend = decision?.candidates.find((candidate) => candidate.action.type === 'defend');

    expect(defend?.learnedPreferenceContribution).toBe(2);
    expect(defend?.memoryContribution).not.toBe(defend?.learnedPreferenceContribution);
  });

  it('produces identical memory-aware decisions from identical state', () => {
    const personality = migrateLegacyPersonality('hero-a');
    const memoryProfile = { ...createEmptyMemoryProfile('hero-a'), memories: [survivalMemory()] };
    const context = { personality, memoryProfile, teamStrategy: 'Balanced' as const };

    expect(decideCombatAction(combatState(), context)).toEqual(
      decideCombatAction(structuredClone(combatState()), structuredClone(context)),
    );
  });
});
