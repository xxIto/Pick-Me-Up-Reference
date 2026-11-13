export interface SeededRandom {
  next: () => number;
}

export function createCombatRandom(seed: number): SeededRandom {
  if (!Number.isFinite(seed)) throw new Error('Combat seed must be finite');
  let state = seed >>> 0;
  return {
    next: () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}
