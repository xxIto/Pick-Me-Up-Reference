import { SANDBOX_ENEMIES } from '../../combat/data/enemyDefinitions.ts';
import { heroDefinitions } from '../../heroes/data/heroDefinitions.ts';
import { initialHeroRoster, initialPartyFormation } from '../../heroes/data/initialRoster.ts';
import { calculateDerivedStats, createHeroInstance } from '../../heroes/domain/heroRules.ts';
import type { HeroDefinition, HeroInstance, PartyFormation } from '../../heroes/domain/types.ts';
import { applyRelationshipEvent } from '../../social/domain/relationshipEngine.ts';
import type { RelationshipChange, RelationshipEvent } from '../../social/domain/types.ts';
import type { EpisodicMemory } from '../../memory/domain/types.ts';
import type {
  SimulationExperiment,
  SimulationPopulation,
  SimulationScenario,
} from '../domain/types.ts';

const AI_VERSION = 'rawgrim-utility-ai-005f';

function cloneRoster(): HeroInstance[] {
  return structuredClone(initialHeroRoster);
}

function baselinePopulation(id: string, label: string, description: string): SimulationPopulation {
  return {
    id, label, description,
    roster: cloneRoster(),
    formation: structuredClone(initialPartyFormation),
    teamStrategy: 'Balanced',
    leaderId: null,
    tags: ['baseline'],
  };
}

function personalityPopulation(
  id: string,
  label: string,
  dimensions: Partial<NonNullable<HeroInstance['personality']>['innate']>,
): SimulationPopulation {
  const population = baselinePopulation(id, label, 'Identical roster with controlled innate personality dimensions.');
  const roster = population.roster.map((hero) => {
    if (!hero.personality) return hero;
    return {
      ...hero,
      personality: { ...hero.personality, innate: { ...hero.personality.innate, ...dimensions } },
    };
  });
  return { ...population, roster, tags: ['personality', id] };
}

function formationFrom(ids: readonly string[]): PartyFormation {
  return {
    frontline: [ids[0] ?? null, ids[1] ?? null, ids[2] ?? null],
    backline: [ids[3] ?? null, ids[4] ?? null],
  };
}

function createBenchmarkHero(definition: HeroDefinition, id: string, level: number): HeroInstance {
  const hero = createHeroInstance(definition, id);
  return {
    ...hero,
    level,
    currentHp: calculateDerivedStats(definition, level).hp,
  };
}

function rarityPopulation(
  id: string,
  label: string,
  definitions: readonly HeroDefinition[],
  level: number,
): SimulationPopulation {
  const roster = definitions.slice(0, 4).map((definition, index) =>
    createBenchmarkHero(definition, `${id}-${index + 1}`, level));
  return {
    id, label,
    description: `${label} benchmark at level ${level}; source balance values are unchanged.`,
    roster,
    formation: formationFrom(roster.map((hero) => hero.id)),
    teamStrategy: 'Balanced', leaderId: null, tags: ['rarity', `level-${level}`],
  };
}

function memoryEntry(ownerHeroId: string, enemyCategoryId: string): EpisodicMemory {
  return {
    id: `simulation-memory:${ownerHeroId}:${enemyCategoryId}`,
    ownerHeroId,
    sourceId: `simulation-history:${enemyCategoryId}`,
    category: 'Combat',
    title: `Observed ${enemyCategoryId}`,
    description: `A controlled laboratory memory concerning ${enemyCategoryId}.`,
    participantIds: [enemyCategoryId],
    context: {
      sessionId: 'simulation-history', round: 4, enemyCategoryIds: [enemyCategoryId],
      combatOutcome: 'defeat', threatLevel: 0.8,
    },
    facts: { outcome: 'defeat', enemyCategoryIds: [enemyCategoryId], repeatedEncounterCount: 2 },
    significance: { score: 80, severity: 0.8, personalRisk: 0.8, novelty: 0.5, outcomeImportance: 1, relevance: 1 },
    eventOrder: 1,
    relatedMemoryIds: [],
  };
}

function memoryPopulation(id: string, label: string, enemyCategoryId: string): SimulationPopulation {
  const population = baselinePopulation(id, label, 'Baseline party with a controlled bounded memory profile.');
  const roster = population.roster.map((hero) => hero.memory ? {
    ...hero,
    memory: { ...hero.memory, memories: [memoryEntry(hero.id, enemyCategoryId)], nextEventOrder: 2 },
  } : hero);
  return { ...population, roster, tags: ['memory', id] };
}

function maximumMemoryPopulation(): SimulationPopulation {
  const population = baselinePopulation('maximum-memory', 'Maximum-capacity Memory', 'Every deployed hero has 100 valid retained memories.');
  const deployedIds = new Set([...population.formation.frontline, ...population.formation.backline]
    .filter((heroId): heroId is string => heroId !== null));
  const roster = population.roster.map((hero) => {
    if (!hero.memory || !deployedIds.has(hero.id)) return hero;
    const memories = Array.from({ length: 100 }, (_, index) => {
      const enemyId = index === 0 ? 'ash-hound-a' : `archived-enemy-${index}`;
      return {
        ...memoryEntry(hero.id, enemyId),
        id: `simulation-memory:${hero.id}:${index}`,
        sourceId: `simulation-history:${index}`,
        eventOrder: index + 1,
      };
    });
    return { ...hero, memory: { ...hero.memory, memories, nextEventOrder: 101 } };
  });
  return { ...population, roster, tags: ['memory', 'capacity', 'performance'] };
}

