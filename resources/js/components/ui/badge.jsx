import * as React from 'react';
import { cn } from '@/lib/utils';

function Badge({ className, style, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border border-navy-600/60',
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

// Status pill with animated dot
function StatusBadge({ meta, className }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', className)}
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}33` }}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: meta.color }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: meta.color }} />
      </span>
      {meta.label}
    </span>
  );
}

export { Badge, StatusBadge };
