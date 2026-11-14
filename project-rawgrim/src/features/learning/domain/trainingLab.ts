import { runAutonomousCombat } from '../../ai/domain/autonomousCombat.ts';
import type { DecisionContextResolver, DecisionTrace } from '../../ai/domain/types.ts';
import type { EnemyDefinition } from '../../combat/domain/types.ts';
import { initializeCombat } from '../../combat/domain/initialization.ts';
import { ensureHeroPersonality } from '../../heroes/domain/personality.ts';
import type {
  HeroDefinition,
  HeroInstance,
  PartyFormation,
} from '../../heroes/domain/types.ts';
import type { HeroPersonalityState, TeamStrategy } from '../../heroes/domain/personalityTypes.ts';
import { runLearningCombat } from './experienceCollector.ts';
import { applyCombatExperience } from './learningEngine.ts';
import type { LearningUpdate } from './types.ts';
import { normalizeMemoryProfile } from '../../memory/domain/memoryProfile.ts';

export interface LearningLaboratoryOptions {
  roster: readonly HeroInstance[];
  formation: PartyFormation;
  definitions: readonly HeroDefinition[];
  enemies: readonly EnemyDefinition[];
  selectedHeroId: string;
  teamStrategy: TeamStrategy;
  seed: number;
  repetitions: number;
}

export interface LearningLaboratoryResult {
  evaluationSeed: number;
  beforeDecision: DecisionTrace | null;
  afterDecision: DecisionTrace | null;
  originalPersonality: HeroPersonalityState;
  trainedPersonality: HeroPersonalityState;
  updates: readonly LearningUpdate[];
}

function buildLaboratoryFormation(
  roster: readonly HeroInstance[],
  formation: PartyFormation,
  selectedHeroId: string,
): PartyFormation {
  const selected = roster.find((hero) => hero.id === selectedHeroId);
  if (!selected || selected.status === 'Dead' || selected.currentHp <= 0) {
    throw new Error('Learning laboratory requires a living selected hero');
  }
  const assigned = [...formation.frontline, ...formation.backline].filter(
    (heroId): heroId is string => heroId !== null && heroId !== selectedHeroId,
  );
  const companions = assigned.filter((heroId) => {
    const hero = roster.find((candidate) => candidate.id === heroId);
    return hero && hero.status !== 'Dead' && hero.currentHp > 0;
  });
  const ids = [selectedHeroId, ...companions].slice(0, 5);
  return {
    frontline: [ids[0] ?? null, ids[1] ?? null, ids[2] ?? null],
    backline: [ids[3] ?? null, ids[4] ?? null],
  };
}

function createResolver(
  roster: readonly HeroInstance[],
  definitions: readonly HeroDefinition[],
  teamStrategy: TeamStrategy,
): DecisionContextResolver {
  return (heroInstanceId) => {
    const hero = roster.find((candidate) => candidate.id === heroInstanceId);
    const definition = hero
      ? definitions.find((candidate) => candidate.id === hero.definitionId)
      : undefined;
    if (!hero) throw new Error(`Laboratory hero ${heroInstanceId} is missing`);
    return {
      personality: ensureHeroPersonality(hero, definition),
      memoryProfile: normalizeMemoryProfile(hero.memory, hero.id),
      teamStrategy,
    };
  };
}

function evaluateFirstDecision(
  roster: readonly HeroInstance[],
  formation: PartyFormation,
  options: LearningLaboratoryOptions,
): DecisionTrace | null {
  const combat = initializeCombat(
    roster,
    formation,
    options.definitions,
    options.enemies,
    { seed: options.seed, maxRounds: 50 },
  );
  return runAutonomousCombat(
    combat,
    createResolver(roster, options.definitions, options.teamStrategy),
  ).decisions.find((decision) => decision.heroInstanceId === options.selectedHeroId) ?? null;
}

export function runLearningLaboratory(options: LearningLaboratoryOptions): LearningLaboratoryResult {
  if (!Number.isInteger(options.seed) || options.seed < 0) throw new Error('Laboratory seed must be a non-negative integer');
  if (!Number.isInteger(options.repetitions) || options.repetitions < 1 || options.repetitions > 20) {
    throw new Error('Laboratory repetitions must be between 1 and 20');
  }
  const formation = buildLaboratoryFormation(options.roster, options.formation, options.selectedHeroId);
  let roster = structuredClone(options.roster) as HeroInstance[];
  const selected = roster.find((hero) => hero.id === options.selectedHeroId);
  const definition = selected
    ? options.definitions.find((candidate) => candidate.id === selected.definitionId)
    : undefined;
  if (!selected) throw new Error('Selected laboratory hero does not exist');
  const originalPersonality = structuredClone(ensureHeroPersonality(selected, definition));
  const beforeDecision = evaluateFirstDecision(roster, formation, options);
  const updates: LearningUpdate[] = [];

  for (let index = 0; index < options.repetitions; index += 1) {
    const combat = initializeCombat(
      roster,
      formation,
      options.definitions,
      options.enemies,
      { seed: options.seed + index, maxRounds: 50 },
    );
    const result = runLearningCombat(
      combat,
      createResolver(roster, options.definitions, options.teamStrategy),
      {
        sessionId: `lab:${options.selectedHeroId}:${options.seed}:${index}`,
        eligibleForLearning: true,
      },
    );
    const selectedExperience = {
      ...result.experience,
      observations: result.experience.observations.filter(
        (observation) => observation.heroInstanceId === options.selectedHeroId,
      ),
    };
    roster = roster.map((hero) => {
      if (hero.id !== options.selectedHeroId) return hero;
      const applied = applyCombatExperience(
        ensureHeroPersonality(hero, definition),
        selectedExperience,
      );
      updates.push(...applied.updates);
      return { ...hero, personality: applied.personality };
    });
  }

  const trained = roster.find((hero) => hero.id === options.selectedHeroId);
  if (!trained) throw new Error('Trained laboratory hero is missing');
  return {
    evaluationSeed: options.seed,
    beforeDecision,
    afterDecision: evaluateFirstDecision(roster, formation, options),
    originalPersonality,
    trainedPersonality: structuredClone(ensureHeroPersonality(trained, definition)),
    updates,
  };
}
