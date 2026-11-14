import { describe, expect, it } from 'vitest';
import { decideCombatAction } from '../src/features/ai/domain/utilityAI.ts';
import { runAutonomousCombat, stepAutonomousCombat } from '../src/features/ai/domain/autonomousCombat.ts';
import type { DecisionTrace } from '../src/features/ai/domain/types.ts';
import type { CombatState, CombatUnit } from '../src/features/combat/domain/types.ts';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';
import { applyRelationshipEvent } from '../src/features/social/domain/relationshipEngine.ts';
import { createEmptyRelationshipProfile } from '../src/features/social/domain/relationshipProfile.ts';
import type { RelationshipEvent, SocialDecisionContext } from '../src/features/social/domain/types.ts';
import { createEmptyMemoryProfile } from '../src/features/memory/domain/memoryProfile.ts';
import type { EpisodicMemory } from '../src/features/memory/domain/types.ts';

function unit(id: string, overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: `ally:${id}`, sourceId: id, name: id, class: 'Healer', side: 'allies',
    position: { line: 'backline', index: 0 },
    stats: { maxHp: 100, attack: 30, magic: 60, defense: 20, resistance: 20, speed: 50 },
    currentHp: 100, alive: true, defending: false, cooldowns: {}, skillIds: ['mending-light'], initiativeTie: 0,
    ...overrides,
  };
}

function state(): CombatState {
  const actor = unit('hero-healer');
  const neutral = unit('ally-a', { currentHp: 20, skillIds: [] });
  const trusted = unit('ally-z', { currentHp: 20, skillIds: [] });
  const enemy = unit('enemy', {
    id: 'enemy:one', sourceId: 'ash-hound', class: 'Enemy', side: 'enemies',
    position: { line: 'frontline', index: 0 }, skillIds: [],
  });
  return {
    seed: 1, round: 1, maxRounds: 5, units: [actor, neutral, trusted, enemy],
    turnOrder: { unitIds: [actor.id, neutral.id, trusted.id, enemy.id], currentIndex: 0 },
    events: [], result: { outcome: 'ongoing', completedRound: 0, winningSide: null },
  };
}

function relationshipContext(changes: RelationshipEvent['changes']): SocialDecisionContext {
  const event: RelationshipEvent = {
    id: 'history', sourceId: 'history', type: 'meaningful-rescue', ownerHeroId: 'hero-healer',
    targetHeroId: 'ally-z', sessionId: 'old-battle', round: 1, changes,
    memoryIds: [], description: 'Observed relationship history.', eventOrder: 1,
  };
  return {
    actorRelationshipProfile: applyRelationshipEvent(createEmptyRelationshipProfile('hero-healer'), event),
    leaderId: null,
    leadership: { active: false, leaderId: null, score: 0, components: { discipline: 0, courage: 0, resolve: 0, experience: 0, incomingTrust: 0, incomingRespect: 0 }, explanations: [] },
    chemistry: { cohesion: 50, coordination: 50, conflictRisk: 0, leadershipStability: 0, explanations: [] },
  };
}

