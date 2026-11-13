import type { CombatAction, CombatState } from '../../combat/domain/types.ts';
import type {
  HeroPersonalityState,
  TeamStrategy,
} from '../../heroes/domain/personalityTypes.ts';

export interface DecisionContext {
  personality: HeroPersonalityState;
  teamStrategy: TeamStrategy;
}

export interface CandidateUtility {
  action: CombatAction;
  baseUtility: number;
  personalityContribution: number;
  teamStrategyContribution: number;
  learnedPreferenceContribution: number;
  finalUtility: number;
  summary: string;
}

export interface DecisionTrace {
  heroInstanceId: string;
  selectedAction: CombatAction;
  selectedTargetId: string;
  candidates: readonly CandidateUtility[];
  reason: string;
}

export interface AutonomousStepResult {
  state: CombatState;
  decision: DecisionTrace | null;
}

export type DecisionContextResolver = (heroInstanceId: string) => DecisionContext;
