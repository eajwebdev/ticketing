import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Ticket, PlusCircle, Inbox, CheckCircle2, Clock, AlertCircle, ArrowRight, Users, CalendarClock, Wallet, KanbanSquare,
} from 'lucide-react';
import api from '@/lib/api';
import { can, P } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { useTickets } from '@/hooks/queries';
import { StatCard } from '@/components/StatCard';
import { TicketCard } from '@/components/tickets/TicketCard';
import { useCreateTicket } from '@/components/tickets/CreateTicketDialog';
import { Button } from '@/components/ui/button';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import { humanizeMinutes, peso, dueLabel, DUE_META } from '@/lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const { openCreateTicket } = useCreateTicket();
  const isTeam = user?.role !== 'customer';

  const { data: openTickets, isLoading } = useTickets(
    isTeam ? { status: 'open', per_page: 6 } : { per_page: 6 }
  );

  const { data: analytics } = useQuery({
    queryKey: ['dashboard-analytics'],
    enabled: can(user, P.ANALYTICS),
    queryFn: async () => (await api.get('/admin/analytics', { params: { range: '30d' } })).data,
  });

  const kpis = analytics?.kpis;

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isTeam ? "Here's what needs your attention today." : 'Track your support tickets and chat with our team.'}
          </p>
        </div>
        <Button onClick={openCreateTicket}><PlusCircle /> New Ticket</Button>
      </div>

      {/* Admin KPIs */}
      {can(user, P.ANALYTICS) && kpis && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} icon={Ticket} label="Total tickets (30d)" value={kpis.total_tickets}
            trend={kpis.total_tickets_prev ? Math.round(((kpis.total_tickets - kpis.total_tickets_prev) / kpis.total_tickets_prev) * 100) : null} />
          <StatCard index={1} icon={Inbox} label="Open now" value={kpis.open_now} accent="#3B82F6" />
          <StatCard index={2} icon={Clock} label="Avg first response" value={humanizeMinutes(kpis.avg_first_response_minutes)} accent="#F59E0B" />
          <StatCard index={3} icon={CheckCircle2} label="Resolved (30d)" value={kpis.resolved} accent="#22C55E" />
        </div>
      )}

      {isTeam && <MyWorkPanel />}
      {can(user, P.BILLING) && <BillingPanel />}

      {/* Quick actions for customers */}
      {!isTeam && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickAction onClick={openCreateTicket} icon={PlusCircle} title="Create a ticket" desc="Report an issue or ask a question" />
          <QuickAction to="/app/tickets" icon={Ticket} title="My tickets" desc="View and track your requests" />
          <QuickAction to="/" icon={Users} title="Meet the team" desc="See the people who support you" />
        </div>
      )}

      {/* Ticket list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {isTeam ? 'Open & awaiting pickup' : 'Your recent tickets'}
          </h2>
          <Button asChild variant="ghost" size="sm"><Link to="/app/tickets">View all <ArrowRight /></Link></Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : openTickets?.data?.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {openTickets.data.map((t, i) => <TicketCard key={t.id} ticket={t} index={i} showCustomer={isTeam} />)}
          </div>
        ) : (
          <EmptyState
            icon={isTeam ? CheckCircle2 : Inbox}
            title={isTeam ? 'No open tickets 🎉' : 'No tickets yet'}
            description={isTeam ? 'Everything is picked up. Great work!' : 'Create your first ticket and our team will jump on it.'}
            action={!isTeam && <Button onClick={openCreateTicket}><PlusCircle /> Create a ticket</Button>}
          />
        )}
      </div>
    </div>
  );
}

const PRIORITY_DOT = { urgent: '#E91E4F', high: '#F59E0B', medium: '#3B82F6', low: '#8A96B8' };

function MyWorkPanel() {
  const { data } = useQuery({
    queryKey: ['tasks', { assignee: 'me', dashboard: true }],
    queryFn: async () => (await api.get('/tasks', { params: { assignee: 'me' } })).data,
  });
  if (!data) return null;
  const open = (data.data ?? []).filter((t) => t.status !== 'done')
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    .slice(0, 6);
  const s = data.summary;

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><KanbanSquare className="h-5 w-5 text-crimson-soft" /> My work</h2>
          <p className="text-xs text-muted-foreground">
            {s.mine_open} open task{s.mine_open === 1 ? '' : 's'}
            {s.mine_overdue > 0 && <> · <span className="font-semibold text-crimson-soft">{s.mine_overdue} overdue</span></>}
            {' · '}{s.done_this_week} done by the team this week
          </p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to="/app/tasks">Open board <ArrowRight /></Link></Button>
      </div>
      {open.length ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {open.map((t) => (
            <Link key={t.id} to={`/app/tasks?task=${t.id}`} className="flex items-center gap-3 rounded-xl bg-navy-800/50 p-3 transition-colors hover:bg-navy-700/60">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRIORITY_DOT[t.priority] }} title={`${t.priority} priority`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-mist">{t.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {t.status.replace('_', ' ')}{t.client && ` · ${t.client.store_name || t.client.name}`}
                </div>
              </div>
              {t.due_date && (
                <span className={`shrink-0 text-[11px] ${t.is_overdue ? 'font-semibold text-crimson-soft' : 'text-muted-foreground'}`}>
                  {t.is_overdue ? 'Overdue' : `Due ${t.due_date.slice(5)}`}
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> No open tasks assigned to you.</p>
      )}
    </div>
  );
}

function BillingPanel() {
  const { data } = useQuery({
    queryKey: ['billing-overview'],
    queryFn: async () => (await api.get('/admin/billing/overview')).data,
  });
  if (!data) return null;
  const items = data.attention?.data ?? data.attention ?? [];

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><CalendarClock className="h-5 w-5 text-crimson-soft" /> Billing</h2>
          <p className="text-xs text-muted-foreground">
            <span className={data.overdue ? 'font-semibold text-crimson-soft' : ''}>{data.overdue} overdue</span>
            {' · '}{data.due_soon} due in 7 days · {peso(data.sales_this_month)} collected this month
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/app/admin/sales"><Wallet /> Sales</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/app/admin/client-systems">All systems <ArrowRight /></Link></Button>
        </div>
      </div>
      {items.length ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {items.map((s) => {
            const meta = DUE_META[s.due_state] ?? DUE_META.upcoming;
            return (
              <Link key={s.id} to={`/app/admin/client-systems?focus=${s.id}`}
                className="flex items-center gap-3 rounded-xl bg-navy-800/50 p-3 transition-colors hover:bg-navy-700/60">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-mist">{s.client?.store_name || s.client?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.display_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">{peso(s.amount)}</div>
                  <div className="text-[11px]" style={{ color: meta.color }}>{dueLabel(s.days_until_due)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Nothing due in the next 7 days.</p>
      )}
    </div>
  );
}

function QuickAction({ to, onClick, icon: Icon, title, desc }) {
  const cls = 'hover-lift group rounded-2xl glass p-5 text-left hover:border-crimson/40';
  const body = (
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-crimson/15 p-3 text-crimson-soft transition-transform group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-mist">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
  );
  return onClick
    ? <button type="button" onClick={onClick} className={cls}>{body}</button>
    : <Link to={to} className={cls}>{body}</Link>;
}
