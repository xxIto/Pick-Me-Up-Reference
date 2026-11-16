import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';
import { initialHeroRoster, initialPartyFormation } from '../src/features/heroes/data/initialRoster.ts';
import { initializeCombat } from '../src/features/combat/domain/initialization.ts';
import { SANDBOX_ENEMIES } from '../src/features/combat/data/enemyDefinitions.ts';
import type { CombatState } from '../src/features/combat/domain/types.ts';
import type { CombatExperience } from '../src/features/learning/domain/types.ts';
import type { OfficialDeathResolutionRequest } from '../src/features/legacy/domain/types.ts';
import { resolveAuthorizedPermadeath } from '../src/features/legacy/domain/deathResolution.ts';

function finalizedState(fallenHeroIds: readonly string[]): CombatState {
  const initial = initializeCombat(
    initialHeroRoster,
    initialPartyFormation,
    heroDefinitions,
    SANDBOX_ENEMIES,
    { seed: 42 },
  );
  return {
    ...initial,
    round: 5,
    units: initial.units.map((unit) => fallenHeroIds.includes(unit.sourceId)
      ? { ...unit, currentHp: 0, alive: false }
      : unit.side === 'enemies' ? { ...unit, currentHp: 0, alive: false } : unit),
    events: [
      ...initial.events,
      ...fallenHeroIds.flatMap((heroId, index) => [
        {
          sequence: initial.events.length + index * 2 + 1,
          round: 5,
          type: 'damage' as const,
          actorId: 'enemy:ash-hound-a',
          targetId: `ally:${heroId}`,
          amount: 100,
          damageType: 'physical' as const,
          message: 'Observed final damage.',
        },
        {
          sequence: initial.events.length + index * 2 + 2,
          round: 5,
          type: 'defeated' as const,
          actorId: 'enemy:ash-hound-a',
          targetId: `ally:${heroId}`,
          message: 'Hero was defeated.',
        },
      ]),
      { sequence: 99, round: 5, type: 'battle-ended', message: 'Battle ended.' },
    ],
    result: { outcome: 'victory', completedRound: 5, winningSide: 'allies' },
  };
}

function request(fallenHeroIds: readonly string[] = ['hero-valdris-001']): OfficialDeathResolutionRequest {
  const finalState = finalizedState(fallenHeroIds);
  const experience: CombatExperience = {
    sessionId: 'battle-official-1', outcome: 'victory', observations: [], eligibleForLearning: true,
  };
  return {
    authorization: 'official-expedition',
    finalized: true,
    expeditionId: 'expedition-1',
    battleId: experience.sessionId,
    resolutionId: 'resolution-1',
    encounterId: 'tower-floor-1',
    encounterLabel: 'Goblin Patrol',
    rulesVersion: 'combat-v1',
    participantHeroIds: initialPartyFormation.frontline.concat(initialPartyFormation.backline)
      .filter((id): id is string => id !== null),
    leaderIdSnapshot: 'hero-valdris-001',
    finalState,
    experience,
  };
}

function currentState() {
  return {
    roster: structuredClone(initialHeroRoster),
    formation: structuredClone(initialPartyFormation),
    leaderId: 'hero-valdris-001',
    memorials: [],
    processedLegacyResolutionIds: [],
  };
}

