import { BookOpen } from 'lucide-react';
import { PlaceholderPage } from '../dashboard/PlaceholderPage.tsx';

export function ArchivePage() {
  return (
    <PlaceholderPage
      title="Archive"
      description="Browse hero lore, skill descriptions, enemy bestiary, and the history of the realm. Knowledge is power."
      icon={<BookOpen size={28} />}
    />
  );
}

