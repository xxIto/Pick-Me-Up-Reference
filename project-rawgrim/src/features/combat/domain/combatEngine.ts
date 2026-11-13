import { getCombatSkill } from '../data/combatSkills.ts';
import {
  applyDefendReduction,
  calculateHealing,
  calculateMagicalDamage,
  calculatePhysicalDamage,
} from './calculations.ts';
import { buildTurnOrder } from './initialization.ts';
import { selectHealingTarget, selectOffensiveTarget } from './targeting.ts';
import type {
  ActionResolution,
  CombatAction,
  CombatEvent,
  CombatOutcome,
  CombatResult,
  CombatSkill,
  CombatState,
  CombatUnit,
} from './types.ts';

function getUnit(state: CombatState, unitId: string): CombatUnit | null {
  return state.units.find((unit) => unit.id === unitId) ?? null;
}

export function getCurrentActor(state: CombatState): CombatUnit | null {
  const actorId = state.turnOrder.unitIds[state.turnOrder.currentIndex];
  return actorId ? getUnit(state, actorId) : null;
}

function withUpdatedUnit(
  units: readonly CombatUnit[],
  unitId: string,
  update: (unit: CombatUnit) => CombatUnit,
): CombatUnit[] {
  return units.map((unit) => unit.id === unitId ? update(unit) : unit);
}

function appendEvents(state: CombatState, events: readonly Omit<CombatEvent, 'sequence'>[]): CombatEvent[] {
  let sequence = state.events.length;
  return [
    ...state.events,
    ...events.map((event) => ({ ...event, sequence: ++sequence })),
  ];
}

function determineResult(units: readonly CombatUnit[], round: number): CombatResult {
  const alliesAlive = units.some((unit) => unit.side === 'allies' && unit.alive);
  const enemiesAlive = units.some((unit) => unit.side === 'enemies' && unit.alive);
  if (!alliesAlive && !enemiesAlive) return { outcome: 'draw', completedRound: round, winningSide: null };
  if (!enemiesAlive) return { outcome: 'victory', completedRound: round, winningSide: 'allies' };
  if (!alliesAlive) return { outcome: 'defeat', completedRound: round, winningSide: 'enemies' };
  return { outcome: 'ongoing', completedRound: 0, winningSide: null };
}

function resultEvent(result: CombatResult, round: number): Omit<CombatEvent, 'sequence'> | null {
  if (result.outcome === 'ongoing') return null;
  const label = result.outcome === 'victory' ? 'Allies are victorious.'
    : result.outcome === 'defeat' ? 'The allied party was defeated.'
    : 'Battle ended in a draw.';
  return { round, type: 'battle-ended', message: label };
}

function validateTarget(
  actor: CombatUnit,
  target: CombatUnit | null,
  expected: 'enemy' | 'ally' | 'self',
): string | null {
  if (!target) return 'Target does not exist';
  if (!target.alive) return 'Dead units cannot be targeted';
  if (expected === 'enemy' && target.side === actor.side) return 'Offensive actions require an enemy target';
  if (expected === 'ally' && target.side !== actor.side) return 'Healing requires an allied target';
  if (expected === 'self' && target.id !== actor.id) return 'Defend must target the actor';
  return null;
}

export function getAvailableActions(state: CombatState, actorId?: string): CombatAction[] {
  if (state.result.outcome !== 'ongoing') return [];
  const actor = actorId ? getUnit(state, actorId) : getCurrentActor(state);
  if (!actor?.alive) return [];

  const offensive = selectOffensiveTarget(state, actor);
  const healing = selectHealingTarget(state, actor);
  const actions: CombatAction[] = [{ actorId: actor.id, type: 'defend', targetId: actor.id }];
  if (offensive.targetId) {
    actions.push(
      { actorId: actor.id, type: 'basic-physical', targetId: offensive.targetId },
      { actorId: actor.id, type: 'basic-magical', targetId: offensive.targetId },
    );
  }

  for (const skillId of actor.skillIds) {
    const skill = getCombatSkill(skillId);
    if (!skill || (actor.cooldowns[skill.id] ?? 0) > 0) continue;
    const targetId = skill.target === 'ally' ? healing.targetId
      : skill.target === 'self' ? actor.id
      : offensive.targetId;
    if (targetId) actions.push({ actorId: actor.id, type: 'skill', targetId, skillId: skill.id });
  }
  return actions;
}

