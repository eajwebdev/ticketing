import { useMemo, useState } from 'react';
import {
  addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfQuarter, endOfYear, format, isAfter, isBefore,
  isSameDay, isSameMonth, startOfMonth, startOfQuarter, startOfWeek, startOfYear, subDays, subMonths, subYears,
} from 'date-fns';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { localDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const toISO = (d) => format(d, 'yyyy-MM-dd');

/** Common ranges. Each returns [from, to] as Dates. */
export const RANGE_PRESETS = [
  { key: 'today', label: 'Today', get: (t) => [t, t] },
  { key: 'yesterday', label: 'Yesterday', get: (t) => [subDays(t, 1), subDays(t, 1)] },
  { key: '7d', label: 'Last 7 days', get: (t) => [subDays(t, 6), t] },
  { key: '30d', label: 'Last 30 days', get: (t) => [subDays(t, 29), t] },
  { key: 'this_month', label: 'This month', get: (t) => [startOfMonth(t), endOfMonth(t)] },
  { key: 'last_month', label: 'Last month', get: (t) => [startOfMonth(subMonths(t, 1)), endOfMonth(subMonths(t, 1))] },
  { key: 'last_3_months', label: 'Last 3 months', get: (t) => [startOfMonth(subMonths(t, 2)), endOfMonth(t)] },
  { key: 'this_quarter', label: 'This quarter', get: (t) => [startOfQuarter(t), endOfQuarter(t)] },
  { key: 'this_year', label: 'This year', get: (t) => [startOfYear(t), endOfYear(t)] },
  { key: 'last_year', label: 'Last year', get: (t) => [startOfYear(subYears(t, 1)), endOfYear(subYears(t, 1))] },
];

/** Which preset (if any) a from/to pair matches. */
export function matchPreset(from, to, today = new Date()) {
  return RANGE_PRESETS.find((p) => {
    const [a, b] = p.get(today);
    return toISO(a) === from && toISO(b) === to;
  });
}

export function rangeLabel(from, to) {
  if (!from || !to) return 'Pick dates';
  const preset = matchPreset(from, to);
  if (preset) return preset.label;
  const a = localDate(from);
  const b = localDate(to);
  if (isSameDay(a, b)) return format(a, 'MMM d, yyyy');
  if (a.getFullYear() === b.getFullYear()) return `${format(a, 'MMM d')} – ${format(b, 'MMM d, yyyy')}`;
  return `${format(a, 'MMM d, yyyy')} – ${format(b, 'MMM d, yyyy')}`;
}

/**
 * One button → popover with quick presets and a two-month calendar.
 * value / onChange use { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }.
 */
export function DateRangePicker({ value, onChange, className, align = 'start' }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: null, to: null }); // Dates while picking
  const [hover, setHover] = useState(null);
  const [month, setMonth] = useState(() => startOfMonth(localDate(value.from) ?? new Date()));
  const today = new Date();

  const openChange = (next) => {
    if (next) {
      const from = localDate(value.from);
      const to = localDate(value.to);
      setDraft({ from, to });
      // Show the end month on the right where possible.
      setMonth(startOfMonth(to && !isSameMonth(from, to) ? subMonths(to, 1) : from ?? today));
      setHover(null);
    }
    setOpen(next);
  };

  const pickDay = (day) => {
    if (!draft.from || draft.to) {
      setDraft({ from: day, to: null }); // start a new range
    } else if (isBefore(day, draft.from)) {
      setDraft({ from: day, to: draft.from });
    } else {
      setDraft({ from: draft.from, to: day });
    }
  };

  const apply = (from, to) => {
    onChange({ from: toISO(from), to: toISO(to) });
    setOpen(false);
  };

  // While only the start is chosen, preview up to the hovered day.
  const previewEnd = draft.from && !draft.to && hover ? hover : draft.to;
  const [lo, hi] = draft.from && previewEnd && isBefore(previewEnd, draft.from) ? [previewEnd, draft.from] : [draft.from, previewEnd];
  const days = draft.from && draft.to ? differenceInCalendarDays(draft.to, draft.from) + 1 : null;
  const activePreset = matchPreset(value.from, value.to, today)?.key;

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn('inline-flex h-9 items-center gap-2 rounded-xl border border-navy-600 bg-navy-800/60 px-3 text-sm text-mist transition-colors',
            'hover:border-crimson/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60',
            open && 'border-crimson/60 text-white', className)}
          aria-label={`Date range: ${rangeLabel(value.from, value.to)}`}>
          <CalendarRange className="h-4 w-4 text-crimson-soft" />
          <span className="font-medium">{rangeLabel(value.from, value.to)}</span>
          {matchPreset(value.from, value.to, today) && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {format(localDate(value.from), 'MMM d')}{value.from !== value.to && ` – ${format(localDate(value.to), 'MMM d')}`}
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(calc(100vw-24px),40rem)] overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-navy-600/60 p-2 [scrollbar-width:none] sm:w-40 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-b-0 sm:border-r [&::-webkit-scrollbar]:hidden">
            {RANGE_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => apply(...p.get(today))}
                className={cn('shrink-0 rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                  activePreset === p.key ? 'bg-crimson/15 font-medium text-white' : 'text-mist/80 hover:bg-navy-700 hover:text-white')}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="min-w-0 flex-1 p-3">
            <div className="flex items-start gap-4">
              <MonthGrid month={month} lo={lo} hi={hi} today={today} onPick={pickDay} onHover={setHover}
                nav={<NavButton label="Previous month" icon={ChevronLeft} onClick={() => setMonth((m) => subMonths(m, 1))} />}
                navEnd={<span className="sm:hidden"><NavButton label="Next month" icon={ChevronRight} onClick={() => setMonth((m) => addMonths(m, 1))} /></span>} />
              <div className="hidden sm:block">
                <MonthGrid month={addMonths(month, 1)} lo={lo} hi={hi} today={today} onPick={pickDay} onHover={setHover}
                  navEnd={<NavButton label="Next month" icon={ChevronRight} onClick={() => setMonth((m) => addMonths(m, 1))} />} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-navy-600/60 pt-3">
              <span className="text-xs text-muted-foreground">
                {draft.from && draft.to
                  ? <><span className="text-mist">{rangeLabel(toISO(draft.from), toISO(draft.to))}</span> · {days} day{days === 1 ? '' : 's'}</>
                  : draft.from ? 'Now pick the end date' : 'Pick a start date'}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="button" size="sm" disabled={!draft.from || !draft.to} onClick={() => apply(draft.from, draft.to)}>Apply</Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NavButton({ label, icon: Icon, onClick }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-navy-700 hover:text-white">
      <Icon className="h-4 w-4" />
    </button>
  );
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function MonthGrid({ month, lo, hi, today, onPick, onHover, nav, navEnd }) {
  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  return (
    <div className="w-full min-w-0 sm:w-[15.5rem]" onMouseLeave={() => onHover(null)}>
      <div className="mb-2 flex h-7 items-center justify-between">
        {nav ?? <span className="w-7" />}
        <span className="text-sm font-semibold text-white">{format(month, 'MMMM yyyy')}</span>
        {navEnd ?? <span className="w-7" />}
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase text-muted-foreground">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7" role="grid" aria-label={format(month, 'MMMM yyyy')}>
        {cells.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isStart = lo && isSameDay(day, lo);
          const isEnd = hi && isSameDay(day, hi);
          const inside = lo && hi && isAfter(day, lo) && isBefore(day, hi);
          const edge = isStart || isEnd;
          if (!inMonth) return <div key={day.toISOString()} className="h-8" />;
          return (
            <div key={day.toISOString()}
              className={cn('h-8',
                inside && 'bg-crimson/15',
                isStart && hi && !isSameDay(lo, hi) && 'rounded-l-lg bg-crimson/15',
                isEnd && lo && !isSameDay(lo, hi) && 'rounded-r-lg bg-crimson/15')}>
              <button type="button" onClick={() => onPick(day)} onMouseEnter={() => onHover(day)}
                aria-pressed={!!edge} aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                className={cn('h-8 w-full rounded-lg text-sm tabular-nums transition-colors',
                  edge ? 'bg-crimson font-semibold text-white'
                    : inside ? 'text-white hover:bg-crimson/30'
                      : 'text-mist/90 hover:bg-navy-700 hover:text-white',
                  !edge && isSameDay(day, today) && 'font-semibold text-crimson-soft ring-1 ring-inset ring-crimson/40')}>
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
