import { describe, expect, it } from 'vitest';
import {
  applyCombatExperience,
  DEFAULT_LEARNING_CONFIG,
  validateLearningConfiguration,
} from '../src/features/learning/domain/learningEngine.ts';
import { createNeutralLearningProfile } from '../src/features/learning/domain/learningProfile.ts';
import { calculateLearningSignal } from '../src/features/learning/domain/rewards.ts';
import type {
  CombatExperience,
  LearningContextFeatures,
  LearningObservation,
} from '../src/features/learning/domain/types.ts';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';

const context: LearningContextFeatures = {
  actorHpCritical: 0,
  actorHpLow: 0,
  actorHpMedium: 1,
  allySurvivalRisk: 0.2,
  enemyThreat: 0.5,
  offensiveOpportunity: 0.8,
  defensiveOpportunity: 0.1,
  healingOpportunity: 0,
};

function observation(overrides: Partial<LearningObservation> = {}): LearningObservation {
  return {
    heroInstanceId: 'hero-a',
    sessionId: 'battle-a',
    observationSequence: 0,
    round: 1,
    actorClass: 'Warrior',
    context,
    selectedCategory: 'offense',
    selectedAction: { actorId: 'ally:a', type: 'basic-physical', targetId: 'enemy:a' },
    validAlternativeCategories: ['defense', 'activeSkill'],
    validCandidateActions: [],
    outcome: {
      damageDealt: 50,
      targetMaxHp: 100,
      healingDone: 0,
      healingCapacity: 0,
      wastedHealing: 0,
      targetEliminated: false,
      mitigatedDamage: 0,
      actorMaxHp: 100,
      severeSelfEndangerment: false,
      allyLosses: 0,
    },
    ...overrides,
  };
}

function experience(overrides: Partial<CombatExperience> = {}): CombatExperience {
  return {
    sessionId: 'battle-a',
    outcome: 'victory',
    observations: [observation()],
    eligibleForLearning: true,
    ...overrides,
  };
}

describe('learning profile and configuration', () => {
  it('creates independent neutral bounded profiles', () => {
    const first = createNeutralLearningProfile();
    const second = createNeutralLearningProfile();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.contextWeights.offense).not.toBe(second.contextWeights.offense);
    expect(Object.values(first.contextWeights.offense).every((value) => value === 0)).toBe(true);
  });

  it('validates learning-rate and bound configuration', () => {
    expect(validateLearningConfiguration(DEFAULT_LEARNING_CONFIG)).toEqual({ valid: true });
    expect(validateLearningConfiguration({ ...DEFAULT_LEARNING_CONFIG, learningRate: 0 })).toEqual({ valid: true });
    expect(validateLearningConfiguration({ ...DEFAULT_LEARNING_CONFIG, learningRate: 1 })).toEqual({ valid: true });
    expect(validateLearningConfiguration({ ...DEFAULT_LEARNING_CONFIG, learningRate: -0.1 }).valid).toBe(false);
    expect(validateLearningConfiguration({ ...DEFAULT_LEARNING_CONFIG, learningRate: 1.1 }).valid).toBe(false);
    expect(validateLearningConfiguration({ ...DEFAULT_LEARNING_CONFIG, contextWeightLimit: Number.NaN }).valid).toBe(false);
  });
});

