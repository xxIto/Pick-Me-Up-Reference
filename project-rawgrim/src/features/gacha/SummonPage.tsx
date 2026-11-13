import { useState } from 'react';
import { ArrowLeft, Gem, Sparkles, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card } from '../../components/ui/index.tsx';
import { useHeroStore } from '../heroes/store/heroStore.ts';
import { GACHA_CONFIG } from './domain/gachaConfig.ts';
import type {
  SummonCount,
  SummonResultEntry,
  SummonTransactionResult,
} from './domain/types.ts';

const REVEAL_DELAY_MS = 650;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

interface SummonResultCardProps {
  result: SummonResultEntry;
}

function SummonResultCard({ result }: SummonResultCardProps) {
  const { definition } = result;

  return (
    <Card className="relative overflow-hidden p-4" glow={definition.rarity >= 4}>
      {result.isDuplicate && (
        <Badge
          label="Duplicate"
          variant="class"
          className="absolute right-3 top-3 border-amber-600/40 text-amber-300"
        />
      )}
      <div
        className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 text-xl font-black text-white shadow-[0_0_24px_rgba(139,92,246,0.24)]"
        style={{ background: definition.portrait.gradient }}
        aria-hidden="true"
      >
        {definition.portrait.initials}
      </div>
      <div className="text-center">
        <div className="mb-2 flex flex-wrap justify-center gap-1">
          <Badge label={definition.class} variant="class" />
          <Badge label={`${definition.rarity}★`} variant={`rarity-${definition.rarity}`} />
        </div>
        <h3 className="font-bold text-[#F4F1FA]">{definition.name}</h3>
        <p className="mt-1 text-xs font-semibold text-[#D6B36A]">{definition.trait.name}</p>
        <p className="mt-1 min-h-10 text-xs leading-5 text-[#918BA5]">{definition.trait.description}</p>
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-1 border-t border-[#2a2540] pt-3 text-center">
        {Object.entries(definition.baseStats).map(([stat, value]) => (
          <div key={stat}>
            <dt className="text-[9px] uppercase tracking-wide text-[#5f5875]">{stat}</dt>
            <dd className="text-xs font-bold text-[#F4F1FA]">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

interface ChamberProps {
  crystals: number;
  loadingCount: SummonCount | null;
  feedback: string | null;
  onSummon: (count: SummonCount) => void;
}

function SummoningChamber({ crystals, loadingCount, feedback, onSummon }: ChamberProps) {
  const isLoading = loadingCount !== null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card className="relative min-h-[460px] overflow-hidden p-6 sm:p-10" glow>
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(139,92,246,.42) 0%, rgba(76,29,149,.16) 26%, transparent 58%)',
          }}
          aria-hidden="true"
        />
        <div className="relative flex h-full min-h-[400px] flex-col items-center justify-center text-center">
          <div className={`relative mb-8 flex h-52 w-52 items-center justify-center sm:h-64 sm:w-64 ${isLoading ? 'animate-pulse' : ''}`}>
            <div className="absolute inset-0 rounded-full border border-violet-500/20 shadow-[0_0_70px_rgba(124,58,237,.28)]" />
            <div className="absolute inset-5 rounded-full border border-dashed border-amber-400/30 [animation:spin_22s_linear_infinite]" />
            <div className="absolute inset-10 rounded-full border border-violet-400/40 [animation:spin_14s_linear_infinite_reverse]" />
            <div className="absolute inset-[4.5rem] rounded-full bg-violet-600/20 blur-xl" />
            <Sparkles size={46} className="relative text-violet-200 drop-shadow-[0_0_18px_rgba(196,181,253,.8)]" />
          </div>

          <p className="text-xs uppercase tracking-[0.3em] text-violet-400">The Veil answers in blood</p>
          <h2 className="mt-2 text-2xl font-bold text-[#F4F1FA]">Summoning Chamber</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#918BA5]">
            Spend crystals to draw a hero from beyond the Veil. Every summon creates a separate owned hero.
          </p>

          <div className="mt-7 grid w-full max-w-xl gap-3 sm:grid-cols-2">
            {([1, 10] as const).map((count) => {
              const cost = GACHA_CONFIG.costs[count];
              const insufficient = crystals < cost;
              return (
                <Button
                  key={count}
                  variant={count === 10 ? 'gold' : 'primary'}
                  size="lg"
                  fullWidth
                  disabled={isLoading || insufficient}
                  onClick={() => onSummon(count)}
                  leftIcon={<Gem size={16} />}
                >
                  {loadingCount === count ? 'Opening the Veil…' : `${count === 1 ? 'Single' : 'Ten'} Summon · ${cost.toLocaleString()}`}
                </Button>
              );
            })}
          </div>

          {!feedback && crystals >= GACHA_CONFIG.costs[1] && crystals < GACHA_CONFIG.costs[10] && (
            <p role="status" className="mt-4 text-sm text-amber-300">
              Ten Summon requires {(GACHA_CONFIG.costs[10] - crystals).toLocaleString()} more crystals.
            </p>
          )}

          {feedback && (
            <p role="alert" className="mt-4 text-sm text-red-300">{feedback}</p>
          )}
          {!feedback && crystals < GACHA_CONFIG.costs[1] && (
            <p role="status" className="mt-4 text-sm text-amber-300">You need at least 100 crystals to summon.</p>
          )}
        </div>
      </Card>

      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#918BA5]">Crystal balance</p>
              <p className="mt-1 text-2xl font-bold text-violet-300">{crystals.toLocaleString()}</p>
            </div>
            <Gem size={26} className="text-violet-400" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-[#F4F1FA]">Rarity probabilities</h2>
          <p className="mt-1 text-xs text-[#5f5875]">Each summon uses the same independent rates.</p>
          <ul className="mt-4 space-y-2">
            {[...GACHA_CONFIG.rarityProbabilities].reverse().map(({ rarity, probability }) => (
              <li key={rarity} className="flex items-center justify-between border-b border-[#211d33] pb-2 text-sm last:border-0">
                <Badge label={`${rarity}★`} variant={`rarity-${rarity}`} />
                <span className="font-semibold tabular-nums text-[#D6B36A]">{probability * 100}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-5 text-[#5f5875]">
            No pity, guaranteed rarity, duplicate conversion, or special banner rules apply.
          </p>
        </Card>
      </div>
    </div>
  );
}

export function SummonPage() {
  const navigate = useNavigate();
  const crystals = useHeroStore((state) => state.crystals);
  const summon = useHeroStore((state) => state.summon);
  const [results, setResults] = useState<SummonResultEntry[] | null>(null);
  const [loadingCount, setLoadingCount] = useState<SummonCount | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSummon = async (count: SummonCount) => {
    if (loadingCount !== null) return;
    setFeedback(null);
    setLoadingCount(count);

    let transaction: SummonTransactionResult;
    try {
      [transaction] = await Promise.all([summon(count), delay(REVEAL_DELAY_MS)]);
    } catch {
      transaction = { ok: false, code: 'persistence-failed', message: 'Could not complete the summon' };
    }

    setLoadingCount(null);
    if (!transaction.ok) {
      setFeedback(transaction.message);
      return;
    }
    setResults(transaction.results);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-violet-400">Recruitment</p>
          <h1 className="text-2xl font-bold text-[#F4F1FA] sm:text-3xl">
            {results ? 'Summon Results' : 'Summoning Chamber'}
          </h1>
          <p className="mt-1 text-sm text-[#918BA5]">
            {results ? `${results.length} ${results.length === 1 ? 'soul has' : 'souls have'} answered.` : 'Call new heroes through the Veil.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
          <Gem size={16} /> {crystals.toLocaleString()} crystals
        </div>
      </header>

      {results ? (
        <div className="space-y-6">
          <div className={`grid gap-4 ${results.length === 1 ? 'mx-auto max-w-sm' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}>
            {results.map((result) => (
              <SummonResultCard key={result.instance.id} result={result} />
            ))}
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => setResults(null)} leftIcon={<ArrowLeft size={15} />}>
              Return to Chamber
            </Button>
            <Button variant="primary" onClick={() => navigate('/heroes')} leftIcon={<Users size={15} />}>
              View Hero Roster
            </Button>
          </div>
        </div>
      ) : (
        <SummoningChamber
          crystals={crystals}
          loadingCount={loadingCount}
          feedback={feedback}
          onSummon={handleSummon}
        />
      )}
    </div>
  );
}

