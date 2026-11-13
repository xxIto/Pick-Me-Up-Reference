import { calculateDerivedStats } from '../../heroes/domain/heroRules.ts';
import type {
  HeroClass,
  HeroDefinition,
  HeroInstance,
  PartyFormation,
} from '../../heroes/domain/types.ts';
import { createCombatRandom } from './rng.ts';
import type {
  CombatInitializationOptions,
  CombatPosition,
  CombatState,
  CombatStats,
  CombatUnit,
  EnemyDefinition,
} from './types.ts';

const DEFAULT_MAX_ROUNDS = 50;

function getClassSkillIds(heroClass: HeroClass): readonly string[] {
  if (heroClass === 'Healer') return ['mending-light', 'shadow-bolt'];
  return ['power-strike'];
}

function toCombatStats(
  heroClass: HeroClass,
  stats: ReturnType<typeof calculateDerivedStats>,
): CombatStats {
  return {
    maxHp: stats.hp,
    attack: stats.attack,
    magic: Math.max(1, Math.floor(stats.attack * (heroClass === 'Healer' ? 1.35 : 0.75))),
    defense: stats.defense,
    resistance: Math.max(1, Math.floor(stats.defense * 0.85)),
    speed: stats.speed,
  };
}

function getFormationEntries(formation: PartyFormation): Array<{ heroId: string; position: CombatPosition }> {
  const entries: Array<{ heroId: string; position: CombatPosition }> = [];
  formation.frontline.forEach((heroId, index) => {
    if (heroId) entries.push({ heroId, position: { line: 'frontline', index } });
  });
  formation.backline.forEach((heroId, index) => {
    if (heroId) entries.push({ heroId, position: { line: 'backline', index } });
  });
  return entries;
}

export function buildTurnOrder(units: readonly CombatUnit[]): readonly string[] {
  return units
    .filter((unit) => unit.alive)
    .slice()
    .sort((left, right) =>
      right.stats.speed - left.stats.speed ||
      left.initiativeTie - right.initiativeTie ||
      left.id.localeCompare(right.id),
    )
    .map((unit) => unit.id);
}

export function initializeCombat(
  roster: readonly HeroInstance[],
  formation: PartyFormation,
  heroDefinitions: readonly HeroDefinition[],
  enemyDefinitions: readonly EnemyDefinition[],
  options: CombatInitializationOptions,
): CombatState {
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  if (!Number.isInteger(maxRounds) || maxRounds < 1) {
    throw new Error('Maximum rounds must be a positive integer');
  }
  if (enemyDefinitions.length < 1 || enemyDefinitions.length > 5) {
    throw new Error('Combat requires between one and five enemies');
  }

  const deployed = getFormationEntries(formation);
  if (deployed.length < 1 || deployed.length > 5) {
    throw new Error('Combat requires between one and five deployed heroes');
  }
  const deployedIds = deployed.map(({ heroId }) => heroId);
  if (new Set(deployedIds).size !== deployedIds.length) {
    throw new Error('Duplicate hero instances cannot enter combat');
  }
  const enemyIds = enemyDefinitions.map((enemy) => enemy.id);
  if (new Set(enemyIds).size !== enemyIds.length) {
    throw new Error('Enemy definitions must have unique IDs');
  }

  const random = createCombatRandom(options.seed);
  const allies = deployed.map(({ heroId, position }): CombatUnit => {
    const instance = roster.find((hero) => hero.id === heroId);
    if (!instance) throw new Error(`Deployed hero ${heroId} does not exist in the roster`);
    if (instance.status === 'Dead' || instance.currentHp <= 0) {
      throw new Error(`Dead hero ${heroId} cannot enter combat`);
    }
    const definition = heroDefinitions.find((hero) => hero.id === instance.definitionId);
    if (!definition) throw new Error(`Hero definition ${instance.definitionId} is missing`);
    const stats = toCombatStats(definition.class, calculateDerivedStats(definition, instance.level));
    return {
      id: `ally:${instance.id}`,
      sourceId: instance.id,
      name: definition.name,
      class: definition.class,
      side: 'allies',
      position,
      stats,
      currentHp: Math.min(instance.currentHp, stats.maxHp),
      alive: true,
      defending: false,
      cooldowns: {},
      skillIds: getClassSkillIds(definition.class),
      initiativeTie: random.next(),
    };
  });

  const enemies = enemyDefinitions.map((definition): CombatUnit => ({
    id: `enemy:${definition.id}`,
    sourceId: definition.id,
    name: definition.name,
    class: 'Enemy',
    side: 'enemies',
    position: { ...definition.position },
    stats: { ...definition.stats },
    currentHp: definition.stats.maxHp,
    alive: true,
    defending: false,
    cooldowns: {},
    skillIds: [...definition.skillIds],
    initiativeTie: random.next(),
  }));

  const units = [...allies, ...enemies];
  return {
    seed: options.seed,
    round: 1,
    maxRounds,
    units,
    turnOrder: { unitIds: buildTurnOrder(units), currentIndex: 0 },
    events: [
      { sequence: 1, round: 1, type: 'battle-started', message: 'Battle started.' },
      { sequence: 2, round: 1, type: 'round-started', message: 'Round 1 started.' },
    ],
    result: { outcome: 'ongoing', completedRound: 0, winningSide: null },
  };
}