function trainedPopulation(
  id: string,
  label: string,
  trainingScenarioId: string,
): SimulationPopulation {
  const population = baselinePopulation(id, label, 'Baseline party with a separate deterministic training phase.');
  const selectedHeroId = population.formation.frontline[0];
  const scenario = simulationScenarios.find((entry) => entry.id === trainingScenarioId);
  if (!selectedHeroId || !scenario) throw new Error(`Training population ${id} is invalid`);
  return {
    ...population,
    tags: ['learning', id],
    training: {
      scenario: structuredClone(scenario),
      selectedHeroIds: [selectedHeroId],
      repetitions: 5,
      baseSeed: 80_000,
    },
  };
}

function relationshipEvent(
  ownerHeroId: string,
  targetHeroId: string,
  changes: RelationshipChange,
): RelationshipEvent {
  return {
    id: `simulation-relationship:${ownerHeroId}:${targetHeroId}`,
    sourceId: `simulation-relationship:${ownerHeroId}:${targetHeroId}`,
    type: 'shared-battle', ownerHeroId, targetHeroId, sessionId: 'simulation-history', round: 1,
    changes, memoryIds: [], description: 'Controlled pre-existing relationship for laboratory comparison.', eventOrder: 1,
  };
}

function socialPopulation(
  id: string,
  label: string,
  changes: RelationshipChange,
  leaderMode: 'first' | 'none',
): SimulationPopulation {
  const population = baselinePopulation(id, label, 'Controlled directional relationship and leadership population.');
  const deployedIds = [...population.formation.frontline, ...population.formation.backline]
    .filter((heroId): heroId is string => heroId !== null);
  const roster = population.roster.map((hero) => {
    if (!hero.relationships || !deployedIds.includes(hero.id)) return hero;
    let profile = hero.relationships;
    for (const targetId of deployedIds.filter((targetId) => targetId !== hero.id)) {
      profile = applyRelationshipEvent(profile, relationshipEvent(hero.id, targetId, changes));
    }
    return { ...hero, relationships: profile };
  });
  return {
    ...population,
    roster,
    teamStrategy: 'Defensive',
    leaderId: leaderMode === 'first' ? deployedIds[0] ?? null : null,
    tags: ['social', 'leadership', id],
  };
}

function oneSidedTrustPopulation(): SimulationPopulation {
  const population = baselinePopulation('one-sided-trust', 'One-sided Trust', 'Only one deployed hero trusts one teammate.');
  const ownerId = population.formation.frontline[0];
  const targetId = population.formation.backline[0];
  if (!ownerId || !targetId) throw new Error('One-sided trust population requires two deployed heroes');
  const roster = population.roster.map((hero) => hero.id === ownerId && hero.relationships
    ? { ...hero, relationships: applyRelationshipEvent(hero.relationships, relationshipEvent(ownerId, targetId, { familiarity: 70, trust: 90, affection: 40 })) }
    : hero);
  return { ...population, roster, tags: ['social', 'directional', 'one-sided'] };
}

function leaderDisciplinePopulation(id: string, label: string, discipline: number): SimulationPopulation {
  const population = baselinePopulation(id, label, 'Only the deployed leader discipline differs from baseline.');
  const leaderId = population.formation.frontline[0];
  if (!leaderId) throw new Error(`Leadership population ${id} requires a deployed leader`);
  const roster = population.roster.map((hero) => hero.id === leaderId && hero.personality
    ? {
        ...hero,
        personality: {
          ...hero.personality,
          innate: { ...hero.personality.innate, discipline },
        },
      }
    : hero);
  return {
    ...population,
    roster,
    teamStrategy: 'Defensive',
    leaderId,
    tags: ['leadership', `discipline-${discipline}`],
  };
}

function distrustedLeaderPopulation(): SimulationPopulation {
  const population = baselinePopulation('distrusted-leader', 'Distrusted Leader', 'Teammates distrust the leader without changing their other relationships.');
  const leaderId = population.formation.frontline[0];
  if (!leaderId) throw new Error('Distrusted leader population requires a deployed leader');
  const deployedIds = [...population.formation.frontline, ...population.formation.backline]
    .filter((heroId): heroId is string => heroId !== null);
  const roster = population.roster.map((hero) => {
    if (hero.id === leaderId || !deployedIds.includes(hero.id) || !hero.relationships) return hero;
    return {
      ...hero,
      relationships: applyRelationshipEvent(
        hero.relationships,
        relationshipEvent(hero.id, leaderId, { familiarity: 80, trust: -80, respect: -50, resentment: 60 }),
      ),
    };
  });
  return {
    ...population,
    roster,
    teamStrategy: 'Defensive',
    leaderId,
    tags: ['leadership', 'distrusted'],
  };
}

