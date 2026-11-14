import type { ActionCategory } from '../../ai/domain/actionCategory.ts';
import type { CandidateUtility, DecisionTrace } from '../../ai/domain/types.ts';
import type { CombatOutcome, EnemyDefinition } from '../../combat/domain/types.ts';
import type { HeroClass, HeroInstance, HeroRarity, PartyFormation } from '../../heroes/domain/types.ts';
import type { TeamStrategy } from '../../heroes/domain/personalityTypes.ts';
import type { LeadershipEvaluation, PartyChemistry } from '../../social/domain/types.ts';

export const SUPPORTED_SIMULATION_BATCHES = [100, 1_000, 10_000] as const;

export interface SimulationScenario {
  id: string;
  label: string;
  description: string;
  enemies: readonly EnemyDefinition[];
  maxRounds: number;
  heldOut: boolean;
}

export interface SimulationPopulation {
  id: string;
  label: string;
  description: string;
  roster: readonly HeroInstance[];
  formation: PartyFormation;
  teamStrategy: TeamStrategy;
  leaderId: string | null;
  tags: readonly string[];
  training?: SimulationTrainingDefinition;
}

export interface SimulationTrainingDefinition {
  scenario: SimulationScenario;
  selectedHeroIds: readonly string[];
  repetitions: number;
  baseSeed: number;
}

export interface SimulationExperiment {
  id: string;
  label: string;
  description: string;
  aiVersion: string;
  scenario: SimulationScenario;
  population: SimulationPopulation;
  seeds: readonly number[];
  traceLimit: number;
  maxDecisionsPerTrace: number;
  debugTracing: boolean;
}

export type SimulationValidationResult =
  | { valid: true }
  | { valid: false; errors: readonly string[] };

export interface RateInterval {
  lower: number;
  upper: number;
}

export interface RateMetric extends RateInterval {
  count: number;
  total: number;
  rate: number;
}

export interface DistributionMetric {
  count: number;
  minimum: number;
  maximum: number;
  mean: number;
  meanAbsolute: number;
}

export interface GroupOutcomeMetric {
  battles: number;
  survived: number;
  survivalRate: RateMetric;
}

export interface SimulationMetrics {
  battles: number;
  winRate: RateMetric;
  survivalRate: RateMetric;
  deathRate: RateMetric;
  averageRounds: number;
  averageDamageDealt: number;
  averageEffectiveHealing: number;
  averageWastedHealing: number;
  defendFrequency: number;
  invalidActionCount: number;
  actionDistribution: Record<ActionCategory, number>;
  targetDistribution: Readonly<Record<string, number>>;
  riskTakingFrequency: number;
  strategyAdherence: RateMetric;
  learningUpdateMagnitude: DistributionMetric;
  memoryContribution: DistributionMetric;
  relationshipContribution: DistributionMetric;
  leadershipContribution: DistributionMetric;
  perClass: Partial<Record<HeroClass, GroupOutcomeMetric>>;
  perRarity: Partial<Record<HeroRarity, GroupOutcomeMetric>>;
  runtimeMs: number;
  averageRuntimePerBattleMs: number;
  memoryDeltaBytes: number | null;
}

export type DeathCause =
  | 'unavoidable-under-observed-rules'
  | 'high-risk-preparation'
  | 'personality-driven-risk'
  | 'poor-learned-preference'
  | 'ai-scoring-defect'
  | 'invalid-game-state'
  | 'insufficient-evidence';

export interface DeathAnalysisEntry {
  heroInstanceId: string;
  cause: DeathCause;
  evidence: readonly string[];
  legalAlternativeObserved: boolean;
  counterfactualTested: boolean;
  counterfactualPreventedDeath: boolean | null;
}

export interface DecisionDiagnostic {
  heroInstanceId: string;
  selectedAction: DecisionTrace['selectedAction'];
  selectedUtility: number;
  alternatives: readonly CandidateUtility[];
  warnings: readonly string[];
}

export interface BattleTrace {
  seed: number;
  outcome: CombatOutcome;
  rounds: number;
  decisions: readonly DecisionDiagnostic[];
  deaths: readonly DeathAnalysisEntry[];
  warnings: readonly string[];
}

export interface SimulationBattleResult {
  seed: number;
  outcome: CombatOutcome;
  rounds: number;
  heroCount: number;
  survivorCount: number;
  damageDealt: number;
  effectiveHealing: number;
  wastedHealing: number;
  defendCount: number;
  invalidActionCount: number;
  actionDistribution: Record<ActionCategory, number>;
  targetDistribution: Readonly<Record<string, number>>;
  severeRiskDecisions: number;
  observedDecisions: number;
  strategyAdherentDecisions: number;
  strategyRelevantDecisions: number;
  learningUpdateMagnitude: number;
  memoryContributions: readonly number[];
  relationshipContributions: readonly number[];
  leadershipContributions: readonly number[];
  classOutcomes: readonly { heroClass: HeroClass; survived: boolean }[];
  rarityOutcomes: readonly { rarity: HeroRarity; survived: boolean }[];
  diagnostics: BattleTrace | null;
  deaths: readonly DeathAnalysisEntry[];
}

export interface SimulationReport {
  reportId: string;
  experimentId: string;
  aiVersion: string;
  configuration: SimulationExperiment;
  seeds: readonly number[];
  metrics: SimulationMetrics;
  traces: readonly BattleTrace[];
  warnings: readonly string[];
  limitations: readonly string[];
  balancingReport: BalancingReport;
  partyChemistry: PartyChemistry;
  leadership: LeadershipEvaluation;
}

export interface BalancingReportSection {
  findings: readonly string[];
  risks: readonly string[];
}

export interface BalancingReport {
  executiveSummary: readonly string[];
  personality: BalancingReportSection;
  learning: BalancingReportSection;
  memory: BalancingReportSection;
  relationshipsAndLeadership: BalancingReportSection;
  hardcoreBalance: BalancingReportSection;
  recommendations: readonly string[];
}

export interface SimulationComparison {
  leftReportId: string;
  rightReportId: string;
  matchedSeeds: boolean;
  sampleSize: number;
  absoluteDifferences: {
    winRate: number;
    survivalRate: number;
    averageRounds: number;
    averageDamageDealt: number;
    averageEffectiveHealing: number;
    strategyAdherence: number;
  };
  warnings: readonly string[];
}

export interface SimulationProgress {
  completed: number;
  total: number;
  fraction: number;
}

export interface SimulationRunOptions {
  now?: () => number;
  memoryUsageBytes?: () => number;
}

export interface AsyncSimulationRunOptions extends SimulationRunOptions {
  chunkSize?: number;
  onProgress?: (progress: SimulationProgress) => void;
  isCancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
}
