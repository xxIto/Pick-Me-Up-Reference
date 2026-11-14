import type { DistributionMetric, RateMetric, RateInterval } from './types.ts';

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(finite(value) * scale) / scale;
}

export function wilsonInterval(count: number, total: number): RateInterval {
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(total) || total <= 0 || count < 0 || count > total) {
    return { lower: 0, upper: 0 };
  }
  const z = 1.959_963_984_540_054;
  const proportion = count / total;
  const denominator = 1 + z ** 2 / total;
  const center = (proportion + z ** 2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt(
    (proportion * (1 - proportion) + z ** 2 / (4 * total)) / total,
  ) / denominator;
  return { lower: round(Math.max(0, center - margin)), upper: round(Math.min(1, center + margin)) };
}

export function createRateMetric(count: number, total: number): RateMetric {
  const safeTotal = Number.isSafeInteger(total) && total > 0 ? total : 0;
  const safeCount = safeTotal > 0 && Number.isSafeInteger(count)
    ? Math.min(safeTotal, Math.max(0, count))
    : 0;
  return {
    count: safeCount,
    total: safeTotal,
    rate: safeTotal > 0 ? round(safeCount / safeTotal) : 0,
    ...wilsonInterval(safeCount, safeTotal),
  };
}

export interface DistributionAccumulator {
  count: number;
  total: number;
  totalAbsolute: number;
  minimum: number;
  maximum: number;
}

export function createDistributionAccumulator(): DistributionAccumulator {
  return { count: 0, total: 0, totalAbsolute: 0, minimum: 0, maximum: 0 };
}

export function recordDistributionValue(accumulator: DistributionAccumulator, value: number): void {
  if (!Number.isFinite(value)) return;
  accumulator.minimum = accumulator.count === 0 ? value : Math.min(accumulator.minimum, value);
  accumulator.maximum = accumulator.count === 0 ? value : Math.max(accumulator.maximum, value);
  accumulator.count += 1;
  accumulator.total += value;
  accumulator.totalAbsolute += Math.abs(value);
}

export function finalizeDistribution(accumulator: DistributionAccumulator): DistributionMetric {
  return {
    count: accumulator.count,
    minimum: round(accumulator.minimum),
    maximum: round(accumulator.maximum),
    mean: accumulator.count > 0 ? round(accumulator.total / accumulator.count) : 0,
    meanAbsolute: accumulator.count > 0 ? round(accumulator.totalAbsolute / accumulator.count) : 0,
  };
}
