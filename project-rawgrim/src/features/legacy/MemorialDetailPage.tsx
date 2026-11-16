import { ArrowLeft, BookOpen, ShieldAlert, Skull } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Card } from '../../components/ui/index.tsx';
import { useHeroStore } from '../heroes/store/heroStore.ts';

export function MemorialDetailPage() {
  const { memorialId } = useParams();
  const memorial = useHeroStore((state) => state.memorials.find((entry) => entry.id === memorialId));
  if (!memorial) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#F4F1FA]">Memorial not found</h1>
        <Link to="/fallen" className="mt-5 inline-block text-sm text-violet-400">Return to the Hall</Link>
      </div>
    );
  }
  const death = memorial.deathContext;
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link to="/fallen" className="inline-flex items-center gap-2 text-sm text-[#918BA5] hover:text-[#F4F1FA]">
        <ArrowLeft size={15} /> Back to Hall of the Fallen
      </Link>
      <Card className="overflow-hidden" glow>
        <div className="grid md:grid-cols-[260px_1fr]">
          <div className="flex min-h-64 items-center justify-center" style={{ background: memorial.definition.portrait.gradient }}>
            <span className="text-5xl font-black tracking-widest text-white/80">{memorial.definition.portrait.initials}</span>
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap gap-2">
              <Badge label={memorial.definition.heroClass} variant="class" />
              <Badge label={`${memorial.definition.rarity}★`} variant={`rarity-${memorial.definition.rarity}`} />
              <Badge label="Fallen" variant="status-Dead" />
            </div>
            <h1 className="mt-4 text-3xl font-bold text-[#F4F1FA]">{memorial.definition.name}</h1>
            <p className="mt-2 text-sm text-[#918BA5]">Level {memorial.finalLevel} · Instance {memorial.heroInstanceId}</p>
            <p className="mt-5 border-l-2 border-[#D6B36A]/60 pl-4 text-sm leading-6 text-[#B8B1C9]">
              This record preserves observed identity and history. It does not invent what the game never witnessed.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#F4F1FA]"><Skull size={15} /> Verified death context</h2>
          {death.known ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[
                ['Encounter', death.encounterLabel ?? death.encounterId ?? 'Unknown'],
                ['Outcome', death.outcome ?? 'Unknown'],
                ['Final round', death.round ?? 'Unknown'],
                ['Observed attacker', death.attackerSourceId ?? 'Unknown'],
                ['Battle', death.battleId ?? 'Unknown'],
                ['Rules', death.rulesVersion ?? 'Unknown'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
                  <dt className="text-[10px] uppercase tracking-wide text-[#5f5875]">{label}</dt>
                  <dd className="mt-1 text-[#D9D4E6]">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-200">
              Death context is unknown. This memorial was imported from an older save.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#F4F1FA]"><ShieldAlert size={15} /> Historical gaps</h2>
          <div className="mt-4 space-y-2">
            {memorial.historicalGaps.length === 0 ? (
              <p className="text-sm text-[#918BA5]">No known structured gaps.</p>
            ) : memorial.historicalGaps.map((gap) => (
              <div key={gap} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] px-3 py-2 text-sm capitalize text-[#B8B1C9]">
                {gap.replace('-', ' ')}: Unknown
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#F4F1FA]"><BookOpen size={15} /> Significant memories</h2>
        <div className="mt-4 space-y-3">
          {memorial.significantMemories.length === 0 ? (
            <p className="text-sm text-[#918BA5]">No significant memories were available.</p>
          ) : memorial.significantMemories.map((memory) => (
            <div key={memory.id} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
              <p className="font-semibold text-[#F4F1FA]">{memory.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#918BA5]">{memory.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
