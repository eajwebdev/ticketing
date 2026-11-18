import { cloneElement } from 'react';
import {
  PiggyBank, Wallet, Receipt, AlertTriangle, Inbox, ShieldAlert, KanbanSquare, BellRing, CalendarCheck2,
  Ticket, CheckCircle2, CalendarClock, Target, TrendingUp,
} from 'lucide-react';
import { peso } from '@/lib/format';
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
      <Kpi key="rev" icon={Wallet} label="Collected this month" value={peso(f.month.revenue)} accent="#22C55E"
        delta={<Delta value={pctChange(f.month.revenue, f.month.revenue_prev)} />} to="/app/admin/sales" />,
      <Kpi key="exp" icon={Receipt} label="Expenses this month" value={peso(f.month.expenses)} accent="#E91E4F"
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
    f && { icon: Wallet, label: 'Payments this month', value: f.month.payments_count },
    leads && { icon: BellRing, label: 'Follow-ups due', value: leads.follow_ups.length, warn: leads.follow_ups.some((l) => l.is_overdue) },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
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
        <Panel title="Money trend" icon={TrendingUp} subtitle="Collected vs expenses, last 6 months — the blue line is your net profit."
          action={<PanelLink to="/app?tab=finance">Finance details</PanelLink>}>
          <MoneyTrendChart data={f.trend} />
        </Panel>
      )}
    </div>
  );
}
