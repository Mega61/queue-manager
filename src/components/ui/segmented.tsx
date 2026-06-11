'use client';

import { cn } from '@/lib/utils';

interface Option<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options, value, onChange, className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('mt-1.5 flex gap-1 rounded-[11px] bg-[#eef1f3] p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors',
            value === o.value
              ? 'bg-white text-navy shadow-[0_1px_3px_rgba(16,30,40,.12)]'
              : 'text-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
