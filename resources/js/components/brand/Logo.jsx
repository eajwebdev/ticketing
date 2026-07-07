import { cn } from '@/lib/utils';

/**
 * EAJ brand logo.
 * - variant="badge"  -> logo1.jpg (circular EA mark) — used on login/auth & loaders
 * - variant="wordmark" (default) -> logo2.png (full EAJ wordmark) — app chrome, icons, headers
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

  const heights = { sm: 'h-7', md: 'h-9', lg: 'h-12' };
  return (
    <img
      src="/logo2.png"
      alt="EAJ Web Development Services"
      className={cn('w-auto rounded-lg object-contain', heights[size], className)}
    />
  );
}
