import { Package } from 'lucide-react';
import { PlaceholderPage } from '../dashboard/PlaceholderPage.tsx';

export function InventoryPage() {
  return (
    <PlaceholderPage
      title="Inventory"
      description="Manage equipment, consumables, and crafting materials. Equip items to heroes to enhance their power."
      icon={<Package size={28} />}
    />
  );
}

