import { useMemo, useState } from 'react';
import { Brain, RotateCcw, TestTube } from 'lucide-react';
import { Button, Card } from '../../../components/ui/index.tsx';
import { SANDBOX_ENEMIES } from '../../combat/data/enemyDefinitions.ts';
import { heroDefinitions } from '../../heroes/data/heroDefinitions.ts';
import type { HeroInstance, PartyFormation } from '../../heroes/domain/types.ts';
import type { TeamStrategy } from '../../heroes/domain/personalityTypes.ts';
import { runLearningLaboratory } from '../domain/trainingLab.ts';
import type { LearningLaboratoryResult } from '../domain/trainingLab.ts';

interface LearningLaboratoryProps {
  roster: readonly HeroInstance[];
  formation: PartyFormation;
  teamStrategy: TeamStrategy;
}

const LAB_ENCOUNTERS = [
  { id: 'warband', name: 'Ashen Warband', enemies: SANDBOX_ENEMIES },
  { id: 'vanguard', name: 'Vanguard Drill', enemies: SANDBOX_ENEMIES.slice(0, 3) },
] as const;

export function LearningLaboratory({ roster, formation, teamStrategy }: LearningLaboratoryProps) {
  const livingHeroes = useMemo(
    () => roster.filter((hero) => hero.status !== 'Dead' && hero.currentHp > 0),
    [roster],
  );
  const [heroId, setHeroId] = useState(livingHeroes[0]?.id ?? '');
  const [seed, setSeed] = useState(13_337);
  const [repetitions, setRepetitions] = useState(3);
  const [encounterId, setEncounterId] = useState<(typeof LAB_ENCOUNTERS)[number]['id']>('warband');
  const [result, setResult] = useState<LearningLaboratoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runExperiment = () => {
    try {
      const encounter = LAB_ENCOUNTERS.find((candidate) => candidate.id === encounterId);
      if (!encounter) throw new Error('Learning encounter is invalid');
      setResult(runLearningLaboratory({
        roster,
        formation,
        definitions: heroDefinitions,
        enemies: encounter.enemies,
        selectedHeroId: heroId,
        teamStrategy,
        seed,
        repetitions,
      }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Learning experiment failed');
    }
  };

  return (
    <Card className="p-4 sm:p-5" glow>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
            <Brain size={15} /> Learning Laboratory
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#918BA5]">
            Train an isolated profile against the fixed sandbox encounter, then compare the same seeded policy before and after. Player data is never modified.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          <label className="text-[10px] uppercase tracking-wide text-[#918BA5]">
            Hero
            <select value={heroId} onChange={(event) => { setHeroId(event.target.value); setResult(null); }} className="mt-1 w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-xs normal-case text-[#F4F1FA]">
              {livingHeroes.map((hero) => {
                const definition = heroDefinitions.find((candidate) => candidate.id === hero.definitionId);
                return <option key={hero.id} value={hero.id}>{definition?.name ?? hero.id}</option>;
              })}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-[#918BA5]">
            Encounter
            <select value={encounterId} onChange={(event) => { setEncounterId(event.target.value as (typeof LAB_ENCOUNTERS)[number]['id']); setResult(null); }} className="mt-1 w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-xs normal-case text-[#F4F1FA]">
              {LAB_ENCOUNTERS.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.name}</option>)}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-[#918BA5]">
            Seed
            <input type="number" min={0} value={seed} onChange={(event) => setSeed(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-xs text-[#F4F1FA]" />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-[#918BA5]">
            Battles
            <input type="number" min={1} max={20} value={repetitions} onChange={(event) => setRepetitions(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-xs text-[#F4F1FA]" />
          </label>
          <div className="flex items-end gap-2">
            <Button onClick={runExperiment} disabled={!heroId} leftIcon={<TestTube size={14} />}>Train</Button>
            <Button variant="ghost" onClick={() => { setResult(null); setError(null); }} aria-label="Reset experimental learned preferences"><RotateCcw size={14} /></Button>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
      {result && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
          <div className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
            <p className="text-[10px] uppercase tracking-widest text-[#5f5875]">Before training</p>
            <p className="mt-2 text-sm font-bold text-[#F4F1FA]">{result.beforeDecision?.selectedAction.skillId ?? result.beforeDecision?.selectedAction.type ?? 'No action'}</p>
            <p className="mt-1 text-xs text-[#918BA5]">Learned score {result.beforeDecision?.candidates[0]?.learnedPreferenceContribution ?? 0}</p>
          </div>
          <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3">
            <p className="text-[10px] uppercase tracking-widest text-violet-300">After training</p>
            <p className="mt-2 text-sm font-bold text-[#F4F1FA]">{result.afterDecision?.selectedAction.skillId ?? result.afterDecision?.selectedAction.type ?? 'No action'}</p>
            <p className="mt-1 text-xs text-[#918BA5]">Learned score {result.afterDecision?.candidates[0]?.learnedPreferenceContribution ?? 0}</p>
          </div>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-[#5f5875]">Recent learning updates</p>
            {result.updates.slice(-8).reverse().map((update, index) => (
              <div key={`${update.sessionId}:${index}`} className="border-t border-[#211d33] py-2 first:border-0">
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-[#B8B1C9]">Preference: {update.category}</span>
                  <span className="font-bold text-[#D6B36A]">{update.previousValue} → {update.updatedValue}</span>
                </div>
                <p className="mt-1 text-[9px] text-[#5f5875]">Observation: HP critical {update.context.actorHpCritical}, ally risk {update.context.allySurvivalRisk.toFixed(2)}</p>
                <p className="mt-1 text-[9px] text-[#5f5875]">Signal {update.signal.reward}: {update.signal.rationale.join(', ') || 'neutral'}</p>
                <p className="mt-1 text-[9px] text-[#5f5875]">Context changes: {Object.entries(update.contextWeightChanges).slice(0, 2).map(([key, change]) => `${key} ${change?.previous}→${change?.updated}`).join(', ') || 'none'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
