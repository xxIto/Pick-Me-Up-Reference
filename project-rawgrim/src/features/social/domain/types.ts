import type { CombatState } from '../../combat/domain/types.ts';
import type { HeroMemoryProfile } from '../../memory/domain/types.ts';
import type { HeroPersonalityState } from '../../heroes/domain/personalityTypes.ts';
import type { CombatExperience } from '../../learning/domain/types.ts';

export const RELATIONSHIP_EVENT_TYPES = [
  'shared-battle',
  'meaningful-rescue',
  'reckless-action',
  'major-victory',
  'shared-defeat',
  'ally-loss',
] as const;
export type RelationshipEventType = (typeof RELATIONSHIP_EVENT_TYPES)[number];

export interface RelationshipDimensions {
  familiarity: number;
  trust: number;
  respect: number;
  affection: number;
  rivalry: number;
  resentment: number;
}

export type RelationshipChange = Partial<RelationshipDimensions> & {
  sharedExperienceCount?: number;
};

export interface RelationshipEvent {
  id: string;
  sourceId: string;
  type: RelationshipEventType;
  ownerHeroId: string;
  targetHeroId: string;
  sessionId: string;
  round: number;
  changes: RelationshipChange;
  memoryIds: readonly string[];
  description: string;
  eventOrder: number;
}

export interface HeroRelationship extends RelationshipDimensions {
  targetHeroId: string;
  sharedExperienceCount: number;
  history: readonly RelationshipEvent[];
}

export type RelationshipSourceBits = [number, number, number, number, number, number, number, number];

export interface RelationshipProfile {
  version: 1;
  ownerHeroId: string;
  relationships: readonly HeroRelationship[];
  processedSourceBits: RelationshipSourceBits;
  nextEventOrder: number;
}

export interface RelationshipConfiguration {
  maximumRelationships: number;
  maximumHistoryPerRelationship: number;
  minimumSharedBattleThreat: number;
  maximumRelationshipUtility: number;
  maximumLeadershipUtility: number;
}

export type RelationshipConfigurationValidation =
  | { valid: true }
  | { valid: false; errors: readonly string[] };

export interface RelationshipFormationHero {
  instanceId: string;
  personality: HeroPersonalityState;
  memoryProfile?: HeroMemoryProfile;
  relationshipProfile: RelationshipProfile;
}

export interface RelationshipFormationSource {
  sessionId: string;
  finalState: CombatState;
  experience: CombatExperience;
  eligibleForPersistence: boolean;
}

export interface RelationshipFormationResult {
  profiles: readonly RelationshipProfile[];
  events: readonly RelationshipEvent[];
  duplicate: boolean;
}

export interface LeadershipComponents {
  discipline: number;
  courage: number;
  resolve: number;
  experience: number;
  incomingTrust: number;
  incomingRespect: number;
}

export interface LeadershipEvaluation {
  active: boolean;
  leaderId: string | null;
  score: number;
  components: LeadershipComponents;
  explanations: readonly string[];
}

export interface PartyChemistry {
  cohesion: number;
  coordination: number;
  conflictRisk: number;
  leadershipStability: number;
  explanations: readonly string[];
}

export interface SocialDecisionContext {
  actorRelationshipProfile: RelationshipProfile;
  leaderId: string | null;
  leadership: LeadershipEvaluation;
  chemistry: PartyChemistry;
}

export interface SocialContribution {
  relationshipContribution: number;
  leadershipContribution: number;
  explanations: readonly string[];
}
