import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { initialHeroRoster, initialPartyFormation } from '../data/initialRoster.ts';
import { assignHeroToSlot, removeHeroFromSlot } from '../domain/heroRules.ts';
import { HERO_SAVE_VERSION, parsePersistedHeroState } from '../domain/persistence.ts';
import type { FormationSlot, HeroInstance, PartyFormation } from '../domain/types.ts';

interface HeroStoreState {
  version: typeof HERO_SAVE_VERSION;
  roster: HeroInstance[];
  formation: PartyFormation;
  assignHero: (heroId: string, slot: FormationSlot) => { ok: true } | { ok: false; error: string };
  removeHero: (slot: FormationSlot) => void;
}

const fallbackState: Pick<HeroStoreState, 'version' | 'roster' | 'formation'> = {
  version: HERO_SAVE_VERSION,
  roster: initialHeroRoster,
  formation: initialPartyFormation,
};

export const useHeroStore = create<HeroStoreState>()(
  persist(
    (set, get) => ({
      ...fallbackState,
      assignHero: (heroId, slot) => {
        const hero = get().roster.find((candidate) => candidate.id === heroId);
        if (!hero) return { ok: false, error: 'Hero not found' };
        try {
          const formation = assignHeroToSlot(get().formation, hero, slot);
          set({ formation });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : 'Assignment failed' };
        }
      },
      removeHero: (slot) => set((state) => ({
        formation: removeHeroFromSlot(state.formation, slot),
      })),
    }),
    {
      name: 'rawgrim-hero-state',
      version: HERO_SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ version, roster, formation }) => ({ version, roster, formation }),
      migrate: () => fallbackState,
      merge: (persisted, current) => {
        const parsed = parsePersistedHeroState(persisted);
        return parsed ? { ...current, ...parsed } : current;
      },
    },
  ),
);