const lowRarityDefinitions = heroDefinitions.filter((definition) => definition.rarity <= 3);
const highRarityDefinitions = heroDefinitions.filter((definition) => definition.rarity >= 4);

export const simulationScenarios: readonly SimulationScenario[] = [
  {
    id: 'skirmish', label: 'Ash Skirmish', description: 'Two-enemy baseline encounter.',
    enemies: structuredClone(SANDBOX_ENEMIES.slice(0, 2)), maxRounds: 35, heldOut: false,
  },
  {
    id: 'full-assault', label: 'Full Assault', description: 'Complete five-enemy stress encounter.',
    enemies: structuredClone(SANDBOX_ENEMIES), maxRounds: 50, heldOut: false,
  },
  {
    id: 'held-out-coven', label: 'Held-out Coven', description: 'Backline magical enemies excluded from the baseline scenario.',
    enemies: structuredClone(SANDBOX_ENEMIES.slice(3)), maxRounds: 35, heldOut: true,
  },
];

export const simulationPopulations: readonly SimulationPopulation[] = [
  baselinePopulation('baseline', 'Baseline Party', 'Current starter roster and balanced strategy.'),
  personalityPopulation('aggressive', 'Aggressive Personalities', { aggression: 100, courage: 90, selfPreservation: 10 }),
  personalityPopulation('disciplined', 'Disciplined Personalities', { discipline: 100, aggression: 20, selfPreservation: 80 }),
  rarityPopulation('low-rarity-veterans', 'Low-rarity Veterans', lowRarityDefinitions, 20),
  rarityPopulation('high-rarity-recruits', 'High-rarity Recruits', highRarityDefinitions, 1),
  trainedPopulation('relevant-trained', 'Relevant Encounter Training', 'skirmish'),
  trainedPopulation('unrelated-trained', 'Unrelated Encounter Training', 'held-out-coven'),
  trainedPopulation('adverse-trained', 'Adverse Full-assault Training', 'full-assault'),
  memoryPopulation('relevant-memory', 'Relevant Enemy Memory', 'ash-hound-a'),
  memoryPopulation('irrelevant-memory', 'Irrelevant Enemy Memory', 'unseen-wraith'),
  maximumMemoryPopulation(),
  socialPopulation('trusted-party', 'Trusted Party', { familiarity: 80, trust: 80, respect: 70, affection: 40 }, 'first'),
  oneSidedTrustPopulation(),
  socialPopulation('strong-rivalry', 'Strong Rivalry', { familiarity: 70, rivalry: 90, resentment: 20 }, 'none'),
  socialPopulation('respect-without-affection', 'Respect Without Affection', { familiarity: 50, respect: 90, affection: -60 }, 'first'),
  socialPopulation('familiar-low-trust', 'Familiar but Distrustful', { familiarity: 95, trust: -60, respect: 20 }, 'none'),
  distrustedLeaderPopulation(),
  leaderDisciplinePopulation('high-discipline-leader', 'High-discipline Leader', 100),
  leaderDisciplinePopulation('low-discipline-leader', 'Low-discipline Leader', 0),
  socialPopulation('no-leader', 'No Leader', { familiarity: 40, trust: 20, respect: 20 }, 'none'),
];

export interface CreateExperimentOptions {
  id: string;
  scenarioId: string;
  populationId: string;
  count: number;
  baseSeed: number;
  traceLimit?: number;
  maxDecisionsPerTrace?: number;
  debugTracing?: boolean;
}

export function createExperiment(options: CreateExperimentOptions): SimulationExperiment {
  const scenario = simulationScenarios.find((entry) => entry.id === options.scenarioId);
  const population = simulationPopulations.find((entry) => entry.id === options.populationId);
  if (!scenario) throw new Error(`Unknown simulation scenario ${options.scenarioId}`);
  if (!population) throw new Error(`Unknown simulation population ${options.populationId}`);
  if (!Number.isSafeInteger(options.count) || options.count < 1 || options.count > 10_000) {
    throw new Error('Simulation count must be between 1 and 10000');
  }
  if (!Number.isSafeInteger(options.baseSeed) || !Number.isSafeInteger(options.baseSeed + options.count - 1)) {
    throw new Error('Simulation base seed must produce safe integer seeds');
  }
  return {
    id: options.id,
    label: `${population.label} · ${scenario.label}`,
    description: `${population.description} ${scenario.description}`,
    aiVersion: AI_VERSION,
    scenario: structuredClone(scenario),
    population: structuredClone(population),
    seeds: Array.from({ length: options.count }, (_, index) => options.baseSeed + index),
    traceLimit: options.traceLimit ?? 3,
    maxDecisionsPerTrace: options.maxDecisionsPerTrace ?? 50,
    debugTracing: options.debugTracing ?? true,
  };
}
