import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, WifiOff, CheckCircle2, ChevronRight,
  ShieldAlert, Inbox, Wallet, KanbanSquare, Target, Wrench,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { fromNow, peso, pesoShort } from '@/lib/format';
import { IconButton, Skeleton } from '@/components/ui/misc';

// ---------------------------------------------------------------- live data

/** How often the dashboard refreshes while the browser tab is visible. */
export const LIVE_INTERVAL = 30_000;

/**
 * One permission-aware snapshot from /dashboard. React Query pauses polling
 * while the tab is hidden and refetches the moment it's focused again, and
 * keeps showing the last good data if a request fails.
 */
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data,
    refetchInterval: LIVE_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    retry: 1,
  });
}

function useNow(everyMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

function ago(ts, now) {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

/** "Live · updated 12s ago" pill + manual refresh. Turns amber when the last refresh failed. */
export function LiveBadge({ updatedAt, fetching, error, onRefresh }) {
  const now = useNow();
  return (
    <div className="flex items-center gap-1.5">
      <span
        role="status"
        aria-live="polite"
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
          error ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        )}
      >
        {error ? (
          <WifiOff className="h-3.5 w-3.5" />
        ) : (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        )}
        {error ? `Connection issue · showing data from ${ago(updatedAt, now)}` : `Live · updated ${ago(updatedAt, now)}`}
      </span>
      <IconButton label="Refresh now" icon={RefreshCw} size="icon-sm" onClick={onRefresh} disabled={fetching}
        className={cn(fetching && '[&_svg]:animate-spin')} />
    </div>
  );
}

// ---------------------------------------------------------------- numbers

/** % change, or null when there's nothing to compare against. */
export function pctChange(cur, prev) {
  if (prev == null || cur == null) return null;
  if (Number(prev) === 0) return Number(cur) === 0 ? 0 : null;
  return Math.round(((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100);
}

/** ▲ 12% — green when it's good news. `invert` for costs, where up is bad. */
export function Delta({ value, invert = false, suffix = 'vs last month' }) {
  if (value == null) return null;
  const good = invert ? value <= 0 : value >= 0;
  const Icon = value === 0 ? Minus : value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium',
      value === 0 ? 'text-muted-foreground' : good ? 'text-emerald-400' : 'text-crimson-soft')}>
      <Icon className="h-3 w-3" />
      {Math.abs(value)}%<span className="font-normal text-muted-foreground">{suffix}</span>
    </span>
  );
}

const TONES = {
  default: '',
  danger: 'border-crimson/40 shadow-[0_0_0_1px_rgba(233,30,79,0.15)]',
  warning: 'border-amber-500/40',
  success: 'border-emerald-500/30',
};

/**
 * KPI tile. `to` makes the whole tile a link to where you act on it.
 * `tone` highlights tiles that need attention (e.g. overdue > 0).
 */
