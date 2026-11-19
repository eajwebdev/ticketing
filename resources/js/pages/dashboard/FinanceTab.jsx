import { useState } from 'react';
import { Wallet, Repeat, AlertTriangle, CalendarClock, TrendingUp, Receipt, PiggyBank, History, BadgeCheck, Wrench, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PayDialog, SetupPayDialog } from '@/pages/admin/ClientSystems';
import { PayoutRow, PayoutPayDialog, PayAllDialog, useRefreshMoney } from './PayoutsTab';
import { peso, dueLabel, DUE_META, METHOD_LABELS, shortDate, localDate } from '@/lib/format';
import {
  Kpi, KpiGrid, Panel, PanelLink, Delta, pctChange, MoneyTrendChart, Row, AllClear, BarList, PALETTE,
} from './widgets';

/** Money in and money out: collections, receivables, and where expenses go. */
export default function FinanceTab({ data }) {
  const f = data.finance;
  const po = f.payouts;
  const refresh = useRefreshMoney();
  const [dialog, setDialog] = useState(null); // {kind: 'pay'|'setup'|'payout', item}
  const margin = f.month.revenue > 0 ? Math.round((f.month.net / f.month.revenue) * 100) : null;

  return (
    <div className="space-y-5">
      <KpiGrid>
        <Kpi index={0} icon={Wallet} label={`Collected · ${f.month.label}`} value={peso(f.month.revenue)} accent="#22C55E"
          delta={<Delta value={pctChange(f.month.revenue, f.month.revenue_prev)} />}
          sub={`${f.month.payments_count} payment${f.month.payments_count === 1 ? '' : 's'}${f.setup_revenue > 0 ? ` · ${peso(f.setup_revenue)} setup fees` : ''}`} to="/app/admin/sales" />
        <Kpi index={1} icon={PiggyBank} label="Net profit" value={peso(f.month.net)}
          accent={f.month.net >= 0 ? '#22C55E' : '#E91E4F'} tone={f.month.net < 0 ? 'danger' : 'default'}
          delta={<Delta value={pctChange(f.month.net, f.month.net_prev)} />}
          sub={margin != null ? `${margin}% margin` : 'No collections yet'} />
        <Kpi index={2} icon={AlertTriangle} label="Overdue" value={peso(f.receivables.overdue_amount)} accent="#E91E4F"
          tone={f.receivables.overdue_count ? 'danger' : 'success'}
          sub={[
            f.receivables.overdue_count ? `${f.receivables.overdue_count} system${f.receivables.overdue_count === 1 ? '' : 's'} to collect` : 'Nothing overdue',
            f.receivables.setup_unpaid_count ? `+ ${peso(f.receivables.setup_unpaid_amount)} setup unpaid` : null,
          ].filter(Boolean).join(' · ')}
          to="/app/admin/client-systems" />
        <Kpi index={3} icon={Repeat} label="Monthly recurring (MRR)" value={peso(f.mrr)} accent="#3B82F6"
          sub={po?.monthly_total > 0
            ? `− ${peso(po.monthly_total)} payouts = ${peso(po.net_mrr)} we keep`
            : `${f.active_systems} active system${f.active_systems === 1 ? '' : 's'} · ${peso(f.receivables.due_soon_amount)} due in 7 days`}
          to={po?.monthly_total > 0 ? '/app?tab=payouts' : '/app/admin/client-systems'} />
      </KpiGrid>

      <Panel title="Collected vs expenses" icon={TrendingUp}
        subtitle={`${f.trend.length > 0 ? `${f.trend[0].label} – ${f.trend[f.trend.length - 1].label}` : f.month.label}. Blue line = net profit.`}>
        <MoneyTrendChart data={f.trend} height={300} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Clients to collect from" icon={CalendarClock} subtitle="Due in the next 7 days or overdue."
          action={<PanelLink to="/app/admin/client-systems">All systems</PanelLink>}>
          {f.due.length ? (
            <div className="space-y-2">
              {f.due.map((s) => {
                const meta = DUE_META[s.due_state] ?? DUE_META.upcoming;
                return (
                  <ActionRow key={s.id} dot={meta.color} title={s.client?.store_name || s.client?.name} subtitle={s.display_name}
                    right={peso(s.amount)} rightSub={dueLabel(s.days_until_due)} rightColor={meta.color}
                    action={<Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'pay', item: s })}><BadgeCheck /> Mark paid</Button>} />
                );
              })}
            </div>
          ) : <AllClear>Nothing due in the next 7 days.</AllClear>}
        </Panel>

        <Panel title="Payouts to make" icon={HandCoins}
          subtitle={po ? `${peso(po.monthly_total)}/mo committed · ${peso(po.paid_this_month)} paid this month` : undefined}
          action={(
            <div className="flex items-center gap-3">
              {po?.due_this_month_count > 0 && (
                <Button size="sm" onClick={() => setDialog({ kind: 'payAll' })}>Pay all due · {peso(po.due_this_month_amount)}</Button>
              )}
              <PanelLink to="/app?tab=payouts">All payouts</PanelLink>
            </div>
          )}>
          {po?.due?.length ? (
            <ul className="space-y-2">
              {po.due.map((p) => <PayoutRow key={p.id} p={p} compact onAction={(_, item) => setDialog({ kind: 'payout', item })} />)}
            </ul>
          ) : <AllClear>No payouts due in the next 7 days.</AllClear>}
        </Panel>

        <Panel title="One-time setup fees to collect" icon={Wrench}
          subtitle={f.receivables.setup_unpaid_count
            ? `${peso(f.receivables.setup_unpaid_amount)} from ${f.receivables.setup_unpaid_count} system${f.receivables.setup_unpaid_count === 1 ? '' : 's'}${f.setup_revenue > 0 ? ` · ${peso(f.setup_revenue)} collected this month` : ''}`
            : f.setup_revenue > 0 ? `${peso(f.setup_revenue)} collected this month` : undefined}>
          {f.setup_unpaid?.length ? (
            <div className="space-y-2">
              {f.setup_unpaid.map((s) => (
                <ActionRow key={s.id} dot="#8B5CF6" title={s.client?.store_name || s.client?.name} subtitle={`${s.display_name} · setup fee`}
                  right={peso(s.setup_fee)} rightSub="one-time"
                  action={<Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'setup', item: s })}><Wrench /> Record</Button>} />
              ))}
            </div>
          ) : <AllClear>All setup fees are collected.</AllClear>}
        </Panel>

        <Panel title="Recent payments" icon={History} action={<PanelLink to="/app/admin/sales">Sales</PanelLink>}>
          {f.recent_payments.length ? (
            <div className="space-y-2">
              {f.recent_payments.map((p) => (
                <Row key={p.id} dot={p.kind === 'setup' ? '#8B5CF6' : '#22C55E'} title={p.client}
                  subtitle={p.kind === 'setup' ? `${p.system} · Setup fee` : p.system}
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

      {dialog?.kind === 'pay' && <PayDialog system={dialog.item} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.kind === 'setup' && <SetupPayDialog system={dialog.item} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.kind === 'payout' && <PayoutPayDialog payout={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'payAll' && <PayAllDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

/** A list row with its own button (the plain Row is a link). */
function ActionRow({ dot, title, subtitle, right, rightSub, rightColor, action }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-navy-800/50 px-3 py-2.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-mist">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums text-white">{right}</div>
        <div className="text-[11px] font-medium" style={{ color: rightColor }}>{rightSub}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