export function selectBasicAction(state: CombatState): CombatAction | null {
  const actor = getCurrentActor(state);
  if (!actor?.alive) return null;

  const healingTarget = selectHealingTarget(state, actor);
  const healingSkill = actor.skillIds
    .map(getCombatSkill)
    .find((skill) => skill?.kind === 'healing' && (actor.cooldowns[skill.id] ?? 0) === 0);
  if (healingSkill && healingTarget.targetId) {
    return { actorId: actor.id, type: 'skill', targetId: healingTarget.targetId, skillId: healingSkill.id };
  }

  if (actor.class === 'Tank' && actor.currentHp / actor.stats.maxHp <= 0.5 && !actor.defending) {
    return { actorId: actor.id, type: 'defend', targetId: actor.id };
  }

  const offensiveTarget = selectOffensiveTarget(state, actor);
  if (!offensiveTarget.targetId) return null;
  const offensiveSkill = actor.skillIds
    .map(getCombatSkill)
    .find((skill) => skill && skill.kind !== 'healing' && (actor.cooldowns[skill.id] ?? 0) === 0);
  if (offensiveSkill) {
    return { actorId: actor.id, type: 'skill', targetId: offensiveTarget.targetId, skillId: offensiveSkill.id };
  }
  return {
    actorId: actor.id,
    type: actor.stats.magic > actor.stats.attack ? 'basic-magical' : 'basic-physical',
    targetId: offensiveTarget.targetId,
  };
}

export function resolveAction(state: CombatState, action: CombatAction): ActionResolution {
  if (state.result.outcome !== 'ongoing') return { ok: false, error: 'Combat has already ended', state };
  const actor = getUnit(state, action.actorId);
  const currentActor = getCurrentActor(state);
  if (!actor?.alive) return { ok: false, error: 'Actor must be alive', state };
  if (currentActor?.id !== actor.id) return { ok: false, error: 'Actor does not have the current turn', state };
  const target = getUnit(state, action.targetId);

  let expectedTarget: 'enemy' | 'ally' | 'self' = 'enemy';
  let skill: CombatSkill | null = null;
  if (action.type === 'defend') expectedTarget = 'self';
  if (action.type === 'skill') {
    if (!action.skillId || !actor.skillIds.includes(action.skillId)) {
      return { ok: false, error: 'Actor does not know this skill', state };
    }
    skill = getCombatSkill(action.skillId);
    if (!skill) return { ok: false, error: 'Combat skill does not exist', state };
    if ((actor.cooldowns[skill.id] ?? 0) > 0) return { ok: false, error: 'Skill is on cooldown', state };
    expectedTarget = skill.target;
  }
  const targetError = validateTarget(actor, target, expectedTarget);
  if (targetError || !target) return { ok: false, error: targetError ?? 'Invalid target', state };
  if (skill?.kind === 'healing' && target.currentHp >= target.stats.maxHp) {
    return { ok: false, error: 'Healing target is already at full health', state };
  }

  let units = withUpdatedUnit(state.units, actor.id, (unit) => ({ ...unit, defending: false }));
  const events: Array<Omit<CombatEvent, 'sequence'>> = [];

  if (action.type === 'defend') {
    units = withUpdatedUnit(units, actor.id, (unit) => ({ ...unit, defending: true }));
    events.push({
      round: state.round, type: 'defend', actorId: actor.id, targetId: actor.id,
      message: `${actor.name} defends until their next action.`,
    });
  } else if (skill?.kind === 'healing') {
    const calculated = calculateHealing(actor.stats, skill.multiplier);
    const amount = Math.min(calculated, target.stats.maxHp - target.currentHp);
    units = withUpdatedUnit(units, target.id, (unit) => ({ ...unit, currentHp: unit.currentHp + amount }));
    events.push({
      round: state.round, type: 'healing', actorId: actor.id, targetId: target.id,
      skillId: skill.id, amount, message: `${actor.name} restored ${amount} HP to ${target.name}.`,
    });
  } else {
    const damageType = action.type === 'basic-magical' || skill?.kind === 'magical' ? 'magical' : 'physical';
    const multiplier = skill?.multiplier ?? 1;
    const rawDamage = damageType === 'magical'
      ? calculateMagicalDamage(actor.stats, target.stats, multiplier)
      : calculatePhysicalDamage(actor.stats, target.stats, multiplier);
    const reducedDamage = applyDefendReduction(rawDamage, target.defending);
    const amount = Math.min(reducedDamage, target.currentHp);
    const remainingHp = target.currentHp - amount;
    units = withUpdatedUnit(units, target.id, (unit) => ({
      ...unit,
      currentHp: remainingHp,
      alive: remainingHp > 0,
      defending: remainingHp > 0 ? unit.defending : false,
    }));
    events.push({
      round: state.round, type: 'damage', actorId: actor.id, targetId: target.id,
      skillId: skill?.id, amount,
      message: `${actor.name} dealt ${amount} ${damageType} damage to ${target.name}.`,
    });
    if (remainingHp === 0) {
      events.push({
        round: state.round, type: 'defeated', actorId: actor.id, targetId: target.id,
        message: `${target.name} was defeated.`,
      });
    }
  }

  if (skill) {
    units = withUpdatedUnit(units, actor.id, (unit) => ({
      ...unit,
      cooldowns: { ...unit.cooldowns, [skill.id]: skill.cooldown },
    }));
  }

  const result = determineResult(units, state.round);
  const ended = resultEvent(result, state.round);
  if (ended) events.push(ended);
  return {
    ok: true,
    state: {
      ...state,
      units,
      events: appendEvents(state, events),
      result,
    },
  };
}