describe('authorized permanent-death resolution', () => {
  it('rejects sandbox authorization and leaves the supplied state untouched', () => {
    const current = currentState();
    const snapshot = structuredClone(current);
    const invalid = { ...request(), authorization: 'sandbox' } as unknown as OfficialDeathResolutionRequest;

    const result = resolveAuthorizedPermadeath(current, invalid, heroDefinitions);

    expect(result.ok).toBe(false);
    expect(current).toEqual(snapshot);
  });

  it('archives confirmed fallen identities and clears formation and leadership in one proposal', () => {
    const current = currentState();
    const snapshot = structuredClone(current);
    const result = resolveAuthorizedPermadeath(current, request(), heroDefinitions);

    expect(result.ok).toBe(true);
    if (!result.ok || result.duplicate) throw new Error('Expected a new proposal');
    expect(result.state.roster.some((hero) => hero.id === 'hero-valdris-001')).toBe(false);
    expect(result.state.memorials[0]?.heroInstanceId).toBe('hero-valdris-001');
    expect(result.state.memorials[0]?.deathContext.attackerSourceId).toBe('ash-hound-a');
    expect(result.state.formation.frontline[0]).toBeNull();
    expect(result.state.leaderId).toBeNull();
    expect(result.state.processedLegacyResolutionIds).toEqual(['resolution-1']);
    expect(current).toEqual(snapshot);
  });

  it('is idempotent and does not duplicate survivor effects or memorials', () => {
    const first = resolveAuthorizedPermadeath(currentState(), request(), heroDefinitions);
    if (!first.ok || first.duplicate) throw new Error('Expected a new proposal');
    const survivor = first.state.roster.find((hero) => hero.id === 'hero-garran-001')!;
    const experienceCount = survivor.survivorConsequences?.experiences.length;

    const duplicate = resolveAuthorizedPermadeath(first.state, request(), heroDefinitions);

    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) throw new Error('Expected duplicate success');
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.state).toBe(first.state);
    expect(duplicate.state.memorials).toHaveLength(1);
    expect(duplicate.state.roster.find((hero) => hero.id === 'hero-garran-001')
      ?.survivorConsequences?.experiences).toHaveLength(experienceCount);
  });

  it('does not let an invalid authorization bypass validation by reusing a processed ID', () => {
    const first = resolveAuthorizedPermadeath(currentState(), request(), heroDefinitions);
    if (!first.ok || first.duplicate) throw new Error('Expected a new proposal');
    const forgedDuplicate = {
      ...request(),
      authorization: 'sandbox',
    } as unknown as OfficialDeathResolutionRequest;

    const result = resolveAuthorizedPermadeath(first.state, forgedDuplicate, heroDefinitions);

    expect(result.ok).toBe(false);
  });

  it('handles multiple deaths independent of fallen-id ordering and clears every reference', () => {
    const fallen = ['hero-valdris-001', 'hero-garran-001'];
    const first = resolveAuthorizedPermadeath(currentState(), request(fallen), heroDefinitions);
    const secondRequest = request([...fallen].reverse());
    const second = resolveAuthorizedPermadeath(currentState(), secondRequest, heroDefinitions);
    if (!first.ok || first.duplicate || !second.ok || second.duplicate) throw new Error('Expected proposals');

    expect(first.state.roster.map((hero) => hero.id)).toEqual(second.state.roster.map((hero) => hero.id));
    expect(first.state.memorials.map((entry) => entry.heroInstanceId).sort())
      .toEqual(['hero-garran-001', 'hero-valdris-001']);
    expect(first.state.formation.frontline.slice(0, 2)).toEqual([null, null]);
    expect(first.state.roster[0]?.personality?.emotion).toEqual(second.state.roster[0]?.personality?.emotion);
  });

  it('rejects mismatched participant identities before creating a proposal', () => {
    const invalid = request();
    const result = resolveAuthorizedPermadeath(currentState(), {
      ...invalid,
      participantHeroIds: [...invalid.participantHeroIds, 'hero-not-committed'],
    }, heroDefinitions);

    expect(result.ok).toBe(false);
  });

  it('rejects a missing hero definition without mutating or throwing', () => {
    const current = currentState();
    const snapshot = structuredClone(current);
    const incompleteDefinitions = heroDefinitions.filter((entry) =>
      entry.id !== current.roster[0]?.definitionId);

    const result = resolveAuthorizedPermadeath(current, request(), incompleteDefinitions);

    expect(result.ok).toBe(false);
    expect(current).toEqual(snapshot);
  });
});
