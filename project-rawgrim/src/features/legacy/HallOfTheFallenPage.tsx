import { BookHeart, Skull } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card } from '../../components/ui/index.tsx';
import { useHeroStore } from '../heroes/store/heroStore.ts';

export function HallOfTheFallenPage() {
  const memorials = useHeroStore((state) => state.memorials);
  const ordered = [...memorials].sort((left, right) => right.memorialOrder - left.memorialOrder);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-start gap-4">
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-3 text-rose-300">
          <Skull size={24} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D6B36A]">Permanent Chronicle</p>
          <h1 className="mt-1 text-2xl font-bold text-[#F4F1FA] sm:text-3xl">Hall of the Fallen</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#918BA5]">
            The identities preserved here cannot return to active service. Unknown history remains explicitly unknown.
          </p>
        </div>
      </header>

      {ordered.length === 0 ? (
        <Card className="p-10 text-center">
          <BookHeart size={30} className="mx-auto text-[#5f5875]" />
          <h2 className="mt-4 font-semibold text-[#F4F1FA]">No memorials recorded</h2>
          <p className="mt-2 text-sm text-[#918BA5]">Official expeditions have not claimed a hero.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((memorial) => (
            <Link key={memorial.id} to={`/fallen/${encodeURIComponent(memorial.id)}`}>
              <Card className="h-full overflow-hidden transition hover:-translate-y-0.5 hover:border-rose-900/60">
                <div className="flex min-h-32 items-center justify-center" style={{ background: memorial.definition.portrait.gradient }}>
                  <span className="text-3xl font-black tracking-widest text-white/80">{memorial.definition.portrait.initials}</span>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge label={memorial.definition.heroClass} variant="class" />
                    <Badge label={`${memorial.definition.rarity}★`} variant={`rarity-${memorial.definition.rarity}`} />
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-[#F4F1FA]">{memorial.definition.name}</h2>
                  <p className="mt-1 text-xs text-[#918BA5]">Final level {memorial.finalLevel}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-rose-300">
                    {memorial.provenance === 'legacy-import' ? 'Legacy record · history unknown' : 'Verified official loss'}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
