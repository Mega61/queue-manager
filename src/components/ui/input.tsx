import * as React from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded-[9px] border border-line bg-[#fbfcfd] px-[11px] py-[9px] text-[13px] text-foreground ' +
  'placeholder:text-[#b3bec4] transition-[border-color,box-shadow,background-color] ' +
  'focus:outline-none focus:border-mint focus:bg-white focus:ring-[3px] focus:ring-mint/20';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, className)} {...props} />,
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(base, 'min-h-[150px] resize-y font-mono text-xs leading-relaxed', className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 mt-3 block text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted', className)}
      {...props}
    />
  );
}
