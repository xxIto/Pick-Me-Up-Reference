import { useState } from 'react';
import { Badge, Card } from '../../../components/ui/index.tsx';
import { MEMORY_CATEGORIES } from '../domain/types.ts';
import type { HeroMemoryProfile, MemoryCategory } from '../domain/types.ts';

type ChronicleFilter = MemoryCategory | 'All';

export function HeroChronicle({ profile }: { profile: HeroMemoryProfile }) {
  const [filter, setFilter] = useState<ChronicleFilter>('All');
  const memories = [...profile.memories]
    .filter((memory) => filter === 'All' || memory.category === filter)
    .sort((left, right) => right.eventOrder - left.eventOrder || left.id.localeCompare(right.id));

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Chronicle</h2>
          <p className="mt-1 text-xs text-[#5f5875]">Observed events retained by this hero.</p>
        </div>
        <label className="text-[10px] uppercase tracking-widest text-[#918BA5]">
          Category
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as ChronicleFilter)}
            className="ml-2 rounded border border-[#2a2540] bg-[#0f0d1f] px-2 py-1.5 text-xs normal-case tracking-normal text-[#F4F1FA]"
          >
            <option value="All">All memories</option>
            {MEMORY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      </div>

      {memories.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-[#2e2a44] bg-[#0f0d1f] p-6 text-center">
          <p className="text-sm font-semibold text-[#918BA5]">
            {profile.memories.length === 0 ? 'No significant memories recorded.' : `No ${filter.toLowerCase()} memories recorded.`}
          </p>
          <p className="mt-1 text-xs text-[#5f5875]">Only eligible completed encounters can enter the permanent chronicle.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {memories.map((memory) => (
            <article key={memory.id} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge label={memory.category} variant="class" />
                    <span className="text-[10px] uppercase tracking-wide text-[#5f5875]">Event #{memory.eventOrder}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#F4F1FA]">{memory.title}</h3>
                </div>
                <span className="text-xs font-bold text-[#D6B36A]">Significance {memory.significance.score}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#918BA5]">{memory.description}</p>
              <dl className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2">
                <div>
                  <dt className="uppercase tracking-wide text-[#5f5875]">Encounter</dt>
                  <dd className="mt-0.5 text-[#B8B1C9]">{memory.context.encounterLabel ?? memory.context.sessionId}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-[#5f5875]">Participants</dt>
                  <dd className="mt-0.5 text-[#B8B1C9]">{memory.participantIds.join(', ') || 'None recorded'}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
