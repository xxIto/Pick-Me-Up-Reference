import { describe, expect, it } from 'vitest';
import { decideCombatAction } from '../src/features/ai/domain/utilityAI.ts';
import { runLearningCombat } from '../src/features/learning/domain/experienceCollector.ts';
import { createNeutralLearningProfile } from '../src/features/learning/domain/learningProfile.ts';
import { extractLearningContext } from '../src/features/learning/domain/context.ts';
import type { CombatState, CombatUnit } from '../src/features/combat/domain/types.ts';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';

function unit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally:a', sourceId: 'hero-a', name: 'Ally', class: 'Warrior', side: 'allies',
    position: { line: 'frontline', index: 0 },
    stats: { maxHp: 100, attack: 50, magic: 50, defense: 25, resistance: 25, speed: 50 },
    currentHp: 100, alive: true, defending: false, cooldowns: {}, skillIds: [], initiativeTie: 0,
    ...overrides,
  };
}

function state(units: readonly CombatUnit[], maxRounds = 3): CombatState {
  return {
    seed: 1, round: 1, maxRounds, units,
    turnOrder: { unitIds: units.map((entry) => entry.id), currentIndex: 0 },
    events: [], result: { outcome: 'ongoing', completedRound: 0, winningSide: null },
  };
}

describe('context extraction and learned decisions', () => {
  it('distinguishes critical, low, and medium actor health', () => {
    const enemy = unit({ id: 'enemy:a', sourceId: 'enemy-a', side: 'enemies', class: 'Enemy' });
    const action = { actorId: 'ally:a', type: 'defend' as const, targetId: 'ally:a' };
    const critical = extractLearningContext(state([unit({ currentHp: 20 }), enemy]), unit({ currentHp: 20 }), action);
    const low = extractLearningContext(state([unit({ currentHp: 40 }), enemy]), unit({ currentHp: 40 }), action);
    const medium = extractLearningContext(state([unit({ currentHp: 80 }), enemy]), unit({ currentHp: 80 }), action);

    expect([critical.actorHpCritical, critical.actorHpLow, critical.actorHpMedium]).toEqual([1, 0, 0]);
    expect([low.actorHpCritical, low.actorHpLow, low.actorHpMedium]).toEqual([0, 1, 0]);
    expect([medium.actorHpCritical, medium.actorHpLow, medium.actorHpMedium]).toEqual([0, 0, 1]);
  });

  it('uses contextual weights in the learned decision contribution', () => {
    const actor = unit({ currentHp: 20 });
    const enemy = unit({ id: 'enemy:a', sourceId: 'enemy-a', side: 'enemies', class: 'Enemy' });
    const combat = state([actor, enemy]);
    const personality = migrateLegacyPersonality('hero-a');
    personality.innate = {
      ...personality.innate,
      discipline: 100,
      aggression: 0,
      selfPreservation: 100,
    };
    const learning = createNeutralLearningProfile();
    learning.contextWeights.defense.actorHpCritical = 4;

    const baseline = decideCombatAction(combat, { personality, teamStrategy: 'Balanced' });
    const learned = decideCombatAction(combat, {
      personality: { ...personality, learning },
      teamStrategy: 'Balanced',
    });
    const baselineDefense = baseline?.candidates.find((candidate) => candidate.action.type === 'defend');
    const learnedDefense = learned?.candidates.find((candidate) => candidate.action.type === 'defend');
    const healthyActor = unit({ currentHp: 100 });
    const healthyCombat = state([healthyActor, enemy]);
    const healthyLearned = decideCombatAction(healthyCombat, {
      personality: { ...personality, learning },
      teamStrategy: 'Balanced',
    });
    const healthyDefense = healthyLearned?.candidates.find((candidate) => candidate.action.type === 'defend');

    expect(learnedDefense?.learnedPreferenceContribution).toBeGreaterThan(
      baselineDefense?.learnedPreferenceContribution ?? 0,
    );
    expect(healthyDefense?.learnedPreferenceContribution).toBe(0);
  });
});

describe('experience collection', () => {
  it('records actual allied actions without mutating the supplied personality', () => {
    const actor = unit({ currentHp: 160, stats: { ...unit().stats, maxHp: 160 } });
    const enemy = unit({
      id: 'enemy:a', sourceId: 'enemy-a', side: 'enemies', class: 'Enemy', currentHp: 160,
      stats: { ...unit().stats, maxHp: 160 },
    });
    const combat = state([actor, enemy], 4);
    const personality = migrateLegacyPersonality('hero-a');
    const snapshot = structuredClone(personality);
    const result = runLearningCombat(
      combat,
      () => ({ personality, teamStrategy: 'Balanced' }),
      { sessionId: 'sandbox-a' },
    );

    expect(result.experience.observations.length).toBeGreaterThan(0);
    expect(result.experience.eligibleForLearning).toBe(false);
    expect(result.experience.observations.every((item) => item.heroInstanceId === 'hero-a')).toBe(true);
    expect(personality).toEqual(snapshot);
  });

  it('replays identical collected experience from identical input', () => {
    const actor = unit({ currentHp: 160, stats: { ...unit().stats, maxHp: 160 } });
    const enemy = unit({
      id: 'enemy:a', sourceId: 'enemy-a', side: 'enemies', class: 'Enemy', currentHp: 160,
      stats: { ...unit().stats, maxHp: 160 },
    });
    const combat = state([actor, enemy], 4);
    const resolve = () => ({ personality: migrateLegacyPersonality('hero-a'), teamStrategy: 'Balanced' as const });

    expect(runLearningCombat(combat, resolve, { sessionId: 'repeat', eligibleForLearning: true })).toEqual(
      runLearningCombat(structuredClone(combat), resolve, { sessionId: 'repeat', eligibleForLearning: true }),
    );
  });

  it('attributes measured mitigation to the prior defend observation', () => {
    const tank = unit({ class: 'Tank', currentHp: 40 });
    const enemy = unit({ id: 'enemy:a', sourceId: 'enemy-a', side: 'enemies', class: 'Enemy' });
    const personality = migrateLegacyPersonality('hero-a');
    personality.innate = {
      ...personality.innate,
      discipline: 100,
      aggression: 0,
      selfPreservation: 100,
    };
    const result = runLearningCombat(
      state([tank, enemy], 2),
      () => ({ personality, teamStrategy: 'Defensive' }),
      { sessionId: 'mitigation' },
    );
    const defended = result.experience.observations.find(
      (item) => item.selectedCategory === 'defense' && item.outcome.mitigatedDamage > 0,
    );

    expect(defended?.outcome.mitigatedDamage).toBeGreaterThan(0);
  });
});
