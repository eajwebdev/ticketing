import { cloneElement } from 'react';
import {
  PiggyBank, Wallet, Receipt, AlertTriangle, Inbox, ShieldAlert, KanbanSquare, BellRing, CalendarCheck2,
  Ticket, CheckCircle2, CalendarClock, Target, TrendingUp,
} from 'lucide-react';
import { peso } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Kpi, KpiGrid, Panel, PanelLink, Delta, pctChange, AttentionList, MoneyTrendChart,
} from './widgets';

/** The "glance" view: headline numbers, what needs someone now, and the money trend. */
export default function OverviewTab({ data }) {
  const f = data.finance;
  const s = data.support;
  const t = data.work.tasks;
  const leads = data.work.leads;
  const mine = data.work.scope === 'mine';

  const tiles = [];
  if (f) {
    tiles.push(
      <Kpi key="net" icon={PiggyBank} label={`Net profit · ${f.month.label}`} value={peso(f.month.net)}
        accent={f.month.net >= 0 ? '#22C55E' : '#E91E4F'} tone={f.month.net < 0 ? 'danger' : 'default'}
        delta={<Delta value={pctChange(f.month.net, f.month.net_prev)} />} to="/app?tab=finance" />,
      <Kpi key="rev" icon={Wallet} label={`Collected · ${f.month.label}`} value={peso(f.month.revenue)} accent="#22C55E"
        delta={<Delta value={pctChange(f.month.revenue, f.month.revenue_prev)} />} to="/app/admin/sales" />,
      <Kpi key="exp" icon={Receipt} label={`Expenses · ${f.month.label}`} value={peso(f.month.expenses)} accent="#E91E4F"
        delta={<Delta value={pctChange(f.month.expenses, f.month.expenses_prev)} invert />} to="/app?tab=expenses" />,
      <Kpi key="overdue" icon={AlertTriangle} label="Overdue payments" value={peso(f.receivables.overdue_amount)}
        accent="#F59E0B" tone={f.receivables.overdue_count ? 'warning' : 'default'}
        sub={`${f.receivables.overdue_count} system${f.receivables.overdue_count === 1 ? '' : 's'} · ${f.receivables.due_soon_count} due in 7 days`}
        to="/app/admin/client-systems" />,
    );
  }
  if (s) {
    tiles.push(
      <Kpi key="waiting" icon={Inbox} label="Tickets waiting" value={s.waiting} accent="#3B82F6"
        tone={s.waiting ? 'warning' : 'default'} sub={`${s.in_progress} in progress`} to="/app/tickets" />,
      <Kpi key="sla" icon={ShieldAlert} label="Past SLA" value={s.sla_breached} accent="#E91E4F"
        tone={s.sla_breached ? 'danger' : 'success'} sub={s.sla_breached ? 'Resolve these first' : 'All on time'} to="/app?tab=support" />,
    );
  }
  tiles.push(
    <Kpi key="tasks" icon={KanbanSquare} label={mine ? 'My open tasks' : 'Open tasks (team)'} value={t.open} accent="#8B5CF6"
      tone={t.overdue ? 'danger' : 'default'} sub={t.overdue ? `${t.overdue} overdue` : `${t.done_this_week} done this week`} to="/app/tasks" />,
  );
  if (leads) {
    tiles.push(
      <Kpi key="pipe" icon={Target} label="Sales pipeline" value={peso(leads.pipeline_value)} accent="#14B8A6"
        sub={`${leads.open} open lead${leads.open === 1 ? '' : 's'} · ${leads.won_this_month} won`} to="/app/leads" />,
    );
  }

  const today = [
    s && { icon: Ticket, label: 'New tickets', value: s.created_today },
    s && { icon: CheckCircle2, label: 'Resolved', value: s.resolved_today },
    { icon: CalendarClock, label: 'Tasks due', value: t.due_today, warn: t.due_today > 0 },
    f && { icon: Wallet, label: 'Client payments in range', value: f.month.payments_count },
    leads && { icon: BellRing, label: 'Follow-ups due', value: leads.follow_ups.length, warn: leads.follow_ups.some((l) => l.is_overdue) },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {f && <EarningsPanel f={f} range={data.range} />}

      <KpiGrid>{tiles.map((tile, i) => cloneElement(tile, { index: i }))}</KpiGrid>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Needs attention" icon={AlertTriangle}
          subtitle="Most urgent first — click any item to deal with it.">
          <AttentionList items={data.attention} />
        </Panel>
        <Panel title="Today" icon={CalendarCheck2} subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
          <ul className="divide-y divide-navy-600/60">
            {today.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><r.icon className="h-4 w-4" />{r.label}</span>
                <span className={`text-lg font-semibold tabular-nums ${r.warn ? 'text-amber-400' : 'text-white'}`}>{r.value}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {f && (
        <Panel title="Money trend" icon={TrendingUp} subtitle={`Collected vs expenses${f.trend.length ? ` · ${f.trend[0].label} – ${f.trend[f.trend.length - 1].label}` : ''} — the blue line is your net profit.`}
          action={<PanelLink to="/app?tab=finance">Finance details</PanelLink>}>
          <MoneyTrendChart data={f.trend} />
        </Panel>
      )}
    </div>
  );
}

/**
 * The answer to "how much did we actually make?": income with no deductions, the fixed
 * monthly costs (salaries, maintenance, commissions, bills) and other expenses taken out,
 * and what's left — for this month so far and for a typical month.
 */
function EarningsPanel({ f, range }) {
  const m = f.month;
  const po = f.payouts ?? {};
  // "Still to pay this month" only makes sense when the range covers today.
  const fixedLeft = range?.includes_today ? po.due_this_month_amount ?? 0 : 0;
  const afterAll = m.net - fixedLeft;
  const margin = m.revenue > 0 ? Math.round((m.net / m.revenue) * 100) : null;
  const keptPct = m.revenue > 0 ? Math.max(0, Math.min(100, (m.net / m.revenue) * 100)) : 0;
  const fixedPct = m.revenue > 0 ? Math.min(100 - keptPct, (m.fixed_paid / m.revenue) * 100) : 0;

  return (
    <Panel title={`Company earnings · ${m.label}`} icon={PiggyBank}
      subtitle="Income before and after salaries, fixed monthly costs and other expenses."
      action={<PanelLink to="/app?tab=payouts">Fixed costs</PanelLink>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label} (actual)</div>
          <Line label="Total income — no deductions" value={m.revenue} strong
            hint={f.setup_revenue > 0 ? `incl. ${peso(f.setup_revenue)} one-time setup fees` : `${m.payments_count} client payment${m.payments_count === 1 ? '' : 's'}`} />
          <Line label="Fixed monthly costs paid" hint="Salaries, maintenance, marketing, commissions, bills" value={-m.fixed_paid} />
          <Line label="Other expenses" value={-m.other_expenses} />
          <Line label="Earnings after deductions" value={m.net} total
            hint={margin != null ? `${margin}% of income kept` : 'No income collected yet'} />
          {m.revenue > 0 && (
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-navy-700" title="Kept · fixed costs · other expenses">
              <div className="bg-emerald-500" style={{ width: `${keptPct}%` }} />
              <div className="bg-violet-500" style={{ width: `${fixedPct}%` }} />
              <div className="flex-1 bg-crimson/70" />
            </div>
          )}
          {fixedLeft > 0 && (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {peso(fixedLeft)} in fixed costs is still to pay this month — after paying it you'd keep{' '}
              <span className="font-semibold">{peso(afterAll)}</span>.
            </p>
          )}
        </div>

        <div className="lg:border-l lg:border-navy-600/60 lg:pl-6">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Every month (expected)</div>
          <Line label="Recurring income — no deductions" value={po.mrr ?? f.mrr} strong
            hint={`${f.active_systems} active client system${f.active_systems === 1 ? '' : 's'}`} />
          {(po.by_category ?? []).map((c) => (
            <Line key={c.category} label={c.category} value={-c.monthly} hint={`${c.count} payout${c.count === 1 ? '' : 's'}`} />
          ))}
          {!(po.by_category ?? []).length && <Line label="Fixed monthly costs" value={0} hint="None added yet" />}
          <Line label="Expected earnings after fixed costs" value={po.net_mrr ?? f.mrr} total
            hint="Before one-off expenses and setup fees" />
        </div>
      </div>
    </Panel>
  );
}

function Line({ label, value, hint, strong = false, total = false }) {
  const negative = value < 0;
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', total && 'mt-1 border-t border-navy-600/60 pt-2.5')}>
      <div className="min-w-0">
        <div className={cn('text-sm', total || strong ? 'font-semibold text-white' : 'text-mist')}>{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <div className={cn('shrink-0 tabular-nums',
        total ? cn('text-xl font-bold', value < 0 ? 'text-crimson-soft' : 'text-emerald-400')
          : strong ? 'text-lg font-semibold text-white'
            : negative ? 'text-sm text-crimson-soft' : 'text-sm text-muted-foreground')}>
        {negative ? `− ${peso(-value)}` : peso(value)}
      </div>
    </div>
  );
}
