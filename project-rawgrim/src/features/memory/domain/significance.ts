import type { MemorySignificance } from './types.ts';

export type MemorySignificanceFactors = Omit<MemorySignificance, 'score'>;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function calculateMemorySignificance(factors: MemorySignificanceFactors): MemorySignificance {
  const severity = clamp01(factors.severity);
  const personalRisk = clamp01(factors.personalRisk);
  const novelty = clamp01(factors.novelty);
  const outcomeImportance = clamp01(factors.outcomeImportance);
  const relevance = clamp01(factors.relevance);
  return {
    score: Math.round(100 * (
      severity * 0.3 + personalRisk * 0.25 + novelty * 0.2 +
      outcomeImportance * 0.15 + relevance * 0.1
    )),
    severity,
    personalRisk,
    novelty,
    outcomeImportance,
    relevance,
  };
}
