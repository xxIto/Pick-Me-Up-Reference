import { Menu, Coins, Gem, Zap } from 'lucide-react';
import { ResourceDisplay } from '../ui/index.tsx';
import { mockPlayer, mockResources } from '../../data/mockData.ts';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { name, level } = mockPlayer;
  const { gold, crystals, energy, maxEnergy } = mockResources;

  return (
    <header className="sticky top-0 z-10 h-14 bg-[#0e0c1a]/90 backdrop-blur-sm border-b border-[#1e1b2e] flex items-center px-4 gap-4 shrink-0">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-[#918BA5] hover:text-[#F4F1FA] p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      {/* Player identity */}
      <div className="flex items-center gap-2 mr-auto">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-violet-900 flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold">{name.charAt(0)}</span>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-[#F4F1FA] leading-none">{name}</p>
          <p className="text-[10px] text-[#918BA5] leading-none mt-0.5">Level {level}</p>
        </div>
      </div>

      {/* Resources */}
      <div className="flex items-center gap-4 md:gap-6">
        <ResourceDisplay
          icon={<Coins size={15} />}
          value={gold}
          label="Gold"
          color="#D6B36A"
        />
        <ResourceDisplay
          icon={<Gem size={15} />}
          value={crystals}
          label="Crystals"
          color="#a78bfa"
        />
        <ResourceDisplay
          icon={<Zap size={15} />}
          value={`${energy}/${maxEnergy}`}
          label="Energy"
          color="#34d399"
        />
      </div>
    </header>
  );
}

