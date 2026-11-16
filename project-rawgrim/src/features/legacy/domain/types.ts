import type { CombatDamageType, CombatOutcome, CombatState } from '../../combat/domain/types.ts';
import type { HeroClass, HeroDefinition, HeroInstance, HeroRarity, PartyFormation } from '../../heroes/domain/types.ts';
import type { HeroPersonalityState } from '../../heroes/domain/personalityTypes.ts';
import type { CombatExperience } from '../../learning/domain/types.ts';
import type { EpisodicMemory } from '../../memory/domain/types.ts';
import type { HeroRelationship } from '../../social/domain/types.ts';

export const SURVIVOR_RESPONSES = ['grief', 'fear', 'anger', 'resolve', 'numbness', 'restrained'] as const;
export type SurvivorResponse = (typeof SURVIVOR_RESPONSES)[number];

export interface SurvivorResponseScores {
  grief: number;
  fear: number;
  anger: number;
  resolve: number;
  numbness: number;
  guilt: 0;
}

export interface EmotionDelta {
  fear: number;
  anger: number;
  resolve: number;
}

export interface SurvivorExperience {
  id: string;
  resolutionId: string;
  fallenHeroId: string;
  dominantResponse: SurvivorResponse;
  intensity: number;
  scores: SurvivorResponseScores;
  emotionDelta: EmotionDelta;
  evidence: readonly string[];
  eventOrder: number;
}

export interface SurvivorConsequenceProfile {
  version: 1;
  ownerHeroId: string;
  experiences: readonly SurvivorExperience[];
  processedDeathIds: readonly string[];
  processedRecoveryIds: readonly string[];
  nextEventOrder: number;
}

export type MemorialProvenance = 'official-resolution' | 'legacy-import';
export type HistoricalGap = 'death-context' | 'expedition-history' | 'achievements' | 'attacker';

export interface MemorialDefinitionSnapshot {
  name: string;
  heroClass: HeroClass;
  rarity: HeroRarity;
  portrait: { initials: string; gradient: string };
}

export interface VerifiedDeathContext {
  known: boolean;
  expeditionId: string | null;
  battleId: string | null;
  encounterId: string | null;
  encounterLabel: string | null;
  seed: number | null;
  rulesVersion: string | null;
  outcome: Exclude<CombatOutcome, 'ongoing'> | null;
  round: number | null;
  attackerSourceId: string | null;
  observedDamageTypes: readonly CombatDamageType[];
  participantHeroIds: readonly string[];
}

export interface MemorialAchievement {
  id: string;
  title: string;
  sourceId: string;
}

export interface MemorialExpeditionParticipation {
  expeditionId: string;
  encounterId: string;
  outcome: Exclude<CombatOutcome, 'ongoing'>;
}

export interface HeroMemorialRecord {
  id: string;
  heroInstanceId: string;
  definitionId: string;
  definition: MemorialDefinitionSnapshot;
  finalLevel: number;
  finalExperience: number;
  personality: HeroPersonalityState;
  significantMemories: readonly EpisodicMemory[];
  importantRelationships: readonly HeroRelationship[];
  achievements: readonly MemorialAchievement[];
  expeditions: readonly MemorialExpeditionParticipation[];
  deathContext: VerifiedDeathContext;
  provenance: MemorialProvenance;
  historicalGaps: readonly HistoricalGap[];
  memorialOrder: number;
  resolutionId: string | null;
}

export interface OfficialDeathResolutionRequest {
  authorization: 'official-expedition';
  finalized: boolean;
  expeditionId: string;
  battleId: string;
  resolutionId: string;
  encounterId: string;
  encounterLabel?: string;
  rulesVersion: string;
  participantHeroIds: readonly string[];
  leaderIdSnapshot: string | null;
  finalState: CombatState;
  experience: CombatExperience;
}

export interface LegacyResolutionState {
  roster: HeroInstance[];
  formation: PartyFormation;
  leaderId: string | null;
  memorials: HeroMemorialRecord[];
  processedLegacyResolutionIds: string[];
}

export type DeathResolutionResult =
  | { ok: false; errors: readonly string[] }
  | {
      ok: true;
      duplicate: true;
      state: LegacyResolutionState;
      memorials: readonly HeroMemorialRecord[];
    }
  | {
      ok: true;
      duplicate: false;
      state: LegacyResolutionState;
      memorials: readonly HeroMemorialRecord[];
    };

export type HeroDefinitionCatalog = readonly HeroDefinition[];

export const MAX_SURVIVOR_EXPERIENCES = 20;
export const MAX_PROCESSED_DEATH_IDS = 40;
export const MAX_PROCESSED_RECOVERY_IDS = 20;
export const MAX_IMPORTANT_RELATIONSHIPS = 10;
export const MAX_PROCESSED_LEGACY_RESOLUTIONS = 128;