export function Kpi({ icon: Icon, label, value, sub, delta, accent = '#E91E4F', to, tone = 'default', index = 0 }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${accent}1f`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 truncate text-2xl font-bold tabular-nums text-white">{value}</div>
      <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {delta}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </>
  );
  const cls = cn('group relative block rounded-2xl glass p-4 transition-colors', TONES[tone], to && 'hover:border-crimson/40');
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      {to ? (
        <Link to={to} className={cls}>
          {body}
          <ChevronRight className="absolute bottom-4 right-3 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      ) : <div className={cls}>{body}</div>}
    </motion.div>
  );
}

export function KpiGrid({ children, className }) {
  return <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>{children}</div>;
}

// ---------------------------------------------------------------- layout

export function Panel({ title, icon: Icon, subtitle, action, children, className }) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-2xl glass p-5', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            {Icon && <Icon className="h-4 w-4 text-crimson-soft" />}{title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

export function PanelLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-crimson-soft hover:underline">
      {children}<ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function AllClear({ children }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-emerald-500/5 px-3 py-4 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> {children}
    </p>
  );
}

/** Clickable list row used across tabs. */
export function Row({ to, dot, title, subtitle, right, rightSub, rightTone, rightColor }) {
  const inner = (
    <>
      {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-mist">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {(right != null || rightSub) && (
        <div className="shrink-0 text-right">
          {right != null && <div className="text-sm font-semibold tabular-nums text-white">{right}</div>}
          {rightSub && <div className={cn('text-[11px]', rightTone || 'text-muted-foreground')} style={rightColor ? { color: rightColor } : undefined}>{rightSub}</div>}
        </div>
      )}
    </>
  );
  const cls = 'flex items-center gap-3 rounded-xl bg-navy-800/50 px-3 py-2.5';
  return to
    ? <Link to={to} className={cn(cls, 'transition-colors hover:bg-navy-700/60')}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}

/** Horizontal bars, e.g. expenses by category. rows: [{ label, value, color, display }] */
export function BarList({ rows, format = (v) => v, empty = 'Nothing yet.' }) {
  const max = Math.max(0, ...rows.map((r) => Number(r.value) || 0));
  if (!rows.length || max === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-mist">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-white">{r.display ?? format(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-navy-700">
            <motion.div className="h-full rounded-full" style={{ background: r.color ?? '#E91E4F' }}
              initial={false} animate={{ width: `${Math.max(2, (Number(r.value) / max) * 100)}%` }} transition={{ duration: 0.5 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export const PALETTE = ['#E91E4F', '#3B82F6', '#F59E0B', '#22C55E', '#8B5CF6', '#14B8A6', '#EC4899', '#0EA5E9', '#F97316', '#84CC16', '#8A96B8'];

// ---------------------------------------------------------------- charts

// Neutral greys that read on both the dark and the light theme.
export const AXIS = { fill: '#8A96B8', fontSize: 11 };
export const GRID = 'rgba(138,150,184,0.18)';

export function ChartTooltip({ active, payload, label, money = false }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl glass-strong px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-white">{payload[0]?.payload?.tooltipLabel ?? label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}
          </span>
          <span className="font-semibold tabular-nums text-mist">{money ? peso(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Revenue vs expenses bars with a net-profit line. data: finance.trend */
export function MoneyTrendChart({ data, height = 260 }) {
  const rows = (data ?? []).map((d) => ({ ...d, tooltipLabel: d.month }));
  if (!rows.some((d) => d.revenue || d.expenses)) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No payments or expenses recorded yet — they'll chart here automatically.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => pesoShort(v)} />
        <Tooltip content={<ChartTooltip money />} cursor={{ fill: 'rgba(138,150,184,0.08)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar isAnimationActive={false} dataKey="revenue" name="Collected" fill="#22C55E" radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar isAnimationActive={false} dataKey="expenses" name="Expenses" fill="#E91E4F" radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Line isAnimationActive={false} type="monotone" dataKey="net" name="Net profit" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------- attention

const KIND = {
  sla: { icon: ShieldAlert, label: 'SLA' },
  waiting: { icon: Inbox, label: 'Ticket' },
  billing: { icon: Wallet, label: 'Billing' },
  setup: { icon: Wrench, label: 'Setup fee' },
  task: { icon: KanbanSquare, label: 'Task' },
  lead: { icon: Target, label: 'Lead' },
};
const SEVERITY = { 3: '#E91E4F', 2: '#F59E0B', 1: '#3B82F6' };

/** Everything that needs someone, most urgent first. */
export function AttentionList({ items }) {
  if (!items?.length) return <AllClear>All clear — nothing overdue or waiting right now.</AllClear>;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => {
        const k = KIND[it.kind] ?? KIND.task;
        const color = SEVERITY[it.severity] ?? SEVERITY[1];
        return (
          <li key={`${it.kind}-${i}-${it.link}`}>
            <Link to={it.link} className="group flex items-center gap-3 rounded-xl bg-navy-800/50 px-3 py-2.5 transition-colors hover:bg-navy-700/60">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}>
                <k.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-mist">{it.title}</div>
                <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>
              </div>
              <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{it.at ? fromNow(it.at) : ''}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function TabSkeleton() {
  return (
    <div className="space-y-4">
      <KpiGrid>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</KpiGrid>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
