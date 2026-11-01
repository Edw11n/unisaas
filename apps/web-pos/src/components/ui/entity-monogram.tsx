'use client';

import React from 'react';

export interface EntityMonogramProps {
  name?: string | null;
  identifier?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square' | 'rounded';
  className?: string;
}

const PALETTES = [
  { bg: 'bg-indigo-700', text: 'text-indigo-50', border: 'border-indigo-600' },
  { bg: 'bg-slate-700', text: 'text-slate-50', border: 'border-slate-600' },
  { bg: 'bg-emerald-700', text: 'text-emerald-50', border: 'border-emerald-600' },
  { bg: 'bg-teal-700', text: 'text-teal-50', border: 'border-teal-600' },
  { bg: 'bg-cyan-700', text: 'text-cyan-50', border: 'border-cyan-600' },
  { bg: 'bg-sky-700', text: 'text-sky-50', border: 'border-sky-600' },
  { bg: 'bg-blue-700', text: 'text-blue-50', border: 'border-blue-600' },
  { bg: 'bg-violet-700', text: 'text-violet-50', border: 'border-violet-600' },
  { bg: 'bg-purple-700', text: 'text-purple-50', border: 'border-purple-600' },
  { bg: 'bg-fuchsia-700', text: 'text-fuchsia-50', border: 'border-fuchsia-600' },
  { bg: 'bg-rose-700', text: 'text-rose-50', border: 'border-rose-600' },
  { bg: 'bg-amber-700', text: 'text-amber-50', border: 'border-amber-600' },
];

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[9px] font-semibold tracking-tighter',
  sm: 'w-6 h-6 text-[10px] font-bold tracking-tight',
  md: 'w-8 h-8 text-xs font-bold tracking-wide',
  lg: 'w-10 h-10 text-sm font-extrabold tracking-wide',
  xl: 'w-12 h-12 text-base font-extrabold tracking-wider',
  '2xl': 'w-16 h-16 text-xl font-black tracking-wider',
};

const SHAPE_MAP = {
  circle: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-xl',
};

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'US';
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'US';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getPaletteIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % PALETTES.length;
}

export function EntityMonogram({
  name,
  identifier,
  size = 'md',
  shape = 'rounded',
  className = '',
}: EntityMonogramProps) {
  const seed = identifier || name || 'default-entity';
  const palette = PALETTES[getPaletteIndex(seed)];
  const initials = getInitials(name);
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const shapeClasses = SHAPE_MAP[shape] || SHAPE_MAP.rounded;

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 border select-none ${palette.bg} ${palette.text} ${palette.border} ${sizeClasses} ${shapeClasses} ${className}`}
      title={name || undefined}
      aria-label={name || 'Monograma de entidad'}
    >
      <span>{initials}</span>
    </div>
  );
}

