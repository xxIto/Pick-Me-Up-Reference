import { describe, it, expect } from 'vitest';
import {
  mockPlayer,
  mockResources,
  mockTower,
  mockExpedition,
} from '../src/data/mockData.ts';

describe('mockPlayer', () => {
  it('has a name and positive level', () => {
    expect(typeof mockPlayer.name).toBe('string');
    expect(mockPlayer.name.length).toBeGreaterThan(0);
    expect(mockPlayer.level).toBeGreaterThan(0);
  });

  it('experience is less than experienceToNextLevel', () => {
    expect(mockPlayer.experience).toBeLessThan(mockPlayer.experienceToNextLevel);
  });
});

describe('mockResources', () => {
  it('all resources are non-negative', () => {
    expect(mockResources.gold).toBeGreaterThanOrEqual(0);
    expect(mockResources.crystals).toBeGreaterThanOrEqual(0);
    expect(mockResources.energy).toBeGreaterThanOrEqual(0);
  });

  it('energy does not exceed maxEnergy', () => {
    expect(mockResources.energy).toBeLessThanOrEqual(mockResources.maxEnergy);
  });
});

describe('mockTower', () => {
  it('currentFloor is within range', () => {
    expect(mockTower.currentFloor).toBeGreaterThanOrEqual(1);
    expect(mockTower.currentFloor).toBeLessThanOrEqual(mockTower.maxFloor);
  });

  it('floor list length matches maxFloor', () => {
    expect(mockTower.floors).toHaveLength(mockTower.maxFloor);
  });

  it('exactly one floor is marked current', () => {
    const currentCount = mockTower.floors.filter((f) => f.current).length;
    expect(currentCount).toBe(1);
  });

  it('current floor number matches currentFloor', () => {
    const current = mockTower.floors.find((f) => f.current);
    expect(current?.floor).toBe(mockTower.currentFloor);
  });

  it('cleared floors all precede the current floor', () => {
    for (const floor of mockTower.floors) {
      if (floor.cleared) {
        expect(floor.floor).toBeLessThan(mockTower.currentFloor);
      }
    }
  });
});

describe('mockExpedition', () => {
  it('timeRemainingMs is positive and within duration', () => {
    expect(mockExpedition.timeRemainingMs).toBeGreaterThan(0);
    expect(mockExpedition.timeRemainingMs).toBeLessThanOrEqual(mockExpedition.durationMs);
  });

  it('has a non-empty name', () => {
    expect(mockExpedition.name.length).toBeGreaterThan(0);
  });
});

