import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mockResources } from '../../../data/mockData.ts';
import { GACHA_CONFIG } from '../../gacha/domain/gachaConfig.ts';
import { createSummonCoordinator } from '../../gacha/domain/summonTransaction.ts';
import type { SummonCoordinator } from '../../gacha/domain/summonTransaction.ts';
import type {
  SummonCount,
  SummonTransactionResult,
} from '../../gacha/domain/types.ts';
import {
  createGameSaveEnvelope,
  GAME_SAVE_VERSION,
  migrateGameState,
  parsePersistedGameState,
} from '../../../state/gamePersistence.ts';
import type { PersistedGameState } from '../../../state/gamePersistence.ts';
import { heroDefinitions } from '../data/heroDefinitions.ts';
import { initialHeroRoster, initialPartyFormation } from '../data/initialRoster.ts';
import { assignHeroToSlot, removeHeroFromSlot } from '../domain/heroRules.ts';
import type { FormationSlot, HeroInstance, PartyFormation } from '../domain/types.ts';
import type { TeamStrategy } from '../domain/personalityTypes.ts';
import { ensureHeroPersonality } from '../domain/personality.ts';
import { applyCombatExperience } from '../../learning/domain/learningEngine.ts';
import type {
  CombatExperience,
  LearningUpdate,
} from '../../learning/domain/types.ts';
import { formHeroMemories } from '../../memory/domain/memoryFormation.ts';
import { normalizeMemoryProfile } from '../../memory/domain/memoryProfile.ts';
import type { EpisodicMemory, MemoryFormationSource } from '../../memory/domain/types.ts';
import { validateLeaderAssignment } from '../../social/domain/leadership.ts';
import { formPartyRelationships } from '../../social/domain/relationshipEngine.ts';
import { normalizeRelationshipProfile } from '../../social/domain/relationshipProfile.ts';
import type {
  RelationshipEvent,
  RelationshipFormationSource,
} from '../../social/domain/types.ts';

interface HeroStoreState {
  version: typeof GAME_SAVE_VERSION;
  roster: HeroInstance[];
  formation: PartyFormation;
  crystals: number;
  teamStrategy: TeamStrategy;
  leaderId: string | null;
  assignHero: (heroId: string, slot: FormationSlot) => { ok: true } | { ok: false; error: string };
  removeHero: (slot: FormationSlot) => void;
  summon: (count: SummonCount) => Promise<SummonTransactionResult>;
  setTeamStrategy: (strategy: TeamStrategy) => void;
  commitLearningExperience: (experience: CombatExperience) => LearningCommitResult;
  commitCombatMemory: (source: MemoryFormationSource) => MemoryCommitResult;
  setPartyLeader: (leaderId: string | null) => { ok: true } | { ok: false; error: string };
  commitRelationshipExperience: (source: RelationshipFormationSource) => RelationshipCommitResult;
}

export interface LearningCommitResult {
  applied: boolean;
  duplicate: boolean;
  updates: readonly LearningUpdate[];
}

export interface MemoryCommitResult {
  applied: boolean;
  duplicate: boolean;
  createdMemories: readonly EpisodicMemory[];
}

export interface RelationshipCommitResult {
  applied: boolean;
  duplicate: boolean;
  events: readonly RelationshipEvent[];
}

const STORAGE_KEY = 'rawgrim-hero-state';

const fallbackState: Pick<HeroStoreState, 'version' | 'roster' | 'formation' | 'crystals' | 'teamStrategy' | 'leaderId'> = {
  version: GAME_SAVE_VERSION,
  roster: initialHeroRoster,
  formation: initialPartyFormation,
  crystals: mockResources.crystals,
  teamStrategy: 'Balanced',
  leaderId: null,
};

let summonCoordinator: SummonCoordinator | null = null;

function createHeroInstanceId(): string {
  return `hero-${crypto.randomUUID()}`;
}

function createSafeBrowserStorage() {
  return {
    getItem: (name: string): string | null => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        localStorage.setItem(name, value);
      } catch {
        // Summons perform a throwing pre-write before committing. Other state
        // updates retain their in-memory value when browser storage is unavailable.
      }
    },
    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(name);
      } catch {
        // A blocked storage backend is treated as unavailable.
      }
    },
  };
}

