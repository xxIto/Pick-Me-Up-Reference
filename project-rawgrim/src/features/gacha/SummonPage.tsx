import { Sparkles } from 'lucide-react';
import { PlaceholderPage } from '../dashboard/PlaceholderPage.tsx';

export function SummonPage() {
  return (
    <PlaceholderPage
      title="Summon"
      description="Spend crystals to summon new heroes from the Veil. Pity system ensures guaranteed rarity thresholds."
      icon={<Sparkles size={28} />}
    />
  );
}

