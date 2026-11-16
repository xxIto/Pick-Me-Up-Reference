import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  TowerControl,
  Map,
  Package,
  BookOpen,
  Skull,
  X,
} from 'lucide-react';

interface NavEntry {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const NAV_ENTRIES: NavEntry[] = [
  { label: 'Command Center', to: '/',           icon: <LayoutDashboard size={18} /> },
  { label: 'Heroes',         to: '/heroes',     icon: <Users            size={18} /> },
  { label: 'Summon',         to: '/summon',     icon: <Sparkles         size={18} /> },
  { label: 'Tower',          to: '/tower',      icon: <TowerControl     size={18} /> },
  { label: 'Expedition',     to: '/expedition', icon: <Map              size={18} /> },
  { label: 'Inventory',      to: '/inventory',  icon: <Package          size={18} /> },
  { label: 'Archive',        to: '/archive',    icon: <BookOpen         size={18} /> },
  { label: 'Hall of the Fallen', to: '/fallen', icon: <Skull            size={18} /> },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const location = useLocation();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
      isActive
        ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-[inset_0_0_12px_rgba(139,92,246,0.08)]'
        : 'text-[#918BA5] hover:text-[#F4F1FA] hover:bg-white/5 border border-transparent',
    ].join(' ');

  const isCommandCenter = location.pathname === '/';

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed left-0 top-0 h-full z-30 w-64 bg-[#0e0c1a] border-r border-[#1e1b2e] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#1e1b2e] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-900 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.4)]">
              <span className="text-white text-xs font-black">R</span>
            </div>
            <div>
              <span className="text-[#F4F1FA] font-bold tracking-wide text-sm">RAWGRIM</span>
              <p className="text-[10px] text-[#918BA5] leading-none">Dark Fantasy RPG</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-[#918BA5] hover:text-[#F4F1FA] p-1 rounded"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ENTRIES.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.to === '/'}
              className={navLinkClass}
              onClick={onClose}
            >
              <span className={isCommandCenter && entry.to === '/' ? 'text-violet-400' : ''}>{entry.icon}</span>
              {entry.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-4 py-4 border-t border-[#1e1b2e]">
          <p className="text-[10px] text-[#4a4560] text-center">v0.1.0 · MVP Build</p>
        </div>
      </aside>
    </>
  );
}

