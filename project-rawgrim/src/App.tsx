import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { CommandCenterPage } from './features/dashboard/CommandCenterPage.tsx';
import { HeroesPage } from './features/heroes/HeroesPage.tsx';
import { SummonPage } from './features/gacha/SummonPage.tsx';
import { TowerPage } from './features/tower/TowerPage.tsx';
import { ExpeditionPage } from './features/progression/ExpeditionPage.tsx';
import { InventoryPage } from './features/inventory/InventoryPage.tsx';
import { ArchivePage } from './features/combat/ArchivePage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<CommandCenterPage />} />
          <Route path="heroes"     element={<HeroesPage />} />
          <Route path="summon"     element={<SummonPage />} />
          <Route path="tower"      element={<TowerPage />} />
          <Route path="expedition" element={<ExpeditionPage />} />
          <Route path="inventory"  element={<InventoryPage />} />
          <Route path="archive"    element={<ArchivePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
