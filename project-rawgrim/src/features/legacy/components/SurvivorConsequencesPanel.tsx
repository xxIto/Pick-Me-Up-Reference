import { HeartCrack } from 'lucide-react';
import { Card } from '../../../components/ui/index.tsx';
import type { HeroInstance } from '../../heroes/domain/types.ts';

export function SurvivorConsequencesPanel({ hero }: { hero: HeroInstance }) {
  const experiences = [...(hero.survivorConsequences?.experiences ?? [])].reverse();
  if (experiences.length === 0) return null;
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">
        <HeartCrack size={15} className="text-rose-400" /> Survivor consequences
      </h2>
      <p className="mt-2 text-xs leading-5 text-[#5f5875]">Persistent experiences remain factual; temporary emotion can recover over time.</p>
      <div className="mt-4 space-y-3">
        {experiences.slice(0, 5).map((experience) => (
          <div key={experience.id} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold capitalize text-[#F4F1FA]">{experience.dominantResponse}</p>
              <span className="text-xs font-bold text-rose-300">{experience.intensity}/100</span>
            </div>
            <p className="mt-1 text-xs text-[#918BA5]">Loss recorded: {experience.fallenHeroId}</p>
            <p className="mt-2 text-[10px] text-[#5f5875]">
              Emotion Δ Fear {experience.emotionDelta.fear >= 0 ? '+' : ''}{experience.emotionDelta.fear} · Anger {experience.emotionDelta.anger >= 0 ? '+' : ''}{experience.emotionDelta.anger} · Resolve {experience.emotionDelta.resolve >= 0 ? '+' : ''}{experience.emotionDelta.resolve}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
