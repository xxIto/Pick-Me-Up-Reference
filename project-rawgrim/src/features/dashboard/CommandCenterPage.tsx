import { useNavigate } from 'react-router-dom';
import {
  Users,
  Sparkles,
  Dumbbell,
  FlaskConical,
  CheckCircle,
  Circle,
  Clock,
  ChevronRight,
  Swords,
} from 'lucide-react';
import { Card, Button, HeroCard, Badge, ProgressBar } from '../../components/ui/index.tsx';
import { mockPlayer, mockTower, mockExpedition, mockResources } from '../../data/mockData.ts';
import { heroDefinitions } from '../heroes/data/heroDefinitions.ts';
import { resolveHero } from '../heroes/domain/roster.ts';
import { useHeroStore } from '../heroes/store/heroStore.ts';

// ─── Shortcut Card ─────────────────────────────────────────────────────────────

interface ShortcutCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  to?: string;
  disabled?: boolean;
}

function ShortcutCard({ icon, label, description, to, disabled = false }: ShortcutCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (disabled) return;
    if (to) navigate(to);
  };

  return (
    <Card
      onClick={disabled ? undefined : handleClick}
      className={[
        'p-4 flex flex-col gap-2 group transition-all duration-200',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:border-violet-500/40 hover:shadow-[0_0_16px_rgba(139,92,246,0.08)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between">
        <span className="text-violet-400 group-hover:text-violet-300 transition-colors">{icon}</span>
        {disabled && (
          <Badge label="Soon" variant="class" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#F4F1FA]">{label}</p>
        <p className="text-xs text-[#918BA5] mt-0.5">{description}</p>
      </div>
    </Card>
  );
}

// ─── Expedition Panel ─────────────────────────────────────────────────────────

function ExpeditionPanel() {
  const navigate = useNavigate();
  const pct = Math.round(
    ((mockExpedition.durationMs - mockExpedition.timeRemainingMs) / mockExpedition.durationMs) * 100
  );
  const remaining = mockExpedition.timeRemainingMs;
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const timeLabel = `${hours}h ${minutes}m remaining`;

  return (
    <Card className="p-5" glow>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-400" />
          <h2 className="text-sm font-bold text-[#F4F1FA]">Active Expedition</h2>
        </div>
        <Badge label="In Progress" variant="status-Active" />
      </div>
      <p className="text-xs text-[#918BA5] mb-3">{mockExpedition.name}</p>
      <ProgressBar value={pct} max={100} color="gold" height="sm" className="mb-2" />
      <p className="text-xs text-[#D6B36A] mb-4">{timeLabel}</p>
      <Button
        variant="gold"
        size="sm"
        fullWidth
        onClick={() => navigate('/expedition')}
        leftIcon={<ChevronRight size={14} />}
      >
        View Expedition
      </Button>
    </Card>
  );
}

// ─── Tower Panel ──────────────────────────────────────────────────────────────

function TowerPanel() {
  const navigate = useNavigate();
  const { currentFloor, maxFloor, floors } = mockTower;

  return (
    <Card className="p-5" glow>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Swords size={16} className="text-violet-400" />
          <h2 className="text-sm font-bold text-[#F4F1FA]">Tower of Ruin</h2>
        </div>
        <span className="text-xs text-[#918BA5]">Floor {currentFloor} / {maxFloor}</span>
      </div>

      <ProgressBar value={currentFloor} max={maxFloor} color="violet" height="sm" className="mb-4" />

      <ul className="space-y-1.5 mb-4">
        {floors.map((f) => (
          <li key={f.floor} className="flex items-center gap-2 text-xs">
            {f.cleared ? (
              <CheckCircle size={13} className="text-emerald-400 shrink-0" />
            ) : f.current ? (
              <Circle size={13} className="text-violet-400 shrink-0 animate-pulse" />
            ) : (
              <Circle size={13} className="text-[#3a3555] shrink-0" />
            )}
            <span className={
              f.cleared ? 'text-[#918BA5] line-through' :
              f.current  ? 'text-[#F4F1FA] font-semibold' :
              'text-[#4a4560]'
            }>
              {f.floor}. {f.name}
            </span>
            {f.current && <Badge label="Current" variant="rarity-Epic" />}
          </li>
        ))}
      </ul>

      <Button
        variant="primary"
        size="sm"
        fullWidth
        onClick={() => navigate('/tower')}
        leftIcon={<Swords size={13} />}
      >
        Enter Tower
      </Button>
    </Card>
  );
}

// ─── Command Center Page ───────────────────────────────────────────────────────

export function CommandCenterPage() {
  const navigate = useNavigate();
  const { name, level } = mockPlayer;
  const { energy, maxEnergy } = mockResources;
  const roster = useHeroStore((state) => state.roster);
  const formation = useHeroStore((state) => state.formation);
  const activeSquad = [...formation.frontline, ...formation.backline].map((heroId) => {
    const instance = roster.find((hero) => hero.id === heroId);
    return instance ? resolveHero(instance, heroDefinitions) : null;
  });

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Welcome banner */}
      <Card className="p-6 relative overflow-hidden" glow>
        {/* Background decoration */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 80% 50%, #8B5CF6 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />
        <div className="relative z-10">
          <p className="text-xs text-[#918BA5] uppercase tracking-widest mb-1">Welcome back,</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F1FA]">
            {name}
            <span className="ml-3 text-sm font-normal text-violet-400 align-middle">Lv. {level}</span>
          </h1>
          <p className="text-sm text-[#918BA5] mt-2">
            Your realm waits. The tower demands blood, and the shadows grow restless.
          </p>
          <div className="mt-4">
            <ProgressBar
              value={energy}
              max={maxEnergy}
              color="violet"
              height="sm"
              showLabel
              label="Energy"
              className="max-w-xs"
            />
          </div>
        </div>
      </Card>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Squad + Shortcuts */}
        <div className="xl:col-span-2 space-y-6">
          {/* Active Squad */}
          <section aria-labelledby="squad-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="squad-heading" className="text-sm font-bold text-[#F4F1FA] flex items-center gap-2">
                <Users size={15} className="text-violet-400" />
                Active Squad
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/heroes?tab=formation')}>
                Manage →
              </Button>
            </div>
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
              {Array.from({ length: 5 }, (_, i) => {
                const hero = activeSquad[i];
                return hero ? (
                  <HeroCard key={hero.instance.id} hero={hero} size="sm" />
                ) : (
                  <Card
                    key={i}
                    className="p-3 flex flex-col items-center justify-center gap-2 min-h-[100px] border-dashed"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1e1b30] flex items-center justify-center">
                      <span className="text-[#3a3555] text-lg">+</span>
                    </div>
                    <span className="text-[10px] text-[#4a4560]">Empty</span>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Shortcut cards */}
          <section aria-labelledby="shortcuts-heading">
            <h2 id="shortcuts-heading" className="text-sm font-bold text-[#F4F1FA] mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ShortcutCard
                icon={<Users size={22} />}
                label="Heroes"
                description="Manage your roster"
                to="/heroes"
              />
              <ShortcutCard
                icon={<Sparkles size={22} />}
                label="Summon"
                description="Recruit new heroes"
                to="/summon"
              />
              <ShortcutCard
                icon={<Dumbbell size={22} />}
                label="Training"
                description="Strengthen your squad"
                disabled
              />
              <ShortcutCard
                icon={<FlaskConical size={22} />}
                label="Research"
                description="Unlock passive bonuses"
                disabled
              />
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <TowerPanel />
          <ExpeditionPanel />
        </div>
      </div>
    </div>
  );
}
