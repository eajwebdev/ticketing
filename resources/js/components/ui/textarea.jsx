import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[96px] w-full rounded-xl border border-navy-600 bg-navy-800/60 px-4 py-3 text-sm text-mist',
      'placeholder:text-muted-foreground/70 transition-colors resize-y',
      'focus-visible:outline-none focus-visible:border-crimson/60 focus-visible:ring-2 focus-visible:ring-crimson/30',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
