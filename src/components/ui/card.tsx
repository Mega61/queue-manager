import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-line bg-surface shadow-[0_1px_2px_rgba(16,30,40,.04),0_8px_24px_-12px_rgba(16,30,40,.18)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line-2 px-4 py-3">
      {icon && <span className="flex text-mint-deep">{icon}</span>}
      <h2 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.13em] text-navy">{title}</h2>
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4 pt-3.5', className)} {...props} />;
}
