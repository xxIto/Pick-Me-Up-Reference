import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-[#171426] border border-[#2a2540] flex items-center justify-center text-violet-400 mb-2">
        {icon ?? <Construction size={28} />}
      </div>
      <h1 className="text-xl font-bold text-[#F4F1FA]">{title}</h1>
      <p className="text-sm text-[#918BA5] max-w-xs">{description}</p>
      <span className="mt-2 text-xs text-[#4a4560] border border-[#2a2540] rounded-full px-3 py-1">
        Coming in a future update
      </span>
    </div>
  );
}

