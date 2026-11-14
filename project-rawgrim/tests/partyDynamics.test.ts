import { describe, expect, it } from 'vitest';
import { initialPartyFormation } from '../src/features/heroes/data/initialRoster.ts';
import { migrateLegacyPersonality } from '../src/features/heroes/domain/personality.ts';
import type { HeroInstance, PartyFormation } from '../src/features/heroes/domain/types.ts';
import { applyRelationshipEvent } from '../src/features/social/domain/relationshipEngine.ts';
import { createEmptyRelationshipProfile } from '../src/features/social/domain/relationshipProfile.ts';
import {
  calculateLeadershipEffectiveness,
  validateLeaderAssignment,
} from '../src/features/social/domain/leadership.ts';
import { evaluatePartyChemistry } from '../src/features/social/domain/partyChemistry.ts';
import type { RelationshipEvent } from '../src/features/social/domain/types.ts';

function hero(id: string, overrides: Partial<HeroInstance> = {}): HeroInstance {
  return {
    id, definitionId: 'valdris-ashen-blade', level: 10, experience: 0,
    currentHp: 100, status: 'Ready', personality: migrateLegacyPersonality(id),
    relationships: createEmptyRelationshipProfile(id), ...overrides,
  };
}

function formation(ids: readonly string[]): PartyFormation {
  return {
    frontline: [ids[0] ?? null, ids[1] ?? null, ids[2] ?? null],
    backline: [ids[3] ?? null, ids[4] ?? null],
  };
}

function relation(owner: HeroInstance, targetId: string, changes: RelationshipEvent['changes']): HeroInstance {
  const event: RelationshipEvent = {
    id: `${owner.id}-${targetId}`, sourceId: `${owner.id}-${targetId}`, type: 'shared-battle',
    ownerHeroId: owner.id, targetHeroId: targetId, sessionId: 'history', round: 1,
    changes, memoryIds: [], description: 'Observed history.', eventOrder: 1,
  };
  return { ...owner, relationships: applyRelationshipEvent(owner.relationships!, event) };
}

describe('party leadership', () => {
  it('accepts only living deployed leaders', () => {
    const deployed = hero('hero-a');
    const reserve = hero('hero-b');
    const dead = hero('hero-c', { status: 'Dead', currentHp: 0 });
    const party = formation(['hero-a', 'hero-c']);

    expect(validateLeaderAssignment('hero-a', [deployed, reserve, dead], party)).toEqual({ valid: true });
    expect(validateLeaderAssignment('hero-b', [deployed, reserve, dead], party).valid).toBe(false);
    expect(validateLeaderAssignment('hero-c', [deployed, reserve, dead], party).valid).toBe(false);
    expect(validateLeaderAssignment('missing', [deployed], party).valid).toBe(false);
  });

  it('raises effectiveness when teammates trust and respect the leader', () => {
    const leader = hero('hero-a');
    const neutral = hero('hero-b');
    const supportive = relation(hero('hero-b'), 'hero-a', { trust: 80, respect: 80 });
    const party = formation(['hero-a', 'hero-b']);
    const baseline = calculateLeadershipEffectiveness('hero-a', [leader, neutral], party);
    const improved = calculateLeadershipEffectiveness('hero-a', [leader, supportive], party);

    expect(improved.score).toBeGreaterThan(baseline.score);
    expect(improved.components.incomingTrust).toBeGreaterThan(baseline.components.incomingTrust);
    expect(improved.components.incomingRespect).toBeGreaterThan(baseline.components.incomingRespect);
    expect(improved.score).toBeLessThanOrEqual(100);
  });

  it('returns inactive leadership when the leader is dead or absent', () => {
    const dead = hero('hero-a', { status: 'Dead', currentHp: 0 });
    expect(calculateLeadershipEffectiveness('hero-a', [dead], formation(['hero-a'])).active).toBe(false);
    expect(calculateLeadershipEffectiveness(null, [hero('hero-a')], formation(['hero-a'])).score).toBe(0);
  });
});

describe('party chemistry', () => {
  it('detects higher cohesion and lower conflict for supportive relationships', () => {
    const a = relation(hero('hero-a'), 'hero-b', { trust: 80, respect: 70, affection: 50, familiarity: 80 });
    const b = relation(hero('hero-b'), 'hero-a', { trust: 80, respect: 70, affection: 50, familiarity: 80 });
    const hostileA = relation(hero('hostile-a'), 'hostile-b', { trust: -80, respect: -60, rivalry: 90, resentment: 90 });
    const hostileB = relation(hero('hostile-b'), 'hostile-a', { trust: -80, respect: -60, rivalry: 90, resentment: 90 });
    const supportive = evaluatePartyChemistry([a, b], formation(['hero-a', 'hero-b']), 'hero-a');
    const hostile = evaluatePartyChemistry([hostileA, hostileB], formation(['hostile-a', 'hostile-b']), 'hostile-a');

    expect(supportive.cohesion).toBeGreaterThan(hostile.cohesion);
    expect(supportive.conflictRisk).toBeLessThan(hostile.conflictRisk);
    expect(supportive.coordination).toBeGreaterThan(hostile.coordination);
  });

  it('is deterministic and finite for empty and single-hero parties', () => {
    const empty = evaluatePartyChemistry([], formation([]), null);
    const single = evaluatePartyChemistry([hero('hero-a')], formation(['hero-a']), 'hero-a');

    expect(empty).toEqual(evaluatePartyChemistry([], formation([]), null));
    expect([empty.cohesion, empty.coordination, empty.conflictRisk, empty.leadershipStability].every(Number.isFinite)).toBe(true);
    expect([single.cohesion, single.coordination, single.conflictRisk, single.leadershipStability].every(Number.isFinite)).toBe(true);
  });

  it('does not expose raw combat-stat bonuses', () => {
    const chemistry = evaluatePartyChemistry([hero('hero-a')], initialPartyFormation, null);
    expect('attackBonus' in chemistry).toBe(false);
    expect('defenseBonus' in chemistry).toBe(false);
  });
});
