import { TowerControl } from 'lucide-react';
import { PlaceholderPage } from '../dashboard/PlaceholderPage.tsx';

export function TowerPage() {
  return (
    <PlaceholderPage
      title="Tower of Ruin"
      description="Ascend the Tower of Ruin one floor at a time. Each floor presents a harder challenge. Defeat the Dread Citadel to claim eternal glory."
      icon={<TowerControl size={28} />}
    />
  );
}

