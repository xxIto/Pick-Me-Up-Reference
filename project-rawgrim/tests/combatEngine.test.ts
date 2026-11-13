import { describe, expect, it } from 'vitest';
import {
  applyDefendReduction,
  calculateHealing,
  calculateMagicalDamage,
  calculatePhysicalDamage,
} from '../src/features/combat/domain/calculations.ts';
import {
  advanceTurn,
  getAvailableActions,
  resolveAction,
  runCombat,
  selectBasicAction,
  stepCombat,
} from '../src/features/combat/domain/combatEngine.ts';
import { buildTurnOrder, initializeCombat } from '../src/features/combat/domain/initialization.ts';
import { selectOffensiveTarget } from '../src/features/combat/domain/targeting.ts';
import type { CombatState, CombatUnit } from '../src/features/combat/domain/types.ts';
import { SANDBOX_ENEMIES } from '../src/features/combat/data/enemyDefinitions.ts';
import { heroDefinitions } from '../src/features/heroes/data/heroDefinitions.ts';
import { initialHeroRoster, initialPartyFormation } from '../src/features/heroes/data/initialRoster.ts';

function unit(overrides: Partial<CombatUnit>): CombatUnit {
  return {
    id: 'ally:a', sourceId: 'a', name: 'Ally', class: 'Warrior', side: 'allies',
    position: { line: 'frontline', index: 0 },
    stats: { maxHp: 100, attack: 50, magic: 40, defense: 25, resistance: 20, speed: 50 },
    currentHp: 100, alive: true, defending: false, cooldowns: {}, skillIds: ['power-strike'],
    initiativeTie: 0,
    ...overrides,
  };
}

function state(units: readonly CombatUnit[], order = units.map((entry) => entry.id), maxRounds = 10): CombatState {
  return {
    seed: 1, round: 1, maxRounds, units,
    turnOrder: { unitIds: order, currentIndex: 0 },
    events: [],
    result: { outcome: 'ongoing', completedRound: 0, winningSide: null },
  };
}

describe('combat initialization', () => {
  it('creates temporary combat units without mutating persistent heroes', () => {
    const snapshot = structuredClone(initialHeroRoster);
    const combat = initializeCombat(
      initialHeroRoster, initialPartyFormation, heroDefinitions, SANDBOX_ENEMIES, { seed: 42 },
    );

    expect(combat.units).toHaveLength(10);
    expect(combat.units[0].id).toContain('ally:');
    expect(initialHeroRoster).toEqual(snapshot);
  });

  it('rejects duplicate and dead deployed hero instances', () => {
    expect(() => initializeCombat(
      initialHeroRoster,
      { frontline: ['hero-valdris-001', 'hero-valdris-001', null], backline: [null, null] },
      heroDefinitions, SANDBOX_ENEMIES, { seed: 1 },
    )).toThrow('Duplicate hero instances');
    expect(() => initializeCombat(
      initialHeroRoster,
      { frontline: ['hero-sable-001', null, null], backline: [null, null] },
      heroDefinitions, SANDBOX_ENEMIES, { seed: 1 },
    )).toThrow('Dead hero');
  });
});

describe('turn order', () => {
  it('sorts by speed and resolves speed ties deterministically', () => {
    const slow = unit({ id: 'ally:slow', stats: { ...unit({}).stats, speed: 20 }, initiativeTie: 0 });
    const tiedB = unit({ id: 'ally:b', stats: { ...unit({}).stats, speed: 60 }, initiativeTie: 0.8 });
    const tiedA = unit({ id: 'ally:a', stats: { ...unit({}).stats, speed: 60 }, initiativeTie: 0.2 });

    expect(buildTurnOrder([slow, tiedB, tiedA])).toEqual(['ally:a', 'ally:b', 'ally:slow']);
  });

  it('skips units that died before their turn', () => {
    const first = unit({ id: 'ally:first' });
    const dead = unit({ id: 'enemy:dead', side: 'enemies', alive: false, currentHp: 0 });
    const third = unit({ id: 'enemy:third', side: 'enemies' });

    expect(advanceTurn(state([first, dead, third], [first.id, dead.id, third.id])).turnOrder.currentIndex).toBe(2);
  });
});

describe('combat calculations', () => {
  it('uses floor rounding and the temporary physical and magical formulas', () => {
    expect(calculatePhysicalDamage({ attack: 100 }, { defense: 100 }, 1.5)).toBe(75);
    expect(calculateMagicalDamage({ magic: 90 }, { resistance: 50 }, 1)).toBe(60);
    expect(calculateHealing({ magic: 81 }, 1.2)).toBe(97);
  });

  it('halves defended damage with a minimum of one', () => {
    expect(applyDefendReduction(25, true)).toBe(12);
    expect(applyDefendReduction(1, true)).toBe(1);
  });
});

