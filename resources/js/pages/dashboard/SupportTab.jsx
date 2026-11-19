import { Inbox, Loader, ShieldAlert, CheckCircle2, Activity, Flame, Hourglass } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { fromNow } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { can, P } from '@/lib/permissions';
import { Kpi, KpiGrid, Panel, PanelLink, Row, AllClear, BarList, ChartTooltip, AXIS, GRID } from './widgets';

/** The ticket queue at a glance: what's waiting, what's late, and the 14-day flow. */
export default function SupportTab({ data }) {
  const { user } = useAuth();
  const s = data.support;
  const totalActive = s.waiting + s.in_progress;

  return (
    <div className="space-y-5">
      <KpiGrid>
        <Kpi index={0} icon={Inbox} label="Waiting for pickup" value={s.waiting} accent="#3B82F6"
          tone={s.waiting ? 'warning' : 'success'} sub={s.waiting ? 'Accept these next' : 'Queue is empty'} to="/app/tickets?status=open" />
        <Kpi index={1} icon={Loader} label="In progress" value={s.in_progress} accent="#8B5CF6" to="/app/tickets?status=accepted" />
        <Kpi index={2} icon={ShieldAlert} label="Past SLA" value={s.sla_breached} accent="#E91E4F"
          tone={s.sla_breached ? 'danger' : 'success'} sub={s.sla_breached ? 'Overdue for resolution' : 'All within SLA'} />
        <Kpi index={3} icon={CheckCircle2} label="Resolved today" value={s.resolved_today} accent="#22C55E"
          sub={`${s.created_today} new today`} />
      </KpiGrid>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Ticket flow" icon={Activity} subtitle={`Created vs resolved · ${data.range?.label ?? ''} · ${s.created_in_range ?? 0} new, ${s.resolved_in_range ?? 0} resolved`}
          action={can(user, P.ANALYTICS) && <PanelLink to="/app/admin/analytics">Full analytics</PanelLink>}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={s.daily} margin={{ left: -16, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="dbCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E91E4F" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#E91E4F" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dbResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Area isAnimationActive={false} type="monotone" dataKey="created" name="Created" stroke="#E91E4F" fill="url(#dbCreated)" strokeWidth={2} />
              <Area isAnimationActive={false} type="monotone" dataKey="resolved" name="Resolved" stroke="#22C55E" fill="url(#dbResolved)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Active by urgency" icon={Flame} subtitle={`${totalActive} active ticket${totalActive === 1 ? '' : 's'}`}>
          <BarList empty="No active tickets."
            rows={s.by_urgency.map((u) => ({ label: u.name, value: u.value, color: u.color }))} />
        </Panel>
      </div>

      <Panel title="Waiting longest" icon={Hourglass} subtitle="Oldest unaccepted tickets first."
        action={<PanelLink to="/app/tickets">Ticket queue</PanelLink>}>
        {s.oldest_waiting.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {s.oldest_waiting.map((t) => (
              <Row key={t.id} to={`/app/tickets/${t.id}`} dot={t.urgency?.color ?? '#8A96B8'}
                title={`${t.number} · ${t.subject}`} subtitle={t.client}
                rightSub={`waiting ${fromNow(t.created_at).replace(' ago', '')}`} rightTone="font-medium text-amber-400" />
            ))}
          </div>
        ) : <AllClear>No tickets waiting — everything is picked up.</AllClear>}
      </Panel>
    </div>
  );
}
