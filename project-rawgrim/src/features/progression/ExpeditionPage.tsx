import { Map } from 'lucide-react';
import { PlaceholderPage } from '../dashboard/PlaceholderPage.tsx';

export function ExpeditionPage() {
  return (
    <PlaceholderPage
      title="Expeditions"
      description="Send heroes on timed expeditions to gather resources and discover secrets. Heroes on expedition cannot be used in combat."
      icon={<Map size={28} />}
    />
  );
}