describe('actions and targeting', () => {
  it('prioritizes living frontline enemies', () => {
    const actor = unit({ id: 'ally:actor' });
    const backline = unit({ id: 'enemy:back', side: 'enemies', position: { line: 'backline', index: 0 } });
    const frontline = unit({ id: 'enemy:front', side: 'enemies', position: { line: 'frontline', index: 2 } });

    expect(selectOffensiveTarget(state([actor, backline, frontline]), actor).targetId).toBe(frontline.id);
  });

  it('rejects invalid friendly-fire actions without changing state', () => {
    const actor = unit({ id: 'ally:actor' });
    const ally = unit({ id: 'ally:target' });
    const before = state([actor, ally]);
    const result = resolveAction(before, { actorId: actor.id, type: 'basic-physical', targetId: ally.id });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(before);
  });

  it('caps healing at maximum HP and starts skill cooldown', () => {
    const healer = unit({ id: 'ally:healer', class: 'Healer', skillIds: ['mending-light'], stats: { ...unit({}).stats, magic: 80 } });
    const wounded = unit({ id: 'ally:wounded', currentHp: 90 });
    const enemy = unit({ id: 'enemy:a', side: 'enemies' });
    const result = resolveAction(
      state([healer, wounded, enemy]),
      { actorId: healer.id, type: 'skill', targetId: wounded.id, skillId: 'mending-light' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.units.find((entry) => entry.id === wounded.id)?.currentHp).toBe(100);
    expect(result.state.units.find((entry) => entry.id === healer.id)?.cooldowns['mending-light']).toBe(2);
  });

  it('makes a skill available again after two owner turns', () => {
    const actor = unit({ id: 'ally:actor', currentHp: 300, stats: { ...unit({}).stats, maxHp: 300 } });
    const enemy = unit({ id: 'enemy:a', side: 'enemies', currentHp: 300, stats: { ...unit({}).stats, maxHp: 300 } });
    const used = resolveAction(
      state([actor, enemy], [actor.id, enemy.id]),
      { actorId: actor.id, type: 'skill', targetId: enemy.id, skillId: 'power-strike' },
    );
    expect(used.ok).toBe(true);
    if (!used.ok) return;

    let current = advanceTurn(used.state);
    const enemyFirst = resolveAction(current, { actorId: enemy.id, type: 'basic-physical', targetId: actor.id });
    expect(enemyFirst.ok).toBe(true);
    if (!enemyFirst.ok) return;
    current = advanceTurn(enemyFirst.state);
    expect(getAvailableActions(current).some((action) => action.skillId === 'power-strike')).toBe(false);

    const actorBasic = resolveAction(current, { actorId: actor.id, type: 'basic-physical', targetId: enemy.id });
    expect(actorBasic.ok).toBe(true);
    if (!actorBasic.ok) return;
    current = advanceTurn(actorBasic.state);
    const enemySecond = resolveAction(current, { actorId: enemy.id, type: 'basic-physical', targetId: actor.id });
    expect(enemySecond.ok).toBe(true);
    if (!enemySecond.ok) return;
    current = advanceTurn(enemySecond.state);
    expect(getAvailableActions(current).some((action) => action.skillId === 'power-strike')).toBe(true);
  });

  it('keeps defend active through incoming damage and clears it on the next action', () => {
    const defender = unit({ id: 'ally:defender' });
    const enemy = unit({ id: 'enemy:attacker', side: 'enemies' });
    const defended = resolveAction(
      state([defender, enemy], [defender.id, enemy.id]),
      { actorId: defender.id, type: 'defend', targetId: defender.id },
    );
    expect(defended.ok).toBe(true);
    if (!defended.ok) return;
    const enemyTurn = advanceTurn(defended.state);
    const attacked = resolveAction(
      enemyTurn,
      { actorId: enemy.id, type: 'basic-physical', targetId: defender.id },
    );
    expect(attacked.ok).toBe(true);
    if (!attacked.ok) return;
    expect(attacked.state.units.find((entry) => entry.id === defender.id)?.defending).toBe(true);
    const defenderTurn = advanceTurn(attacked.state);
    const acted = resolveAction(
      defenderTurn,
      { actorId: defender.id, type: 'basic-physical', targetId: enemy.id },
    );
    expect(acted.ok && acted.state.units.find((entry) => entry.id === defender.id)?.defending).toBe(false);
  });
});

describe('combat outcomes and runner', () => {
  it('detects victory and defeat', () => {
    const ally = unit({ id: 'ally:a', stats: { ...unit({}).stats, attack: 500 } });
    const enemy = unit({ id: 'enemy:a', side: 'enemies', currentHp: 1 });
    const victory = resolveAction(state([ally, enemy]), {
      actorId: ally.id, type: 'basic-physical', targetId: enemy.id,
    });
    expect(victory.ok && victory.state.result.outcome).toBe('victory');

    const fragileAlly = unit({ id: 'ally:fragile', currentHp: 1 });
    const strongEnemy = unit({ id: 'enemy:strong', side: 'enemies', stats: { ...unit({}).stats, attack: 500 } });
    const defeat = resolveAction(state([fragileAlly, strongEnemy], [strongEnemy.id, fragileAlly.id]), {
      actorId: strongEnemy.id, type: 'basic-physical', targetId: fragileAlly.id,
    });
    expect(defeat.ok && defeat.state.result.outcome).toBe('defeat');
  });

  it('ends at the configured round limit as a draw', () => {
    const ally = unit({ id: 'ally:a', stats: { ...unit({}).stats, attack: 1 } });
    const enemy = unit({ id: 'enemy:a', side: 'enemies', stats: { ...unit({}).stats, attack: 1 } });
    expect(runCombat(state([ally, enemy], [ally.id, enemy.id], 1)).result.outcome).toBe('draw');
  });

  it('replays identical results from an identical seed', () => {
    const create = () => initializeCombat(
      initialHeroRoster, initialPartyFormation, heroDefinitions, SANDBOX_ENEMIES, { seed: 99, maxRounds: 20 },
    );
    expect(runCombat(create())).toEqual(runCombat(create()));
  });

  it('produces the same result through stepping and full execution', () => {
    const initial = initializeCombat(
      initialHeroRoster, initialPartyFormation, heroDefinitions, SANDBOX_ENEMIES, { seed: 7, maxRounds: 20 },
    );
    let stepped = initial;
    while (stepped.result.outcome === 'ongoing') stepped = stepCombat(stepped);
    const automatic = runCombat(initial);

    expect(stepped.result).toEqual(automatic.result);
    expect(stepped.units).toEqual(automatic.units);
    expect(selectBasicAction(initial)).not.toBeNull();
  });
});
