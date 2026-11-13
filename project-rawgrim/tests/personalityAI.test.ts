import { describe, expect, it } from 'vitest';
import {
  createNeutralDecisionContext,
  runAutonomousCombat,
  stepAutonomousCombat,
} from '../src/features/ai/domain/autonomousCombat.ts';
import type { DecisionContext, DecisionTrace } from '../src/features/ai/domain/types.ts';
import { decideCombatAction, scoreCandidateAction } from '../src/features/ai/domain/utilityAI.ts';
import { getAvailableActions, getCurrentActor } from '../src/features/combat/domain/combatEngine.ts';
import type { CombatState, CombatUnit } from '../src/features/combat/domain/types.ts';
import {
  createNeutralEmotionalState,
  createNeutralLearnedPreferences,
  generatePersonality,
  migrateLegacyPersonality,
  normalizeLearnedPreference,
  normalizePersonalityValue,
  validatePersonalityDimensions,
} from '../src/features/heroes/domain/personality.ts';
import type {
  HeroPersonalityState,
  PersonalityDimensions,
  TeamStrategy,
} from '../src/features/heroes/domain/personalityTypes.ts';

function unit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally:actor',
    sourceId: 'hero-actor',
    name: 'Actor',
    class: 'Warrior',
    side: 'allies',
    position: { line: 'frontline', index: 0 },
    stats: { maxHp: 100, attack: 50, magic: 50, defense: 25, resistance: 25, speed: 50 },
    currentHp: 100,
    alive: true,
    defending: false,
    cooldowns: {},
    skillIds: [],
    initiativeTie: 0,
    ...overrides,
  };
}

function combatState(
  units: readonly CombatUnit[],
  order = units.map((entry) => entry.id),
  maxRounds = 3,
): CombatState {
  return {
    seed: 1,
    round: 1,
    maxRounds,
    units,
    turnOrder: { unitIds: order, currentIndex: 0 },
    events: [],
    result: { outcome: 'ongoing', completedRound: 0, winningSide: null },
  };
}

function personality(
  innate: Partial<PersonalityDimensions> = {},
  identityId = 'personality:hero-actor',
): HeroPersonalityState {
  return {
    identityId,
    innateTraitId: 'test-trait',
    innate: {
      courage: 50,
      discipline: 50,
      aggression: 50,
      empathy: 50,
      selfPreservation: 50,
      ambition: 50,
      trust: 50,
      ...innate,
    },
    learned: createNeutralLearnedPreferences(),
    emotion: createNeutralEmotionalState(),
  };
}

function context(
  innate: Partial<PersonalityDimensions> = {},
  teamStrategy: TeamStrategy = 'Balanced',
): DecisionContext {
  return { personality: personality(innate), teamStrategy };
}

describe('personality identities and migration', () => {
  it('validates only integer personality dimensions from zero through one hundred', () => {
    expect(validatePersonalityDimensions(personality().innate)).toBe(true);
    expect(validatePersonalityDimensions({ ...personality().innate, courage: 101 })).toBe(false);
    expect(validatePersonalityDimensions({ ...personality().innate, trust: 1.5 })).toBe(false);
  });

  it('normalizes personality and learned values to their documented bounds', () => {
    expect(normalizePersonalityValue(-2)).toBe(0);
    expect(normalizePersonalityValue(49.6)).toBe(50);
    expect(normalizePersonalityValue(150)).toBe(100);
    expect(normalizeLearnedPreference(-20)).toBe(-10);
    expect(normalizeLearnedPreference(20)).toBe(10);
  });

  it('generates distinct profiles for separate identities sharing one trait', () => {
    const first = generatePersonality('personality:first', 'shared-trait', () => 0.1);
    const second = generatePersonality('personality:second', 'shared-trait', () => 0.9);

    expect(first.innate).not.toEqual(second.innate);
    expect(first.identityId).not.toBe(second.identityId);
    expect(first.learned).toEqual(createNeutralLearnedPreferences());
  });

  it('migrates a legacy hero deterministically from its stable instance id', () => {
    expect(migrateLegacyPersonality('legacy-hero')).toEqual(migrateLegacyPersonality('legacy-hero'));
    expect(migrateLegacyPersonality('legacy-hero').identityId).toBe('personality:legacy-hero');
    expect(migrateLegacyPersonality('legacy-hero')).not.toEqual(migrateLegacyPersonality('other-hero'));
  });
});

