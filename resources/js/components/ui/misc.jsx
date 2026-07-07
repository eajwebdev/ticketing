import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Tooltip } from './tooltip';

export function Spinner({ className }) {
  return <Loader2 className={cn('animate-spin text-crimson-soft', className)} />;
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo1.jpg" alt="EAJ" className="h-16 w-16 animate-pulse-glow rounded-full object-cover ring-1 ring-navy-600" />
        <Spinner className="h-6 w-6" />
      </div>
    </div>
  );
}

export function Skeleton({ className }) {
  return (
    <div
      className={cn('rounded-xl bg-navy-700/60', className)}
      style={{
        backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
        backgroundSize: '400px 100%',
        backgroundRepeat: 'no-repeat',
        animation: 'shimmer 1.6s linear infinite',
      }}
    />
  );
}

/**
 * Icon-only action button with an on-brand tooltip. Used everywhere per spec:
 * no text labels for row/table actions.
 */
export const IconButton = React.forwardRef(function IconButton(
  { label, icon: Icon, side = 'top', variant = 'ghost', size = 'icon', className, ...props },
  ref
) {
  return (
    <Tooltip label={label} side={side}>
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={label}
        className={cn('text-mist/70 hover:text-crimson-soft hover:scale-110 transition-transform', className)}
        {...props}
      >
        <Icon />
      </Button>
    </Tooltip>
  );
});

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-navy-600 py-16 text-center">
      {Icon && (
        <div className="rounded-2xl bg-navy-700/60 p-4">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="font-semibold text-mist">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
