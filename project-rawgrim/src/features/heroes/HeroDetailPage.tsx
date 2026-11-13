import { ArrowLeft, Heart, Shield, Sparkles, Swords, Wind } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Card, ProgressBar } from '../../components/ui/index.tsx';
import { heroDefinitions } from './data/heroDefinitions.ts';
import { getSkillsByIds } from './data/heroSkills.ts';
import { getAssignedHeroIds } from './domain/heroRules.ts';
import { resolveHero } from './domain/roster.ts';
import { ensureHeroPersonality } from './domain/personality.ts';
import { useHeroStore } from './store/heroStore.ts';

const STAT_ICONS = {
  hp: Heart,
  attack: Swords,
  defense: Shield,
  speed: Wind,
};

export function HeroDetailPage() {
  const { heroId } = useParams();
  const roster = useHeroStore((state) => state.roster);
  const formation = useHeroStore((state) => state.formation);
  const instance = roster.find((hero) => hero.id === heroId);
  const hero = instance ? resolveHero(instance, heroDefinitions) : null;

  if (!hero) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#F4F1FA]">Hero not found</h1>
        <p className="mt-2 text-sm text-[#918BA5]">This roster entry is missing or no longer valid.</p>
        <Link to="/heroes" className="mt-5 inline-block text-sm text-violet-400 hover:text-violet-300">Return to roster</Link>
      </div>
    );
  }

  const { instance: heroInstance, definition, stats } = hero;
  const deployed = getAssignedHeroIds(formation).includes(heroInstance.id);
  const skills = getSkillsByIds(definition.skillIds);
  const personality = ensureHeroPersonality(heroInstance, definition);
  const experienceToNextLevel = heroInstance.level * 100;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link to="/heroes" className="inline-flex items-center gap-2 text-sm text-[#918BA5] hover:text-[#F4F1FA]">
        <ArrowLeft size={15} /> Back to roster
      </Link>

      <Card className="overflow-hidden" glow>
        <div className="grid md:grid-cols-[260px_1fr]">
          <div className="flex min-h-64 items-center justify-center p-8" style={{ background: definition.portrait.gradient }}>
            <span className="text-5xl font-black tracking-widest text-white/90">{definition.portrait.initials}</span>
          </div>
          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge label={definition.class} variant="class" />
                  <Badge label={`${definition.rarity}★`} variant={`rarity-${definition.rarity}`} />
                  <Badge label={heroInstance.status} variant={`status-${heroInstance.status}`} />
                  <Badge label={deployed ? 'Deployed' : 'Reserve'} variant={deployed ? 'status-Active' : 'class'} />
                </div>
                <h1 className="text-3xl font-bold text-[#F4F1FA]">{definition.name}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#918BA5]">{definition.description}</p>
              </div>
              <span className="text-sm font-bold text-[#D6B36A]">Level {heroInstance.level}</span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ProgressBar value={heroInstance.experience} max={experienceToNextLevel} label="Experience" showLabel color="violet" />
              <ProgressBar value={heroInstance.currentHp} max={stats.hp} label="Health" showLabel color={heroInstance.status === 'Dead' ? 'rose' : 'emerald'} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Attributes</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(STAT_ICONS) as (keyof typeof STAT_ICONS)[]).map((stat) => {
                const Icon = STAT_ICONS[stat];
                return (
                  <div key={stat} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
                    <Icon size={16} className="mb-2 text-violet-400" />
                    <p className="text-[10px] uppercase tracking-wide text-[#918BA5]">{stat}</p>
                    <p className="text-lg font-bold text-[#F4F1FA]">{stats[stat]}</p>
                    <p className="text-[10px] text-[#5f5875]">Base {definition.baseStats[stat]} · +{definition.growthStats[stat]}/level</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Personality</h2>
            <p className="font-semibold text-[#D6B36A]">{definition.trait.name}</p>
            <p className="mt-1 text-sm leading-6 text-[#918BA5]">{definition.trait.description}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.entries(personality.innate).map(([dimension, value]) => (
                <div key={dimension}>
                  <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wide">
                    <span className="text-[#918BA5]">{dimension.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-bold text-violet-300">{value}</span>
                  </div>
                  <ProgressBar value={value} max={100} color="violet" height="xs" />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-dashed border-[#2e2a44] bg-[#0f0d1f] p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5f5875]">Learned behavior</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(personality.learned).map(([category, value]) => (
                  <div key={category} className="flex justify-between rounded bg-[#151126] px-2 py-1.5">
                    <span className="capitalize text-[#918BA5]">{category.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-bold text-violet-300">{value >= 0 ? '+' : ''}{value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[#5f5875]">Battles learned: {personality.learning?.battlesProcessed ?? 0}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#F4F1FA]"><Sparkles size={15} className="text-violet-400" /> Skills</h2>
            <div className="space-y-3">
              {skills.map((skill) => (
                <div key={skill.id} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
                  <p className="text-sm font-semibold text-[#F4F1FA]">{skill.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#918BA5]">{skill.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Equipment</h2>
            <div className="grid grid-cols-3 gap-2">
              {['Weapon', 'Armor', 'Relic'].map((slot) => (
                <div key={slot} className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[#2e2a44] bg-[#0f0d1f] text-[10px] uppercase tracking-wide text-[#5f5875]">
                  {slot}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#5f5875]">Equipment management is not available in this build.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
