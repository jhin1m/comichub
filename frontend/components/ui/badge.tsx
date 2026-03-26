import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'info' | 'accent';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-surface border border-default text-secondary',
  success: 'bg-success/10 border border-success/30 text-success',
  warning: 'bg-warning/10 border border-warning/30 text-warning',
  info: 'bg-info/10 border border-info/30 text-info',
  accent: 'bg-accent/10 border border-accent/30 text-accent',
};

function Badge({ variant = 'default', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-rajdhani font-bold uppercase tracking-wider rounded',
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps };
