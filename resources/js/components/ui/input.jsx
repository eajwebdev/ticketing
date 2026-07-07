import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-11 w-full rounded-xl border border-navy-600 bg-navy-800/60 px-4 py-2 text-sm text-mist',
      'placeholder:text-muted-foreground/70 transition-colors',
      'focus-visible:outline-none focus-visible:border-crimson/60 focus-visible:ring-2 focus-visible:ring-crimson/30',
      'disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:text-mist',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
