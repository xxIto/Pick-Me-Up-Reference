import { calculateDerivedStats } from './heroRules.ts';
import type {
  HeroDefinition,
  HeroInstance,
  ResolvedHero,
  RosterQuery,
} from './types.ts';

export function resolveHero(
  instance: HeroInstance,
  definitions: readonly HeroDefinition[],
): ResolvedHero | null {
  const definition = definitions.find((candidate) => candidate.id === instance.definitionId);
  if (!definition) return null;
  return { instance, definition, stats: calculateDerivedStats(definition, instance.level) };
}

export function filterAndSortRoster(
  roster: readonly HeroInstance[],
  definitions: readonly HeroDefinition[],
  query: RosterQuery,
): ResolvedHero[] {
  const normalizedSearch = query.search.trim().toLocaleLowerCase();

  return roster
    .map((instance) => resolveHero(instance, definitions))
    .filter((hero): hero is ResolvedHero => hero !== null)
    .filter(({ definition }) =>
      normalizedSearch.length === 0
        ? true
        : definition.name.toLocaleLowerCase().includes(normalizedSearch),
    )
    .filter(({ definition }) => query.heroClass === 'All' || definition.class === query.heroClass)
    .filter(({ definition }) => query.rarity === 'All' || definition.rarity === query.rarity)
    .sort((left, right) => {
      if (query.sortBy === 'level') return right.instance.level - left.instance.level;
      if (query.sortBy === 'rarity') return right.definition.rarity - left.definition.rarity;
      return left.definition.name.localeCompare(right.definition.name);
    });
}
