import { useMemo, useState } from 'react';
import { Search, Shield, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, HeroCard } from '../../components/ui/index.tsx';
import { PartyFormationPanel } from './components/PartyFormationPanel.tsx';
import { heroDefinitions } from './data/heroDefinitions.ts';
import { filterAndSortRoster } from './domain/roster.ts';
import { HERO_CLASSES, HERO_RARITIES } from './domain/types.ts';
import type { HeroClass, HeroRarity, RosterSort } from './domain/types.ts';
import { useHeroStore } from './store/heroStore.ts';

export function HeroesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'formation' ? 'formation' : 'roster';
  const roster = useHeroStore((state) => state.roster);
  const [search, setSearch] = useState('');
  const [heroClass, setHeroClass] = useState<HeroClass | 'All'>('All');
  const [rarity, setRarity] = useState<HeroRarity | 'All'>('All');
  const [sortBy, setSortBy] = useState<RosterSort>('level');

  const heroes = useMemo(
    () => filterAndSortRoster(roster, heroDefinitions, { search, heroClass, rarity, sortBy }),
    [roster, search, heroClass, rarity, sortBy],
  );

  const setTab = (tab: 'roster' | 'formation') => {
    setSearchParams(tab === 'formation' ? { tab: 'formation' } : {});
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-violet-400">Warband</p>
          <h1 className="text-2xl font-bold text-[#F4F1FA] sm:text-3xl">Hero Management</h1>
          <p className="mt-1 text-sm text-[#918BA5]">Inspect the roster and determine who stands in formation.</p>
        </div>
        <div className="flex rounded-lg border border-[#2a2540] bg-[#12101f] p-1">
          <Button variant={activeTab === 'roster' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('roster')} leftIcon={<Users size={14} />}>
            Roster
          </Button>
          <Button variant={activeTab === 'formation' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('formation')} leftIcon={<Shield size={14} />}>
            Formation
          </Button>
        </div>
      </header>

      {activeTab === 'formation' ? (
        <PartyFormationPanel />
      ) : (
        <>
          <Card className="grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(130px,auto))]">
            <label className="relative">
              <span className="sr-only">Search heroes</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5875]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name…"
                className="w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] py-2 pl-9 pr-3 text-sm text-[#F4F1FA] outline-none placeholder:text-[#5f5875] focus:border-violet-500"
              />
            </label>
            <select value={heroClass} onChange={(event) => setHeroClass(event.target.value as HeroClass | 'All')} className="rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-sm text-[#F4F1FA] outline-none focus:border-violet-500" aria-label="Filter by class">
              <option value="All">All classes</option>
              {HERO_CLASSES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select value={rarity} onChange={(event) => setRarity(event.target.value === 'All' ? 'All' : Number(event.target.value) as HeroRarity)} className="rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-sm text-[#F4F1FA] outline-none focus:border-violet-500" aria-label="Filter by rarity">
              <option value="All">All rarities</option>
              {HERO_RARITIES.map((value) => <option key={value} value={value}>{value} stars</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as RosterSort)} className="rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2 text-sm text-[#F4F1FA] outline-none focus:border-violet-500" aria-label="Sort heroes">
              <option value="level">Level</option>
              <option value="rarity">Rarity</option>
              <option value="name">Name</option>
            </select>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-xs text-[#918BA5]">{heroes.length} of {roster.length} heroes</p>
          </div>

          {heroes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {heroes.map((hero) => (
                <HeroCard key={hero.instance.id} hero={hero} onClick={() => navigate(`/heroes/${hero.instance.id}`)} />
              ))}
            </div>
          ) : (
            <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <Users size={32} className="mb-3 text-[#4a4560]" />
              <h2 className="font-semibold text-[#F4F1FA]">No heroes found</h2>
              <p className="mt-1 max-w-sm text-sm text-[#918BA5]">No roster member matches the current search and filters.</p>
              <Button className="mt-4" variant="secondary" size="sm" onClick={() => { setSearch(''); setHeroClass('All'); setRarity('All'); }}>
                Clear filters
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

