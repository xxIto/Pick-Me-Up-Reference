import { useMemo, useState } from 'react';
import { Shield, Target, UserPlus, X } from 'lucide-react';
import { Button, Card, HeroCard } from '../../../components/ui/index.tsx';
import { heroDefinitions } from '../data/heroDefinitions.ts';
import { getAssignedHeroIds } from '../domain/heroRules.ts';
import { resolveHero } from '../domain/roster.ts';
import type { FormationLine, FormationSlot, ResolvedHero } from '../domain/types.ts';
import { TEAM_STRATEGIES } from '../domain/personalityTypes.ts';
import type { TeamStrategy } from '../domain/personalityTypes.ts';
import { useHeroStore } from '../store/heroStore.ts';
import { PartyDynamicsPanel } from '../../social/components/PartyDynamicsPanel.tsx';

interface FormationRowProps {
  line: FormationLine;
  label: string;
  description: string;
  icon: React.ReactNode;
  heroesById: ReadonlyMap<string, ResolvedHero>;
  availableHeroes: readonly ResolvedHero[];
  onAssign: (heroId: string, slot: FormationSlot) => void;
}

function FormationRow({
  line,
  label,
  description,
  icon,
  heroesById,
  availableHeroes,
  onAssign,
}: FormationRowProps) {
  const formation = useHeroStore((state) => state.formation);
  const removeHero = useHeroStore((state) => state.removeHero);

  return (
    <section aria-labelledby={`${line}-heading`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-violet-400">{icon}</span>
        <div>
          <h3 id={`${line}-heading`} className="text-sm font-bold text-[#F4F1FA]">{label}</h3>
          <p className="text-xs text-[#918BA5]">{description}</p>
        </div>
      </div>
      <div className={`grid gap-3 ${line === 'frontline' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {formation[line].map((heroId, index) => {
          const hero = heroId ? heroesById.get(heroId) : undefined;
          return (
            <Card key={`${line}-${index}`} className="min-h-40 border-dashed p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5f5875]">
                  {label} {index + 1}
                </span>
                {hero && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHero({ line, index })}
                    aria-label={`Remove ${hero.definition.name}`}
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
              {hero ? (
                <HeroCard hero={hero} size="sm" />
              ) : (
                <div className="flex min-h-28 flex-col items-center justify-center gap-3 text-center">
                  <UserPlus size={22} className="text-[#4a4560]" />
                  <select
                    aria-label={`Assign hero to ${label} ${index + 1}`}
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value) onAssign(event.target.value, { line, index });
                      event.target.value = '';
                    }}
                    className="w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-xs text-[#F4F1FA] outline-none focus:border-violet-500"
                  >
                    <option value="">Assign hero…</option>
                    {availableHeroes.map(({ instance, definition }) => (
                      <option key={instance.id} value={instance.id}>
                        {definition.name} · Lv{instance.level} · {definition.class}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function PartyFormationPanel() {
  const roster = useHeroStore((state) => state.roster);
  const formation = useHeroStore((state) => state.formation);
  const assignHero = useHeroStore((state) => state.assignHero);
  const teamStrategy = useHeroStore((state) => state.teamStrategy);
  const setTeamStrategy = useHeroStore((state) => state.setTeamStrategy);
  const [error, setError] = useState<string | null>(null);

  const resolvedHeroes = useMemo(
    () => roster.flatMap((instance) => {
      const hero = resolveHero(instance, heroDefinitions);
      return hero ? [hero] : [];
    }),
    [roster],
  );
  const heroesById = useMemo(
    () => new Map(resolvedHeroes.map((hero) => [hero.instance.id, hero])),
    [resolvedHeroes],
  );
  const assignedIds = new Set(getAssignedHeroIds(formation));
  const availableHeroes = resolvedHeroes.filter(
    ({ instance }) => !assignedIds.has(instance.id) && instance.status !== 'Dead' && instance.currentHp > 0,
  );

  const handleAssign = (heroId: string, slot: FormationSlot) => {
    const result = assignHero(heroId, slot);
    setError(result.ok ? null : result.error);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5" glow>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#F4F1FA]">Battle Formation</h2>
            <p className="text-xs text-[#918BA5]">Three frontline defenders and two backline specialists.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#918BA5]" htmlFor="team-strategy">Strategy</label>
            <select
              id="team-strategy"
              value={teamStrategy}
              onChange={(event) => setTeamStrategy(event.target.value as TeamStrategy)}
              className="rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-xs text-[#F4F1FA] outline-none focus:border-violet-500"
            >
              {TEAM_STRATEGIES.map((strategy) => <option key={strategy}>{strategy}</option>)}
            </select>
            <span className="text-xs font-semibold text-[#D6B36A]">{assignedIds.size} / 5 deployed</span>
          </div>
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <PartyDynamicsPanel />

      <FormationRow
        line="frontline"
        label="Frontline"
        description="Holds pressure and protects the rear ranks."
        icon={<Shield size={18} />}
        heroesById={heroesById}
        availableHeroes={availableHeroes}
        onAssign={handleAssign}
      />
      <FormationRow
        line="backline"
        label="Backline"
        description="Delivers ranged damage and support."
        icon={<Target size={18} />}
        heroesById={heroesById}
        availableHeroes={availableHeroes}
        onAssign={handleAssign}
      />
    </div>
  );
}
