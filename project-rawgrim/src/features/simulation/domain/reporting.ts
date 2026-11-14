import type {
  BalancingReport,
  SimulationComparison,
  SimulationExperiment,
  SimulationMetrics,
  SimulationReport,
} from './types.ts';

function round(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000;
}

export function createBalancingReport(
  experiment: SimulationExperiment,
  metrics: SimulationMetrics,
): BalancingReport {
  const actionTotal = Object.values(metrics.actionDistribution).reduce((total, value) => total + value, 0);
  const offenseRate = actionTotal > 0 ? metrics.actionDistribution.offense / actionTotal : 0;
  const trainingLabel = experiment.population.training
    ? `${experiment.population.training.repetitions} isolated training battles per selected hero`
    : 'no pre-evaluation training phase';
  return {
    executiveSummary: [
      `${metrics.battles} battles produced a ${(metrics.winRate.rate * 100).toFixed(1)}% win rate and ${(metrics.survivalRate.rate * 100).toFixed(1)}% hero survival rate.`,
      `${metrics.invalidActionCount} invalid or non-finite selected decisions were observed.`,
      `The result covers ${experiment.population.label} against ${experiment.scenario.label}; it is not a cross-population conclusion by itself.`,
    ],
    personality: {
      findings: [
        `Offensive actions represented ${(offenseRate * 100).toFixed(1)}% of observed allied decisions.`,
        `Severe-risk actions represented ${(metrics.riskTakingFrequency * 100).toFixed(1)}% of observed allied decisions.`,
        `Population tags: ${experiment.population.tags.join(', ') || 'none'}.`,
      ],
      risks: ['A single population cannot establish personality differentiation; compare matched-seed personality populations.'],
    },
    learning: {
      findings: [
        `Experiment used ${trainingLabel}.`,
        `Mean hypothetical evaluation update magnitude was ${metrics.learningUpdateMagnitude.mean}.`,
      ],
      risks: ['Utility or update magnitude changes are not evidence of improved intelligence without held-out outcome changes.'],
    },
    memory: {
      findings: [`Selected memory contribution mean ${metrics.memoryContribution.mean}, range ${metrics.memoryContribution.minimum} to ${metrics.memoryContribution.maximum}.`],
      risks: ['Relevant and irrelevant memory populations require matched-seed comparison before balance conclusions.'],
    },
    relationshipsAndLeadership: {
      findings: [
        `Selected relationship contribution mean ${metrics.relationshipContribution.mean}.`,
        `Selected leadership contribution mean ${metrics.leadershipContribution.mean}.`,
        `Strategy adherence was ${metrics.strategyAdherence.total > 0 ? `${(metrics.strategyAdherence.rate * 100).toFixed(1)}%` : 'not applicable'}.`,
      ],
      risks: ['Current direct relationship behavior is limited to supported ally-healing choices.'],
    },
    hardcoreBalance: {
      findings: [
        `Death rate was ${(metrics.deathRate.rate * 100).toFixed(1)}% with a 95% interval of ${(metrics.deathRate.lower * 100).toFixed(1)}%–${(metrics.deathRate.upper * 100).toFixed(1)}%.`,
      ],
      risks: [
        'Combat defeat does not validate permanent-death fairness because TASK 005E is absent.',
        'No death is labeled avoidable without controlled counterfactual replay.',
      ],
    },
    recommendations: [
      ...(metrics.invalidActionCount > 0
        ? ['Investigate invalid decisions before considering balance adjustments.']
        : ['Preserve current action validation while expanding matched-seed comparisons.']),
      'Compare relevant and held-out scenarios using identical seed sets before adjusting learning or memory bounds.',
      'Run focused counterfactual replay experiments before attributing preventable deaths to AI scoring.',
      'Do not change rarity or social modifiers from this single report; compare absolute outcome differences and uncertainty first.',
    ],
  };
}

export function compareSimulationReports(
  left: SimulationReport,
  right: SimulationReport,
): SimulationComparison {
  const matchedSeeds = left.seeds.length === right.seeds.length &&
    left.seeds.every((seed, index) => seed === right.seeds[index]);
  return {
    leftReportId: left.reportId,
    rightReportId: right.reportId,
    matchedSeeds,
    sampleSize: Math.min(left.metrics.battles, right.metrics.battles),
    absoluteDifferences: {
      winRate: round(right.metrics.winRate.rate - left.metrics.winRate.rate),
      survivalRate: round(right.metrics.survivalRate.rate - left.metrics.survivalRate.rate),
      averageRounds: round(right.metrics.averageRounds - left.metrics.averageRounds),
      averageDamageDealt: round(right.metrics.averageDamageDealt - left.metrics.averageDamageDealt),
      averageEffectiveHealing: round(right.metrics.averageEffectiveHealing - left.metrics.averageEffectiveHealing),
      strategyAdherence: round(right.metrics.strategyAdherence.rate - left.metrics.strategyAdherence.rate),
    },
    warnings: [
      ...(!matchedSeeds ? ['Reports do not use identical ordered seed sets; causal comparison is weaker.'] : []),
      ...(left.aiVersion !== right.aiVersion ? ['Reports use different AI versions.'] : []),
      'Absolute differences require design interpretation alongside uncertainty intervals and sample size.',
    ],
  };
}