function prepareActorCooldowns(units: readonly CombatUnit[], actorId: string): CombatUnit[] {
  return withUpdatedUnit(units, actorId, (unit) => ({
    ...unit,
    cooldowns: Object.fromEntries(
      Object.entries(unit.cooldowns).map(([skillId, remaining]) => [skillId, Math.max(0, remaining - 1)]),
    ),
  }));
}

export function advanceTurn(state: CombatState): CombatState {
  if (state.result.outcome !== 'ongoing') return state;

  for (let index = state.turnOrder.currentIndex + 1; index < state.turnOrder.unitIds.length; index += 1) {
    const unit = getUnit(state, state.turnOrder.unitIds[index]);
    if (unit?.alive) {
      return {
        ...state,
        units: prepareActorCooldowns(state.units, unit.id),
        turnOrder: { ...state.turnOrder, currentIndex: index },
      };
    }
  }

  if (state.round >= state.maxRounds) {
    const result: CombatResult = { outcome: 'draw', completedRound: state.round, winningSide: null };
    return {
      ...state,
      result,
      events: appendEvents(state, [{
        round: state.round, type: 'battle-ended', message: 'Maximum rounds reached. Battle ended in a draw.',
      }]),
    };
  }

  const nextRound = state.round + 1;
  const nextOrder = buildTurnOrder(state.units);
  const firstActorId = nextOrder[0];
  if (!firstActorId) return state;
  return {
    ...state,
    round: nextRound,
    units: prepareActorCooldowns(state.units, firstActorId),
    turnOrder: { unitIds: nextOrder, currentIndex: 0 },
    events: appendEvents(state, [{
      round: nextRound, type: 'round-started', message: `Round ${nextRound} started.`,
    }]),
  };
}

export function stepCombat(state: CombatState): CombatState {
  if (state.result.outcome !== 'ongoing') return state;
  const action = selectBasicAction(state);
  if (!action) {
    const actor = getCurrentActor(state);
    if (!actor?.alive) return advanceTurn(state);
    return state;
  }
  const resolution = resolveAction(state, action);
  if (!resolution.ok) return state;
  return resolution.state.result.outcome === 'ongoing'
    ? advanceTurn(resolution.state)
    : resolution.state;
}

export function runCombat(initialState: CombatState): CombatState {
  let state = initialState;
  const maximumActions = state.maxRounds * Math.max(1, state.units.length);
  for (let action = 0; action < maximumActions && state.result.outcome === 'ongoing'; action += 1) {
    const next = stepCombat(state);
    if (next === state) break;
    state = next;
  }
  return state;
}

export function isCombatComplete(outcome: CombatOutcome): boolean {
  return outcome !== 'ongoing';
}
