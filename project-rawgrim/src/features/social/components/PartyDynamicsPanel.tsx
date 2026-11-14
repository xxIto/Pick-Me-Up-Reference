import { AlertTriangle, Crown } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, ProgressBar } from '../../../components/ui/index.tsx';
import { heroDefinitions } from '../../heroes/data/heroDefinitions.ts';
import { getAssignedHeroIds } from '../../heroes/domain/heroRules.ts';
import { useHeroStore } from '../../heroes/store/heroStore.ts';
import { calculateLeadershipEffectiveness } from '../domain/leadership.ts';
import { evaluatePartyChemistry } from '../domain/partyChemistry.ts';

export function PartyDynamicsPanel() {
  const roster = useHeroStore((state) => state.roster);
  const formation = useHeroStore((state) => state.formation);
  const leaderId = useHeroStore((state) => state.leaderId);
  const setPartyLeader = useHeroStore((state) => state.setPartyLeader);
  const [error, setError] = useState<string | null>(null);
  const deployedIds = getAssignedHeroIds(formation);
  const eligibleLeaders = roster.filter((hero) =>
    deployedIds.includes(hero.id) && hero.status !== 'Dead' && hero.currentHp > 0);
  const leadership = calculateLeadershipEffectiveness(leaderId, roster, formation);
  const chemistry = evaluatePartyChemistry(roster, formation, leaderId);
  const leaderName = leaderId
    ? heroDefinitions.find((definition) => definition.id === roster.find((hero) => hero.id === leaderId)?.definitionId)?.name
    : null;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Crown size={17} className="text-[#D6B36A]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Party Dynamics</h3>
          </div>
          <p className="mt-1 text-xs text-[#5f5875]">Leadership affects strategy adherence, never direct control.</p>
        </div>
        <label className="text-xs text-[#918BA5]">
          Party Leader
          <select
            value={leaderId ?? ''}
            onChange={(event) => {
              const result = setPartyLeader(event.target.value || null);
              setError(result.ok ? null : result.error);
            }}
            className="ml-2 rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-xs text-[#F4F1FA] outline-none focus:border-violet-500"
          >
            <option value="">No leader</option>
            {eligibleLeaders.map((hero) => {
              const name = heroDefinitions.find((definition) => definition.id === hero.definitionId)?.name ?? hero.id;
              return <option key={hero.id} value={hero.id}>{name}</option>;
            })}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { label: 'Cohesion', value: chemistry.cohesion, color: 'violet' },
          { label: 'Coordination', value: chemistry.coordination, color: 'emerald' },
          { label: 'Conflict Risk', value: chemistry.conflictRisk, color: 'rose' },
          { label: 'Leadership Stability', value: chemistry.leadershipStability, color: 'gold' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide">
              <span className="text-[#918BA5]">{label}</span>
              <span className="font-bold text-[#F4F1FA]">{value}</span>
            </div>
            <ProgressBar value={value} max={100} color={color} height="xs" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge label={leaderName ? `${leaderName} · ${leadership.score}` : 'No active leader'} variant={leadership.active ? 'rarity-4' : 'class'} />
        {chemistry.conflictRisk >= 50 && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-300">
            <AlertTriangle size={13} /> Relationship conflict may reduce coordination.
          </span>
        )}
      </div>
    </Card>
  );
}
