import { useState } from 'react';
import { Play, RotateCcw, SkipForward, Swords, Zap } from 'lucide-react';
import { Badge, Button, Card, ProgressBar } from '../../components/ui/index.tsx';
import { heroDefinitions } from '../heroes/data/heroDefinitions.ts';
import { useHeroStore } from '../heroes/store/heroStore.ts';
import { ensureHeroPersonality } from '../heroes/domain/personality.ts';
import {
  runAutonomousCombat,
  stepAutonomousCombat,
} from '../ai/domain/autonomousCombat.ts';
import type { DecisionContextResolver, DecisionTrace } from '../ai/domain/types.ts';
import { SANDBOX_ENEMIES } from './data/enemyDefinitions.ts';
import { getCurrentActor } from './domain/combatEngine.ts';
import { initializeCombat } from './domain/initialization.ts';
import type { CombatState, CombatUnit } from './domain/types.ts';

function CombatUnitCard({ unit, active }: { unit: CombatUnit; active: boolean }) {
  const hpColor = unit.side === 'allies' ? 'violet' : 'rose';
  return (
    <Card className={`p-3 transition-all ${active ? 'border-amber-400/70 shadow-[0_0_18px_rgba(251,191,36,.16)]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate text-sm font-bold ${unit.alive ? 'text-[#F4F1FA]' : 'text-[#5f5875] line-through'}`}>
            {unit.name}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[#918BA5]">
            {unit.position.line} · SPD {unit.stats.speed}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {active && <Badge label="Acting" variant="rarity-5" />}
          {unit.defending && <Badge label="Defend" variant="class" />}
          {!unit.alive && <Badge label="Defeated" variant="status-Dead" />}
        </div>
      </div>
      <ProgressBar
        value={unit.currentHp}
        max={unit.stats.maxHp}
        color={hpColor}
        height="sm"
        showLabel
        label="HP"
        className="mt-3"
      />
      <div className="mt-3 grid grid-cols-5 gap-1 text-center">
        {[
          ['ATK', unit.stats.attack],
          ['MAG', unit.stats.magic],
          ['DEF', unit.stats.defense],
          ['RES', unit.stats.resistance],
          ['SPD', unit.stats.speed],
        ].map(([label, value]) => (
          <div key={label} className="rounded bg-[#0f0d1f] px-1 py-1.5">
            <p className="text-[8px] text-[#5f5875]">{label}</p>
            <p className="text-[10px] font-bold text-[#D6B36A]">{value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TeamPanel({ title, units, activeId }: { title: string; units: readonly CombatUnit[]; activeId?: string }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#918BA5]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {units.map((unit) => <CombatUnitCard key={unit.id} unit={unit} active={unit.id === activeId} />)}
      </div>
    </section>
  );
}

export function ArchivePage() {
  const roster = useHeroStore((state) => state.roster);
  const formation = useHeroStore((state) => state.formation);
  const teamStrategy = useHeroStore((state) => state.teamStrategy);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [lastDecision, setLastDecision] = useState<DecisionTrace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startBattle = () => {
    try {
      setCombat(initializeCombat(roster, formation, heroDefinitions, SANDBOX_ENEMIES, {
        seed: 13_337,
        maxRounds: 50,
      }));
      setLastDecision(null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Combat could not be initialized');
    }
  };

  const actor = combat?.result.outcome === 'ongoing' ? getCurrentActor(combat) : null;
  const allies = combat?.units.filter((unit) => unit.side === 'allies') ?? [];
  const enemies = combat?.units.filter((unit) => unit.side === 'enemies') ?? [];
  const resolveDecisionContext: DecisionContextResolver = (heroInstanceId) => {
    const instance = roster.find((hero) => hero.id === heroInstanceId);
    const definition = instance
      ? heroDefinitions.find((hero) => hero.id === instance.definitionId)
      : undefined;
    if (!instance) throw new Error(`Hero ${heroInstanceId} is missing from the roster`);
    return { personality: ensureHeroPersonality(instance, definition), teamStrategy };
  };

  const nextTurn = () => {
    if (!combat) return;
    const step = stepAutonomousCombat(combat, resolveDecisionContext);
    setCombat(step.state);
    setLastDecision(step.decision);
  };

  const autoResolve = () => {
    if (!combat) return;
    const result = runAutonomousCombat(combat, resolveDecisionContext);
    setCombat(result.state);
    setLastDecision(result.decisions[result.decisions.length - 1] ?? null);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-violet-400">Combat Archive</p>
          <h1 className="text-2xl font-bold text-[#F4F1FA] sm:text-3xl">Battle Sandbox</h1>
          <p className="mt-1 text-sm text-[#918BA5]">Run a deterministic battle without changing permanent hero data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!combat ? (
            <Button onClick={startBattle} leftIcon={<Play size={15} />}>Start Battle</Button>
          ) : (
            <>
              <Button
                variant="secondary"
                disabled={combat.result.outcome !== 'ongoing'}
                onClick={nextTurn}
                leftIcon={<SkipForward size={15} />}
              >
                Next Turn
              </Button>
              <Button
                variant="gold"
                disabled={combat.result.outcome !== 'ongoing'}
                onClick={autoResolve}
                leftIcon={<Zap size={15} />}
              >
                Auto Resolve
              </Button>
              <Button variant="ghost" onClick={() => { setCombat(null); setLastDecision(null); setError(null); }} leftIcon={<RotateCcw size={15} />}>
                Reset Battle
              </Button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!combat ? (
        <Card className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center" glow>
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-violet-500/30 bg-violet-950/40 shadow-[0_0_45px_rgba(124,58,237,.2)]">
            <Swords size={38} className="text-violet-300" />
          </div>
          <h2 className="text-xl font-bold text-[#F4F1FA]">The arena is silent</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#918BA5]">
            Your deployed party will face five fixed sandbox enemies. No rewards, injuries, experience, or permadeath are applied.
          </p>
          <Button className="mt-6" onClick={startBattle} leftIcon={<Play size={15} />}>Start Battle</Button>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" glow>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#918BA5]">Round</p>
              <p className="text-xl font-bold text-[#F4F1FA]">{combat.round} / {combat.maxRounds}</p>
            </div>
            <div className="text-left sm:text-center">
              <p className="text-[10px] uppercase tracking-widest text-[#918BA5]">Current actor</p>
              <p className="text-sm font-bold text-[#D6B36A]">{actor?.name ?? 'Battle complete'}</p>
            </div>
            <Badge
              label={combat.result.outcome}
              variant={combat.result.outcome === 'victory' ? 'status-Active' : combat.result.outcome === 'ongoing' ? 'rarity-4' : 'status-Dead'}
              className="self-start sm:self-auto"
            />
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_minmax(300px,420px)_1fr]">
            <TeamPanel title="Allied Party" units={allies} activeId={actor?.id} />

            <Card className="order-last flex max-h-[720px] min-h-[360px] flex-col overflow-hidden p-4 xl:order-none">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#918BA5]">Autonomous Decision</h2>
              {lastDecision ? (
                <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-950/20 p-3">
                  <p className="text-xs font-bold text-[#F4F1FA]">{lastDecision.reason}</p>
                  <div className="mt-3 space-y-2">
                    {lastDecision.candidates.slice(0, 3).map((candidate) => (
                      <div key={`${candidate.action.type}:${candidate.action.skillId ?? ''}:${candidate.action.targetId}`} className="rounded bg-[#0f0d1f] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold text-[#B8B1C9]">{candidate.action.skillId ?? candidate.action.type}</span>
                          <span className="text-xs font-bold text-[#D6B36A]">{candidate.finalUtility}</span>
                        </div>
                        <p className="mt-1 text-[9px] text-[#5f5875]">
                          Base {candidate.baseUtility} · Personality {candidate.personalityContribution >= 0 ? '+' : ''}{candidate.personalityContribution} · Strategy {candidate.teamStrategyContribution >= 0 ? '+' : ''}{candidate.teamStrategyContribution} · Learned {candidate.learnedPreferenceContribution >= 0 ? '+' : ''}{candidate.learnedPreferenceContribution}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-xs text-[#5f5875]">Advance one turn to inspect the decision trace.</p>
              )}
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#918BA5]">Combat Events</h2>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1" aria-live="polite">
                {[...combat.events].reverse().map((event) => (
                  <div key={event.sequence} className="rounded-lg border border-[#211d33] bg-[#0f0d1f] px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wide text-violet-400">Round {event.round} · {event.type}</p>
                    <p className="mt-1 text-xs leading-5 text-[#B8B1C9]">{event.message}</p>
                  </div>
                ))}
              </div>
            </Card>

            <TeamPanel title="Enemy Warband" units={enemies} activeId={actor?.id} />
          </div>
        </>
      )}
    </div>
  );
}

