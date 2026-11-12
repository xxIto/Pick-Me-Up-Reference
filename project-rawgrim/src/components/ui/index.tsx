import type { ReactNode, ButtonHTMLAttributes } from 'react';

// ─── Button ───────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-violet-600 hover:bg-violet-500 text-white border border-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.25)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]',
  secondary:
    'bg-[#1e1b30] hover:bg-[#262040] text-[#F4F1FA] border border-[#2e2a44]',
  ghost:
    'bg-transparent hover:bg-white/5 text-[#918BA5] hover:text-[#F4F1FA] border border-transparent',
  gold:
    'bg-[#1a1408] hover:bg-[#241c0a] text-[#D6B36A] border border-[#D6B36A]/40 shadow-[0_0_10px_rgba(214,179,106,0.15)] hover:shadow-[0_0_18px_rgba(214,179,106,0.3)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  leftIcon,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center gap-2 font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full justify-center' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
  as?: 'div' | 'article' | 'section';
}

export function Card({ children, className = '', glow = false, onClick, as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      onClick={onClick}
      className={[
        'bg-[#171426] border border-[#2a2540] rounded-xl',
        glow ? 'shadow-[0_0_20px_rgba(139,92,246,0.08)]' : '',
        onClick ? 'cursor-pointer hover:border-violet-500/40 transition-colors duration-200' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export type BadgeVariant = 'rarity-Common' | 'rarity-Rare' | 'rarity-Epic' | 'rarity-Legendary' | 'status-Active' | 'status-Injured' | 'status-Dead' | 'class';

const badgeVariantClasses: Record<string, string> = {
  'rarity-Common':    'bg-zinc-800 text-zinc-300 border border-zinc-600',
  'rarity-Rare':      'bg-blue-900/60 text-blue-300 border border-blue-700/50',
  'rarity-Epic':      'bg-violet-900/60 text-violet-300 border border-violet-600/50',
  'rarity-Legendary': 'bg-amber-900/60 text-amber-300 border border-amber-600/50',
  'rarity-1': 'bg-zinc-800 text-zinc-300 border border-zinc-600',
  'rarity-2': 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50',
  'rarity-3': 'bg-blue-900/60 text-blue-300 border border-blue-700/50',
  'rarity-4': 'bg-violet-900/60 text-violet-300 border border-violet-600/50',
  'rarity-5': 'bg-amber-900/60 text-amber-300 border border-amber-600/50',
  'status-Ready':   'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50',
  'status-Active':  'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50',
  'status-Injured': 'bg-orange-900/60 text-orange-300 border border-orange-700/50',
  'status-Dead':    'bg-red-900/60    text-red-300    border border-red-700/50',
  'class':          'bg-[#1e1b30] text-[#918BA5] border border-[#2e2a44]',
};

export interface BadgeProps {
  label: string;
  variant: string;
  className?: string;
}

export function Badge({ label, variant, className = '' }: BadgeProps) {
  const cls = badgeVariantClasses[variant] ?? badgeVariantClasses['class'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${cls} ${className}`}>
      {label}
    </span>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

export interface ProgressBarProps {
  value: number;      // current
  max: number;        // maximum
  color?: 'violet' | 'gold' | 'emerald' | 'rose' | 'orange';
  height?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const progressColorMap: Record<string, string> = {
  violet:  'bg-violet-500',
  gold:    'bg-amber-400',
  emerald: 'bg-emerald-500',
  rose:    'bg-rose-500',
  orange:  'bg-orange-500',
};

const progressHeightMap: Record<string, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
};

export function ProgressBar({
  value,
  max,
  color = 'violet',
  height = 'sm',
  showLabel = false,
  label,
  className = '',
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-[#918BA5]">{label}</span>}
          {showLabel && <span className="text-xs text-[#918BA5]">{value} / {max}</span>}
        </div>
      )}
      <div className={`w-full bg-[#0f0d1f] rounded-full overflow-hidden ${progressHeightMap[height]}`}>
        <div
          className={`${progressColorMap[color]} ${progressHeightMap[height]} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}

// ─── ResourceDisplay ──────────────────────────────────────────────────────────

export interface ResourceDisplayProps {
  icon: ReactNode;
  value: number | string;
  label?: string;
  color?: string;
  className?: string;
}

export function ResourceDisplay({ icon, value, label, color = '#D6B36A', className = '' }: ResourceDisplayProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span style={{ color }} className="text-base leading-none shrink-0">{icon}</span>
      <span className="font-semibold text-sm tabular-nums" style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {label && <span className="text-xs text-[#918BA5] hidden sm:block">{label}</span>}
    </div>
  );
}

// ─── HeroCard ─────────────────────────────────────────────────────────────────

import type { ResolvedHero } from '../../features/heroes/domain/types.ts';

export interface HeroCardProps {
  hero: ResolvedHero;
  size?: 'sm' | 'md';
  selected?: boolean;
  onClick?: (hero: ResolvedHero) => void;
  className?: string;
}

export function HeroCard({ hero, size = 'md', selected = false, onClick, className = '' }: HeroCardProps) {
  const isSmall = size === 'sm';
  const { instance, definition, stats } = hero;

  const hpColor = instance.currentHp / stats.hp > 0.5
    ? 'emerald'
    : instance.currentHp / stats.hp > 0.25
    ? 'orange'
    : 'rose';

  return (
    <article
      onClick={() => onClick?.(hero)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(hero); } : undefined}
      className={[
        'relative flex flex-col rounded-xl border transition-all duration-200 overflow-hidden',
        selected
          ? 'border-violet-500 shadow-[0_0_16px_rgba(139,92,246,0.4)]'
          : 'border-[#2a2540] hover:border-violet-500/40',
        onClick ? 'cursor-pointer' : '',
        isSmall ? 'p-2' : 'p-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Portrait */}
      <div
        className={`${isSmall ? 'w-10 h-10' : 'w-14 h-14'} rounded-lg mx-auto mb-2 flex items-center justify-center font-bold text-white text-sm shrink-0`}
        style={{ background: definition.portrait.gradient }}
        aria-hidden="true"
      >
        {definition.portrait.initials}
      </div>

      {/* Name & class */}
      <div className="text-center min-w-0">
        <p className={`font-semibold text-[#F4F1FA] truncate ${isSmall ? 'text-xs' : 'text-sm'}`}>{definition.name}</p>
        <p className="text-[10px] text-[#918BA5]">{definition.class}</p>
      </div>

      {/* HP bar */}
      {!isSmall && (
        <div className="mt-2">
          <ProgressBar value={instance.currentHp} max={stats.hp} color={hpColor} height="xs" />
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1 justify-center mt-2">
        <Badge label={`${definition.rarity}★`} variant={`rarity-${definition.rarity}`} />
        {instance.status !== 'Ready' && (
          <Badge label={instance.status} variant={`status-${instance.status}`} />
        )}
      </div>

      {/* Level chip */}
      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-[#918BA5] bg-[#0f0d1f]/80 px-1 rounded">
        Lv{instance.level}
      </span>
    </article>
  );
}

