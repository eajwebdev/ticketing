import { Wallet, Repeat, AlertTriangle, CalendarClock, TrendingUp, Receipt, PiggyBank, History } from 'lucide-react';
import { peso, dueLabel, DUE_META, METHOD_LABELS, shortDate, localDate } from '@/lib/format';
import {
  Kpi, KpiGrid, Panel, PanelLink, Delta, pctChange, MoneyTrendChart, Row, AllClear, BarList, PALETTE,
} from './widgets';

/** Money in and money out: collections, receivables, and where expenses go. */
export default function FinanceTab({ data }) {
  const f = data.finance;
  const margin = f.month.revenue > 0 ? Math.round((f.month.net / f.month.revenue) * 100) : null;

  return (
    <div className="space-y-5">
      <KpiGrid>
        <Kpi index={0} icon={Wallet} label={`Collected · ${f.month.label}`} value={peso(f.month.revenue)} accent="#22C55E"
          delta={<Delta value={pctChange(f.month.revenue, f.month.revenue_prev)} />}
          sub={`${f.month.payments_count} payment${f.month.payments_count === 1 ? '' : 's'}`} to="/app/admin/sales" />
        <Kpi index={1} icon={PiggyBank} label="Net profit" value={peso(f.month.net)}
          accent={f.month.net >= 0 ? '#22C55E' : '#E91E4F'} tone={f.month.net < 0 ? 'danger' : 'default'}
          delta={<Delta value={pctChange(f.month.net, f.month.net_prev)} />}
          sub={margin != null ? `${margin}% margin` : 'No collections yet'} />
        <Kpi index={2} icon={AlertTriangle} label="Overdue" value={peso(f.receivables.overdue_amount)} accent="#E91E4F"
          tone={f.receivables.overdue_count ? 'danger' : 'success'}
          sub={f.receivables.overdue_count ? `${f.receivables.overdue_count} system${f.receivables.overdue_count === 1 ? '' : 's'} to collect` : 'Nothing overdue'}
          to="/app/admin/client-systems" />
        <Kpi index={3} icon={Repeat} label="Monthly recurring (MRR)" value={peso(f.mrr)} accent="#3B82F6"
          sub={`${f.active_systems} active system${f.active_systems === 1 ? '' : 's'} · ${peso(f.receivables.due_soon_amount)} due in 7 days`}
          to="/app/admin/client-systems" />
      </KpiGrid>

      <Panel title="Collected vs expenses" icon={TrendingUp} subtitle="Last 6 months. Blue line = net profit.">
        <MoneyTrendChart data={f.trend} height={300} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Due & overdue" icon={CalendarClock} subtitle="Next 7 days — click to mark paid."
          action={<PanelLink to="/app/admin/client-systems">All systems</PanelLink>}>
          {f.due.length ? (
            <div className="space-y-2">
              {f.due.map((s) => {
                const meta = DUE_META[s.due_state] ?? DUE_META.upcoming;
                return (
                  <Row key={s.id} to={`/app/admin/client-systems?focus=${s.id}`} dot={meta.color}
                    title={s.client?.store_name || s.client?.name} subtitle={s.display_name}
                    right={peso(s.amount)} rightSub={dueLabel(s.days_until_due)} rightTone="font-medium" rightColor={meta.color} />
                );
              })}
            </div>
          ) : <AllClear>Nothing due in the next 7 days.</AllClear>}
        </Panel>

        <Panel title="Recent payments" icon={History} action={<PanelLink to="/app/admin/sales">Sales</PanelLink>}>
          {f.recent_payments.length ? (
            <div className="space-y-2">
              {f.recent_payments.map((p) => (
                <Row key={p.id} dot="#22C55E" title={p.client} subtitle={p.system}
                  right={peso(p.amount)} rightSub={`${shortDate(localDate(p.paid_at))} · ${METHOD_LABELS[p.method] ?? p.method}`} />
              ))}
            </div>
          ) : <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>}
        </Panel>
      </div>

      <Panel title={`Where the money goes · ${f.month.label}`} icon={Receipt}
        subtitle={`${peso(f.month.expenses)} spent this month`} action={<PanelLink to="/app?tab=expenses">Manage expenses</PanelLink>}>
        <BarList format={peso} empty="No expenses recorded this month."
          rows={f.expenses_by_category.map((c, i) => ({ label: c.category, value: c.total, color: PALETTE[i % PALETTE.length] }))} />
      </Panel>
    </div>
  );
}
