export const TEAM_STRATEGIES = ['Aggressive', 'Balanced', 'Defensive'] as const;
export type TeamStrategy = (typeof TEAM_STRATEGIES)[number];

export interface PersonalityDimensions {
  courage: number;
  discipline: number;
  aggression: number;
  empathy: number;
  selfPreservation: number;
  ambition: number;
  trust: number;
}

export interface LearnedPreferences {
  offense: number;
  healing: number;
  defense: number;
  activeSkill: number;
}

export interface EmotionalState {
  fear: number;
  anger: number;
  resolve: number;
}

export interface HeroPersonalityState {
  identityId: string;
  innateTraitId: string;
  innate: PersonalityDimensions;
  learned: LearnedPreferences;
  emotion: EmotionalState;
}
