import type { CombatAction, CombatState } from '../../combat/domain/types.ts';
import type {
  HeroPersonalityState,
  TeamStrategy,
} from '../../heroes/domain/personalityTypes.ts';
import type { HeroMemoryProfile, MemoryContribution } from '../../memory/domain/types.ts';

export interface DecisionContext {
  personality: HeroPersonalityState;
  teamStrategy: TeamStrategy;
  memoryProfile?: HeroMemoryProfile;
}

export interface CandidateUtility {
  action: CombatAction;
  baseUtility: number;
  personalityContribution: number;
  teamStrategyContribution: number;
  learnedPreferenceContribution: number;
  memoryContribution: number;
  recalledMemories: readonly MemoryContribution[];
  finalUtility: number;
  summary: string;
}

export interface DecisionTrace {
  heroInstanceId: string;
  selectedAction: CombatAction;
  selectedTargetId: string;
  candidates: readonly CandidateUtility[];
  recalledMemories: readonly MemoryContribution[];
  reason: string;
}

export interface AutonomousStepResult {
  state: CombatState;
  decision: DecisionTrace | null;
}

export type DecisionContextResolver = (heroInstanceId: string) => DecisionContext;
