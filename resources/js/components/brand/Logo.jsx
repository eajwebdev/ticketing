import { cn } from '@/lib/utils';

/**
 * EAJ brand logo.
 * - variant="badge"    -> logo1.jpg (circular EA mark) alone — auth screens & loaders
 * - variant="wordmark" (default) -> modern lockup: EA badge + crisp HTML text.
 *   (logo2.png has heavy baked-in padding, so text is rendered in HTML for sharpness
 *    at any size — keeps headers compact while staying highly visible.)
 */
export function Logo({ className, size = 'md', variant = 'wordmark' }) {
  if (variant === 'badge') {
    const dims = { sm: 'h-9 w-9', md: 'h-12 w-12', lg: 'h-20 w-20' };
    return (
      <img
        src="/logo1.jpg"
        alt="EAJ"
        className={cn('rounded-full object-cover shadow-[0_0_22px_rgba(233,30,79,0.45)] ring-1 ring-navy-600', dims[size], className)}
      />
    );
  }

  // `sidebar` is a compact lockup sized to fit the 16rem app sidebar on one line.
  const badge = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-14 w-14', sidebar: 'h-10 w-10' };
  const title = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl', sidebar: 'text-lg' };
  const tag = {
    sm: 'text-[8px] tracking-[0.22em]',
    md: 'text-[9px] tracking-[0.22em]',
    lg: 'text-[11px] tracking-[0.22em]',
    sidebar: 'text-[8px] tracking-[0.14em]',
  };

  return (
    <div className={cn('flex min-w-0 items-center', size === 'sidebar' ? 'gap-2.5' : 'gap-3', className)}>
      <img
        src="/logo1.jpg"
        alt="EAJ"
        className={cn(
          'shrink-0 rounded-full object-cover ring-2 ring-crimson/40 shadow-[0_0_18px_rgba(233,30,79,0.45)]',
          badge[size]
        )}
      />
      <div className="min-w-0 leading-none">
        <div className={cn('whitespace-nowrap font-bold tracking-tight text-white', title[size])}>
          EAJ <span className="grad-text">Support</span>
        </div>
        <div className={cn('mt-1.5 whitespace-nowrap font-medium uppercase text-muted-foreground', tag[size])}>
          Web Development Services
        </div>
      </div>
    </div>
  );
}