describe('reward and online update', () => {
  it('rewards meaningful damage and elimination but penalizes wasted healing', () => {
    const damage = calculateLearningSignal(observation({
      outcome: { ...observation().outcome, damageDealt: 100, targetEliminated: true },
    }), 'victory');
    const wastedHealing = calculateLearningSignal(observation({
      actorClass: 'Healer',
      selectedCategory: 'healing',
      outcome: {
        ...observation().outcome,
        damageDealt: 0,
        healingDone: 5,
        healingCapacity: 100,
        wastedHealing: 95,
      },
    }), 'defeat');

    expect(damage.reward).toBeGreaterThan(0);
    expect(damage.components.elimination).toBeGreaterThan(0);
    expect(wastedHealing.reward).toBeLessThan(0);
    expect(wastedHealing.components.wastedHealing).toBeLessThan(0);
  });

  it('does not treat tank damage absorption as severe self-endangerment', () => {
    const tank = calculateLearningSignal(observation({
      actorClass: 'Tank',
      outcome: { ...observation().outcome, damageDealt: 0, severeSelfEndangerment: true },
    }), 'draw');
    const warrior = calculateLearningSignal(observation({
      outcome: { ...observation().outcome, damageDealt: 0, severeSelfEndangerment: true },
    }), 'draw');

    expect(tank.components.selfEndangerment).toBe(0);
    expect(warrior.components.selfEndangerment).toBeLessThan(0);
  });

  it('rewards measured defend mitigation', () => {
    const signal = calculateLearningSignal(observation({
      actorClass: 'Tank',
      selectedCategory: 'defense',
      outcome: { ...observation().outcome, damageDealt: 0, mitigatedDamage: 40 },
    }), 'draw');

    expect(signal.components.mitigation).toBeGreaterThan(0);
    expect(signal.reward).toBeGreaterThan(0);
  });

  it('produces identical immutable updates for identical input', () => {
    const personality = migrateLegacyPersonality('hero-a');
    const original = structuredClone(personality);
    const first = applyCombatExperience(personality, experience(), DEFAULT_LEARNING_CONFIG);
    const second = applyCombatExperience(personality, experience(), DEFAULT_LEARNING_CONFIG);

    expect(first).toEqual(second);
    expect(personality).toEqual(original);
    expect(first.personality.innate).toEqual(personality.innate);
    expect(first.updates[0].updatedValue).toBeGreaterThan(first.updates[0].previousValue);
  });

  it('clamps learned values and remains finite after repeated extreme observations', () => {
    let personality = migrateLegacyPersonality('hero-a');
    for (let index = 0; index < 100; index += 1) {
      const result = applyCombatExperience(personality, experience({
        sessionId: `battle-${index}`,
        observations: [observation({ sessionId: `battle-${index}` })],
      }), { ...DEFAULT_LEARNING_CONFIG, learningRate: 1 });
      personality = result.personality;
    }

    expect(personality.learned.offense).toBeLessThanOrEqual(10);
    expect(Object.values(personality.learning?.contextWeights.offense ?? {}).every(
      (value) => Number.isFinite(value) && Math.abs(value) <= DEFAULT_LEARNING_CONFIG.contextWeightLimit,
    )).toBe(true);
  });

  it('neutralizes non-finite observation values instead of producing NaN', () => {
    const personality = migrateLegacyPersonality('hero-a');
    const unstable = observation({
      context: { ...context, offensiveOpportunity: Number.POSITIVE_INFINITY },
      outcome: { ...observation().outcome, damageDealt: Number.NaN },
    });
    const result = applyCombatExperience(
      personality,
      experience({ observations: [unstable] }),
      DEFAULT_LEARNING_CONFIG,
    );

    expect(Number.isFinite(result.personality.learned.offense)).toBe(true);
    expect(Object.values(result.personality.learning?.contextWeights.offense ?? {}).every(Number.isFinite)).toBe(true);
  });

  it('ignores ineligible and duplicate battle results', () => {
    const personality = migrateLegacyPersonality('hero-a');
    const ignored = applyCombatExperience(
      personality,
      experience({ eligibleForLearning: false }),
      DEFAULT_LEARNING_CONFIG,
    );
    const applied = applyCombatExperience(personality, experience(), DEFAULT_LEARNING_CONFIG);
    const duplicate = applyCombatExperience(applied.personality, experience(), DEFAULT_LEARNING_CONFIG);

    expect(ignored.personality).toEqual(personality);
    expect(ignored.updates).toHaveLength(0);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.personality).toEqual(applied.personality);
  });

  it('allows different experiences to produce different profiles', () => {
    const base = migrateLegacyPersonality('hero-a');
    const success = applyCombatExperience(base, experience(), DEFAULT_LEARNING_CONFIG);
    const failure = applyCombatExperience(base, experience({
      outcome: 'defeat',
      observations: [observation({
        outcome: {
          ...observation().outcome,
          damageDealt: 0,
          severeSelfEndangerment: true,
          allyLosses: 2,
        },
      })],
    }), DEFAULT_LEARNING_CONFIG);

    expect(success.personality.learned).not.toEqual(failure.personality.learned);
    expect(success.personality.learning).not.toEqual(failure.personality.learning);
  });
});