describe('social utility integration', () => {
  it('prioritizes an equally endangered trusted ally through a bounded relationship contribution', () => {
    const personality = migrateLegacyPersonality('hero-healer');
    const baseline = decideCombatAction(state(), { personality, teamStrategy: 'Balanced' });
    const influenced = decideCombatAction(state(), {
      personality, teamStrategy: 'Balanced', social: relationshipContext({ trust: 100, affection: 100 }),
    });
    const trusted = influenced?.candidates.find((candidate) => candidate.action.targetId === 'ally:ally-z');

    expect(baseline?.selectedTargetId).toBe('ally:ally-a');
    expect(influenced?.selectedTargetId).toBe('ally:ally-z');
    expect(influenced?.socialChangedSelection).toBe(true);
    expect(trusted?.relationshipContribution).toBeGreaterThan(0);
    expect(Math.abs(trusted?.relationshipContribution ?? 0)).toBeLessThanOrEqual(8);
  });

  it('reduces healing preference toward a resented ally without bypassing action validity', () => {
    const personality = migrateLegacyPersonality('hero-healer');
    const decision = decideCombatAction(state(), {
      personality, teamStrategy: 'Balanced', social: relationshipContext({ resentment: 100 }),
    });
    const resented = decision?.candidates.find((candidate) => candidate.action.targetId === 'ally:ally-z');

    expect(resented?.relationshipContribution).toBeLessThan(0);
    expect(decision?.candidates.every((candidate) => state().units.some((unit) => unit.id === candidate.action.targetId))).toBe(true);
  });

  it('scales leadership strategy adherence by discipline and remains bounded', () => {
    const high = migrateLegacyPersonality('hero-healer');
    high.innate.discipline = 100;
    const low = structuredClone(high);
    low.innate.discipline = 0;
    const social = relationshipContext({ trust: 100 });
    social.leaderId = 'ally-z';
    social.leadership = { ...social.leadership, active: true, leaderId: 'ally-z', score: 100 };
    social.chemistry = { ...social.chemistry, coordination: 100, leadershipStability: 100 };
    const highDecision = decideCombatAction(state(), { personality: high, teamStrategy: 'Defensive', social });
    const lowDecision = decideCombatAction(state(), { personality: low, teamStrategy: 'Defensive', social });
    const highDefend = highDecision?.candidates.find((candidate) => candidate.action.type === 'defend');
    const lowDefend = lowDecision?.candidates.find((candidate) => candidate.action.type === 'defend');

    expect(highDefend?.leadershipContribution).toBeGreaterThan(lowDefend?.leadershipContribution ?? 0);
    expect(lowDefend?.leadershipContribution).toBe(0);
    expect(Math.abs(highDefend?.leadershipContribution ?? 0)).toBeLessThanOrEqual(10);
  });

  it('disables leadership influence when the assigned leader falls during combat', () => {
    const combat = state();
    const leader = combat.units.find((unit) => unit.sourceId === 'ally-z')!;
    const fallenState = {
      ...combat,
      units: combat.units.map((unit) => unit.id === leader.id ? { ...unit, currentHp: 0, alive: false } : unit),
    };
    const personality = migrateLegacyPersonality('hero-healer');
    personality.innate.discipline = 100;
    const social = relationshipContext({ trust: 100 });
    social.leaderId = 'ally-z';
    social.leadership = { ...social.leadership, active: true, leaderId: 'ally-z', score: 100 };
    social.chemistry = { ...social.chemistry, coordination: 100 };
    const decision = decideCombatAction(fallenState, { personality, teamStrategy: 'Defensive', social });

    expect(decision?.candidates.every((candidate) => candidate.leadershipContribution === 0)).toBe(true);
    expect(decision?.socialExplanations).toContain('Assigned leader is unavailable in current combat.');
  });

  it('halves relationship utility when the same target-linked Social memory is recalled', () => {
    const personality = migrateLegacyPersonality('hero-healer');
    const social = relationshipContext({ trust: 100, affection: 100 });
    const socialMemory: EpisodicMemory = {
      id: 'memory-rescue', ownerHeroId: 'hero-healer', sourceId: 'old-battle:rescue',
      category: 'Social', title: 'Rescued ally-z', description: 'Observed meaningful healing.',
      participantIds: ['ally-z'],
      context: {
        sessionId: 'old-battle', round: 1, enemyCategoryIds: ['ash-hound'],
        combatOutcome: 'victory', threatLevel: 0.8,
      },
      facts: { healingAmount: 35, targetHeroId: 'ally-z', targetEliminated: false, enemyCategoryIds: ['ash-hound'] },
      significance: { score: 80, severity: 0.9, personalRisk: 0, novelty: 1, outcomeImportance: 1, relevance: 1 },
      eventOrder: 1, relatedMemoryIds: [],
    };
    const memoryProfile = { ...createEmptyMemoryProfile('hero-healer'), memories: [socialMemory] };
    const withoutMemory = decideCombatAction(state(), { personality, teamStrategy: 'Balanced', social });
    const withMemory = decideCombatAction(state(), { personality, teamStrategy: 'Balanced', social, memoryProfile });
    const withoutTarget = withoutMemory?.candidates.find((candidate) => candidate.action.targetId === 'ally:ally-z');
    const withTarget = withMemory?.candidates.find((candidate) => candidate.action.targetId === 'ally:ally-z');

    expect(withTarget?.relationshipContribution).toBe((withoutTarget?.relationshipContribution ?? 0) / 2);
  });

  it('does not mutate personality, relationships, or combat state during evaluation', () => {
    const combat = state();
    const personality = migrateLegacyPersonality('hero-healer');
    const social = relationshipContext({ trust: 80 });
    const snapshot = structuredClone({ combat, personality, social });

    const first = decideCombatAction(combat, { personality, teamStrategy: 'Balanced', social });
    const second = decideCombatAction(structuredClone(combat), {
      personality: structuredClone(personality), teamStrategy: 'Balanced', social: structuredClone(social),
    });

    expect(first).toEqual(second);
    expect({ combat, personality, social }).toEqual(snapshot);
  });

  it('keeps step-by-step and Auto Resolve equivalent with social context', () => {
    const initial = state();
    const social = relationshipContext({ trust: 80, affection: 40 });
    const resolve = (heroId: string) => ({
      personality: migrateLegacyPersonality(heroId),
      teamStrategy: 'Balanced' as const,
      ...(heroId === 'hero-healer' ? { social } : {}),
    });
    let stepped = initial;
    const decisions: DecisionTrace[] = [];
    while (stepped.result.outcome === 'ongoing') {
      const result = stepAutonomousCombat(stepped, resolve);
      if (result.decision) decisions.push(result.decision);
      if (result.state === stepped) break;
      stepped = result.state;
    }
    const automatic = runAutonomousCombat(initial, resolve);

    expect(stepped).toEqual(automatic.state);
    expect(decisions).toEqual(automatic.decisions);
  });
});
