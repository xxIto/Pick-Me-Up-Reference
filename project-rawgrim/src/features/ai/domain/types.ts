import type { CombatAction, CombatState } from '../../combat/domain/types.ts';
import type {
  HeroPersonalityState,
  TeamStrategy,
} from '../../heroes/domain/personalityTypes.ts';
import type { HeroMemoryProfile, MemoryContribution } from '../../memory/domain/types.ts';
import type { SocialDecisionContext } from '../../social/domain/types.ts';

export interface DecisionContext {
  personality: HeroPersonalityState;
  teamStrategy: TeamStrategy;
  memoryProfile?: HeroMemoryProfile;
  social?: SocialDecisionContext;
}

export interface CandidateUtility {
  action: CombatAction;
  baseUtility: number;
  personalityContribution: number;
  teamStrategyContribution: number;
  learnedPreferenceContribution: number;
  memoryContribution: number;
  recalledMemories: readonly MemoryContribution[];
  relationshipContribution: number;
  leadershipContribution: number;
  socialExplanations: readonly string[];
  utilityWithoutSocial: number;
  finalUtility: number;
  summary: string;
}

export interface DecisionTrace {
  heroInstanceId: string;
  selectedAction: CombatAction;
  selectedTargetId: string;
  candidates: readonly CandidateUtility[];
  recalledMemories: readonly MemoryContribution[];
  socialExplanations: readonly string[];
  socialChangedSelection: boolean;
  reason: string;
}

export interface AutonomousStepResult {
  state: CombatState;
  decision: DecisionTrace | null;
}

export type DecisionContextResolver = (heroInstanceId: string) => DecisionContext;
