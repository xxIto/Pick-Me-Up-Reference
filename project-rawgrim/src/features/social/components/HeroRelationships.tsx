import { Badge, Card, ProgressBar } from '../../../components/ui/index.tsx';
import type { HeroInstance } from '../../heroes/domain/types.ts';
import { heroDefinitions } from '../../heroes/data/heroDefinitions.ts';
import { createEmptyRelationshipProfile, normalizeRelationshipProfile } from '../domain/relationshipProfile.ts';

function signedLabel(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function HeroRelationships({ hero, roster }: { hero: HeroInstance; roster: readonly HeroInstance[] }) {
  const validIds = new Set(roster.map((entry) => entry.id));
  const profile = hero.relationships
    ? normalizeRelationshipProfile(hero.relationships, hero.id, validIds)
    : createEmptyRelationshipProfile(hero.id);
  const names = new Map(roster.map((entry) => [
    entry.id,
    heroDefinitions.find((definition) => definition.id === entry.definitionId)?.name ?? entry.id,
  ]));

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Relationships</h2>
      <p className="mt-1 text-xs text-[#5f5875]">Directional feelings and shared experiences from this hero's perspective.</p>
      {profile.relationships.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-[#2e2a44] bg-[#0f0d1f] p-6 text-center">
          <p className="text-sm font-semibold text-[#918BA5]">No significant teammate history recorded.</p>
          <p className="mt-1 text-xs text-[#5f5875]">Eligible completed encounters can establish familiarity and trust.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {profile.relationships.map((relationship) => (
            <article key={relationship.targetHeroId} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#F4F1FA]">{names.get(relationship.targetHeroId)}</h3>
                  <p className="text-[10px] text-[#5f5875]">{relationship.sharedExperienceCount} shared encounters</p>
                </div>
                <Badge label={`Familiarity ${relationship.familiarity}`} variant="class" />
              </div>
              <ProgressBar value={relationship.familiarity} max={100} color="violet" height="xs" className="mt-3" />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                {[
                  ['Trust', relationship.trust], ['Respect', relationship.respect],
                  ['Affection', relationship.affection], ['Rivalry', relationship.rivalry],
                  ['Resentment', relationship.resentment],
                ].map(([label, value]) => (
                  <div key={label} className="rounded bg-[#151126] px-2 py-1.5">
                    <p className="text-[#5f5875]">{label}</p>
                    <p className="font-bold text-[#B8B1C9]">{signedLabel(value as number)}</p>
                  </div>
                ))}
              </div>
              {relationship.history.length > 0 && (
                <div className="mt-3 border-t border-[#211d33] pt-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#5f5875]">Significant events</p>
                  {[...relationship.history].reverse().slice(0, 3).map((event) => (
                    <p key={event.id} className="mt-1 text-[10px] leading-4 text-[#918BA5]">
                      #{event.eventOrder} · {event.description}
                    </p>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
