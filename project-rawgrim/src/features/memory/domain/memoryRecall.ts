import { assertValidMemoryConfiguration, DEFAULT_MEMORY_CONFIG } from './memoryProfile.ts';
import type {
  EpisodicMemory,
  HeroMemoryProfile,
  MemoryConfiguration,
  MemoryContribution,
  MemoryRecallContext,
  MemoryRecallResult,
} from './types.ts';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));
}

function overlaps(left: readonly string[], right: readonly string[]): boolean {
  return left.some((value) => right.includes(value));
}

function calculateRelevance(memory: EpisodicMemory, context: MemoryRecallContext): number {
  const hasEnemyMatch = overlaps(memory.context.enemyCategoryIds, context.enemyCategoryIds);
  const hasParticipantMatch = overlaps(memory.participantIds, context.participantIds);
  const hasRiskMatch = (memory.category === 'Survival' || memory.category === 'Failure') &&
    (context.actorHpBand === 'critical' || context.actorHpBand === 'low');
  const hasActionMatch = memory.category === 'Social' && context.actionCategory === 'healing';
  if (!hasEnemyMatch && !hasParticipantMatch && !hasRiskMatch && !hasActionMatch) return 0;
  const enemyMatch = hasEnemyMatch ? 0.4 : 0;
  const participantMatch = hasParticipantMatch ? 0.15 : 0;
  const threatMatch = 1 - Math.abs(memory.context.threatLevel - context.threatLevel);
  const riskMatch = hasRiskMatch ? 0.15 : 0;
  const actionMatch = hasActionMatch ? 0.1 :
    memory.category === 'Survival' && context.actionCategory === 'defense' ? 0.1 : 0;
  return clamp(
    enemyMatch + participantMatch + threatMatch * 0.1 + riskMatch + actionMatch +
      memory.significance.score / 100 * 0.1,
    0,
    1,
  );
}

function rawContribution(memory: EpisodicMemory, context: MemoryRecallContext): number {
  if (memory.category === 'Survival') {
    if (context.actionCategory === 'defense') return context.actorHpBand === 'critical' ? 8 : 5;
    if ((context.actionCategory === 'offense' || context.actionCategory === 'activeSkill') &&
      context.actorHpBand === 'critical') return -3;
  }
  if (memory.category === 'Failure') {
    if (context.actionCategory === 'defense') return 5;
    if (context.actionCategory === 'offense' && context.threatLevel >= 0.7) return -3;
  }
  if (memory.category === 'Social' && context.actionCategory === 'healing') {
    return 3 + context.allySurvivalRisk * 4;
  }
  if (memory.category === 'Combat' && context.actionCategory === 'defense' && context.threatLevel >= 0.7) return 2;
  return 0;
}

function explain(memory: EpisodicMemory, context: MemoryRecallContext, utility: number): string[] {
  const reasons: string[] = [];
  if (overlaps(memory.context.enemyCategoryIds, context.enemyCategoryIds)) reasons.push('same enemy category');
  if (memory.category === 'Survival' && context.actorHpBand === 'critical') reasons.push('critical-health survival context');
  if (memory.category === 'Social' && context.allySurvivalRisk >= 0.5) reasons.push('ally survival risk');
  reasons.push(utility === 0 ? 'recalled as context only' : `${utility > 0 ? 'supports' : 'discourages'} this action`);
  return reasons;
}

export function recallMemories(
  profile: HeroMemoryProfile,
  context: MemoryRecallContext,
  config: MemoryConfiguration = DEFAULT_MEMORY_CONFIG,
): MemoryRecallResult {
  assertValidMemoryConfiguration(config);
  if (profile.ownerHeroId !== context.heroInstanceId) {
    return { memories: [], totalUtilityContribution: 0 };
  }
  const ranked = profile.memories
    .map((memory) => ({ memory, relevanceScore: calculateRelevance(memory, context) }))
    .filter((entry) => entry.relevanceScore > 0)
    .sort((left, right) => right.relevanceScore - left.relevanceScore ||
      right.memory.significance.score - left.memory.significance.score ||
      left.memory.id.localeCompare(right.memory.id))
    .slice(0, config.maximumRecall)
    .sort((left, right) => left.memory.id.localeCompare(right.memory.id));
  const unbounded = ranked.map(({ memory, relevanceScore }) => ({
    memory,
    relevanceScore,
    utility: rawContribution(memory, context) * relevanceScore,
  }));
  const rawTotal = unbounded.reduce((total, entry) => total + entry.utility, 0);
  const boundedTotal = clamp(rawTotal, -config.maximumUtilityContribution, config.maximumUtilityContribution);
  const scale = rawTotal === 0 ? 0 : boundedTotal / rawTotal;
  let memories: MemoryContribution[] = unbounded.map(({ memory, relevanceScore, utility }) => {
    const boundedUtility = Math.round(utility * scale * 100) / 100;
    return {
      memory,
      relevanceScore: Math.round(relevanceScore * 1000) / 1000,
      utilityContribution: boundedUtility,
      explanation: explain(memory, context, boundedUtility),
    };
  });
  const targetTotal = Math.round(boundedTotal * 100) / 100;
  const roundedTotal = Math.round(
    memories.reduce((total, entry) => total + entry.utilityContribution, 0) * 100,
  ) / 100;
  const roundingDifference = Math.round((targetTotal - roundedTotal) * 100) / 100;
  if (roundingDifference !== 0 && memories.length > 0) {
    const lastIndex = memories.length - 1;
    const last = memories[lastIndex];
    memories = memories.map((entry, index) => index === lastIndex ? {
      ...last,
      utilityContribution: Math.round((last.utilityContribution + roundingDifference) * 100) / 100,
    } : entry);
  }
  return {
    memories,
    totalUtilityContribution: targetTotal,
  };
}
