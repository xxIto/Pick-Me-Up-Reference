import { Users } from 'lucide-react';
import { PlaceholderPage } from '../dashboard/PlaceholderPage.tsx';

export function HeroesPage() {
  return (
    <PlaceholderPage
      title="Heroes"
      description="Browse and manage your full hero roster. Assign heroes to squads, view their stats, and prepare them for battle."
      icon={<Users size={28} />}
    />
  );
}

