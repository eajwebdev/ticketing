import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-crimson text-white shadow-[0_8px_24px_-8px_rgba(233,30,79,0.6)] hover:bg-crimson-dark hover:shadow-[0_0_24px_rgba(233,30,79,0.5)]',
        secondary:
          'bg-navy-700 text-mist border border-navy-600 hover:bg-navy-600',
        outline:
          'border border-navy-600 bg-transparent text-mist hover:bg-navy-700 hover:border-navy-500',
        ghost: 'text-mist/80 hover:bg-navy-700 hover:text-white',
        destructive:
          'bg-rose-600 text-white hover:bg-rose-700 shadow-[0_8px_24px_-8px_rgba(225,29,72,0.6)]',
        link: 'text-crimson-soft underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-12 px-7 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