export const useHeroStore = create<HeroStoreState>()(
  persist(
    (set, get) => ({
      ...fallbackState,
      assignHero: (heroId, slot) => {
        const hero = get().roster.find((candidate) => candidate.id === heroId);
        if (!hero) return { ok: false, error: 'Hero not found' };
        try {
          const current = get();
          const replacedHeroId = current.formation[slot.line][slot.index];
          const formation = assignHeroToSlot(current.formation, hero, slot);
          set({
            formation,
            leaderId: replacedHeroId === current.leaderId ? null : current.leaderId,
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : 'Assignment failed' };
        }
      },
      removeHero: (slot) => set((state) => {
        const removedHeroId = state.formation[slot.line][slot.index];
        return {
          formation: removeHeroFromSlot(state.formation, slot),
          leaderId: removedHeroId === state.leaderId ? null : state.leaderId,
        };
      }),
      summon: (count) => getSummonCoordinator().execute(
        count,
        GACHA_CONFIG,
        heroDefinitions,
        Math.random,
        createHeroInstanceId,
      ),
      setTeamStrategy: (teamStrategy) => set({ teamStrategy }),
      setPartyLeader: (leaderId) => {
        const validation = validateLeaderAssignment(leaderId, get().roster, get().formation);
        if (!validation.valid) return { ok: false, error: validation.error };
        set({ leaderId });
        return { ok: true };
      },
      commitLearningExperience: (experience) => {
        if (!experience.eligibleForLearning || experience.outcome === 'ongoing') {
          return { applied: false, duplicate: false, updates: [] };
        }
        const updates: LearningUpdate[] = [];
        let sawRelevantHero = false;
        let allRelevantHeroesDuplicate = true;
        let changed = false;
        const roster = get().roster.map((hero) => {
          const observations = experience.observations.filter((item) => item.heroInstanceId === hero.id);
          if (observations.length === 0) return hero;
          sawRelevantHero = true;
          const definition = heroDefinitions.find((candidate) => candidate.id === hero.definitionId);
          const result = applyCombatExperience(
            ensureHeroPersonality(hero, definition),
            { ...experience, observations },
          );
          if (result.duplicate) return hero;
          allRelevantHeroesDuplicate = false;
          changed = true;
          updates.push(...result.updates);
          return { ...hero, personality: result.personality };
        });
        if (changed) set({ roster });
        return {
          applied: changed,
          duplicate: sawRelevantHero && allRelevantHeroesDuplicate,
          updates,
        };
      },
      commitCombatMemory: (source) => {
        const hero = get().roster.find((candidate) => candidate.id === source.heroInstanceId);
        if (!hero) return { applied: false, duplicate: false, createdMemories: [] };
        const result = formHeroMemories(normalizeMemoryProfile(hero.memory, hero.id), source);
        if (result.duplicate || !source.eligibleForPersistence || source.finalState.result.outcome === 'ongoing') {
          return { applied: false, duplicate: result.duplicate, createdMemories: [] };
        }
        set((state) => ({
          roster: state.roster.map((candidate) => candidate.id === hero.id
            ? { ...candidate, memory: result.profile }
            : candidate),
        }));
        return {
          applied: true,
          duplicate: false,
          createdMemories: result.createdMemories,
        };
      },
      commitRelationshipExperience: (source) => {
        const roster = get().roster;
        const validHeroIds = new Set(roster.map((hero) => hero.id));
        const result = formPartyRelationships(roster.map((hero) => ({
          instanceId: hero.id,
          personality: ensureHeroPersonality(
            hero,
            heroDefinitions.find((definition) => definition.id === hero.definitionId),
          ),
          memoryProfile: hero.memory,
          relationshipProfile: normalizeRelationshipProfile(hero.relationships, hero.id, validHeroIds),
        })), source);
        if (result.duplicate || !source.eligibleForPersistence || source.finalState.result.outcome === 'ongoing') {
          return { applied: false, duplicate: result.duplicate, events: [] };
        }
        const profiles = new Map(result.profiles.map((profile) => [profile.ownerHeroId, profile]));
        set({ roster: roster.map((hero) => ({ ...hero, relationships: profiles.get(hero.id) ?? hero.relationships })) });
        return { applied: true, duplicate: false, events: result.events };
      },
    }),
    {
      name: STORAGE_KEY,
      version: GAME_SAVE_VERSION,
      storage: createJSONStorage(createSafeBrowserStorage),
      partialize: ({ version, roster, formation, crystals, teamStrategy, leaderId }) => ({
        version, roster, formation, crystals, teamStrategy, leaderId,
      }),
      migrate: (persisted, persistedVersion) =>
        migrateGameState(persisted, persistedVersion, mockResources.crystals) ?? fallbackState,
      merge: (persisted, current) => {
        const parsed = parsePersistedGameState(persisted);
        return parsed ? { ...current, ...parsed } : current;
      },
    },
  ),
);

function getSummonCoordinator(): SummonCoordinator {
  if (summonCoordinator) return summonCoordinator;
  summonCoordinator = createSummonCoordinator({
    read: () => {
      const { crystals, roster } = useHeroStore.getState();
      return { crystals, roster };
    },
    persist: async ({ crystals, roster }) => {
      const { formation, teamStrategy, leaderId } = useHeroStore.getState();
      const persisted: PersistedGameState = {
        version: GAME_SAVE_VERSION,
        crystals,
        roster,
        formation,
        teamStrategy,
        leaderId,
      };
      localStorage.setItem(STORAGE_KEY, createGameSaveEnvelope(persisted));
    },
    commit: ({ crystals, roster }) => useHeroStore.setState({ crystals, roster }),
  });
  return summonCoordinator;
}