describe('utility decisions', () => {
  const actor = unit();
  const enemy = unit({
    id: 'enemy:target',
    sourceId: 'enemy-target',
    side: 'enemies',
    class: 'Enemy',
    name: 'Target',
  });
  const state = combatState([actor, enemy]);

  it('scores only actions validated by the combat engine', () => {
    const healer = unit({ class: 'Healer', skillIds: ['mending-light'] });
    const healerState = combatState([healer, enemy]);
    const validActions = getAvailableActions(healerState, healer.id);
    const decision = decideCombatAction(healerState, context());

    expect(decision?.candidates.every((candidate) =>
      validActions.some((action) => JSON.stringify(action) === JSON.stringify(candidate.action)),
    )).toBe(true);
    expect(decision?.candidates).toHaveLength(validActions.length);
    expect(decision?.candidates.some((candidate) => candidate.action.skillId === 'mending-light')).toBe(false);
  });

  it('allows different personalities to choose different valid actions', () => {
    const aggressive = decideCombatAction(state, context({
      courage: 100,
      discipline: 100,
      aggression: 100,
      selfPreservation: 0,
    }, 'Aggressive'));
    const cautious = decideCombatAction(state, context({
      courage: 0,
      discipline: 100,
      aggression: 0,
      selfPreservation: 100,
    }, 'Defensive'));

    expect(aggressive?.selectedAction.type).not.toBe('defend');
    expect(cautious?.selectedAction.type).toBe('defend');
  });

  it('scales strategy alignment by discipline', () => {
    const offensiveAction = getAvailableActions(state).find((action) => action.type === 'basic-physical');
    expect(offensiveAction).toBeDefined();
    if (!offensiveAction) return;

    const disciplined = scoreCandidateAction(
      state,
      actor,
      offensiveAction,
      context({ discipline: 100 }, 'Aggressive'),
    );
    const undisciplined = scoreCandidateAction(
      state,
      actor,
      offensiveAction,
      context({ discipline: 0 }, 'Aggressive'),
    );

    expect(disciplined.teamStrategyContribution).toBe(15);
    expect(undisciplined.teamStrategyContribution).toBe(0);
  });

  it('breaks equal utility ties by a stable action key', () => {
    const first = decideCombatAction(state, context());
    const second = decideCombatAction(structuredClone(state), context());

    expect(first).toEqual(second);
    expect(first?.selectedAction.type).toBe('basic-magical');
    expect(first?.candidates[0].finalUtility).toBe(first?.candidates[1].finalUtility);
  });

  it('keeps the future learning contribution neutral and leaves combat state unchanged', () => {
    const before = structuredClone(state);
    const decision = decideCombatAction(state, context());

    expect(decision?.candidates.every((candidate) => candidate.learnedPreferenceContribution === 0)).toBe(true);
    expect(state).toEqual(before);
  });
});

describe('autonomous execution', () => {
  it('is reproducible and produces the same outcome through stepping and full execution', () => {
    const ally = unit({ currentHp: 160, stats: { ...unit().stats, maxHp: 160 } });
    const enemy = unit({
      id: 'enemy:target',
      sourceId: 'enemy-target',
      side: 'enemies',
      class: 'Enemy',
      name: 'Target',
      currentHp: 160,
      stats: { ...unit().stats, maxHp: 160 },
    });
    const initial = combatState([ally, enemy], [ally.id, enemy.id], 4);
    const resolveContext = (heroInstanceId: string) => createNeutralDecisionContext(heroInstanceId);

    let stepped = initial;
    const steppedDecisions: DecisionTrace[] = [];
    while (stepped.result.outcome === 'ongoing') {
      const result = stepAutonomousCombat(stepped, resolveContext);
      if (result.decision) steppedDecisions.push(result.decision);
      if (result.state === stepped) break;
      stepped = result.state;
    }
    const automatic = runAutonomousCombat(initial, resolveContext);
    const replay = runAutonomousCombat(structuredClone(initial), resolveContext);

    expect(automatic).toEqual(replay);
    expect(stepped).toEqual(automatic.state);
    expect(steppedDecisions).toEqual(automatic.decisions);
    expect(getCurrentActor(initial)?.id).toBe(ally.id);
  });
});
