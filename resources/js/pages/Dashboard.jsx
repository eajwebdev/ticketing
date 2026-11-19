import { Link, useSearchParams } from 'react-router-dom';
import {
  Ticket, PlusCircle, Inbox, ArrowRight, Users, LayoutDashboard, Wallet, Receipt, Headset, KanbanSquare,
  WifiOff, RefreshCw, HandCoins,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTickets } from '@/hooks/queries';
import { TicketCard } from '@/components/tickets/TicketCard';
import { useCreateTicket } from '@/components/tickets/CreateTicketDialog';
import { Button } from '@/components/ui/button';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useDashboard, LiveBadge, TabSkeleton } from './dashboard/widgets';
import { DateRangePicker, RANGE_PRESETS, toISO } from '@/components/ui/date-range-picker';
import OverviewTab from './dashboard/OverviewTab';
import FinanceTab from './dashboard/FinanceTab';
import ExpensesTab from './dashboard/ExpensesTab';
import PayoutsTab from './dashboard/PayoutsTab';
import SupportTab from './dashboard/SupportTab';
import WorkTab from './dashboard/WorkTab';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  return user?.role === 'customer' ? <CustomerDashboard /> : <TeamDashboard />;
}

// ---------------------------------------------------------------- team

const TABS = {
  overview: { label: 'Overview', icon: LayoutDashboard, Component: OverviewTab },
  finance: { label: 'Finance', icon: Wallet, Component: FinanceTab },
  payouts: { label: 'Payouts', icon: HandCoins, Component: PayoutsTab },
  expenses: { label: 'Expenses', icon: Receipt, Component: ExpensesTab },
  support: { label: 'Support', icon: Headset, Component: SupportTab },
  work: { label: 'Tasks & Leads', icon: KanbanSquare, Component: WorkTab },
};

/** Live count shown on each tab so you can see where action is needed without opening it. */
function tabBadge(key, data) {
  switch (key) {
    case 'overview': {
      const n = data.attention?.length ?? 0;
      return n ? { n, urgent: data.attention.some((a) => a.severity >= 3) } : null;
    }
    case 'finance': {
      const n = data.finance?.receivables.overdue_count ?? 0;
      return n ? { n, urgent: true } : null;
    }
    case 'payouts': {
      const p = data.finance?.payouts;
      if (!p) return null;
      return p.overdue_count ? { n: p.overdue_count, urgent: true } : p.due_soon_count ? { n: p.due_soon_count, urgent: false } : null;
    }
    case 'support': {
      const s = data.support;
      if (!s) return null;
      return s.sla_breached ? { n: s.sla_breached, urgent: true } : s.waiting ? { n: s.waiting, urgent: false } : null;
    }
    case 'work': {
      const n = data.work?.tasks.overdue ?? 0;
      return n ? { n, urgent: true } : null;
    }
    default:
      return null;
  }
}

function TeamDashboard() {
  const { user } = useAuth();
  const { openCreateTicket } = useCreateTicket();
  const [params, setParams] = useSearchParams();
  // ?from=YYYY-MM-DD&to=YYYY-MM-DD — default this month. Kept in the URL so it survives refresh and can be shared.
  const thisMonth = RANGE_PRESETS.find((p) => p.key === 'this_month').get(new Date()).map(toISO);
  const range = {
    from: /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') ?? '') ? params.get('from') : thisMonth[0],
    to: /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') ?? '') ? params.get('to') : thisMonth[1],
  };
  if (range.to < range.from) [range.from, range.to] = [thisMonth[0], thisMonth[1]];
  const isDefaultRange = range.from === thisMonth[0] && range.to === thisMonth[1];
  const setRange = (next) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (next.from === thisMonth[0] && next.to === thisMonth[1]) { n.delete('from'); n.delete('to'); }
    else { n.set('from', next.from); n.set('to', next.to); }
    return n;
  }, { replace: true });
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } = useDashboard(range);

  const sections = data?.sections ?? ['overview'];
  const requested = params.get('tab');
  const tab = sections.includes(requested) ? requested : 'overview';
  const setTab = (next) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (next === 'overview') n.delete('tab'); else n.set('tab', next);
    return n;
  }, { replace: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <div className="mt-2">
            <LiveBadge updatedAt={dataUpdatedAt} fetching={isFetching} error={isError && !!data} onRefresh={() => refetch()} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <DateRangePicker value={range} onChange={setRange} align="end" />
          {!isDefaultRange && (
            <Button variant="ghost" size="sm" onClick={() => setRange({ from: thisMonth[0], to: thisMonth[1] })}>Reset</Button>
          )}
          <Button onClick={openCreateTicket}><PlusCircle /> New Ticket</Button>
        </div>
      </div>

      {isLoading && !data ? (
        <TabSkeleton />
      ) : !data ? (
        <EmptyState icon={WifiOff} title="Couldn't load the dashboard"
          description="Check your connection — it will retry automatically."
          action={<Button variant="outline" onClick={() => refetch()}><RefreshCw /> Try again</Button>} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max">
              {sections.map((key) => {
                const t = TABS[key];
                if (!t) return null;
                const badge = tabBadge(key, data);
                return (
                  <TabsTrigger key={key} value={key} className="group gap-2">
                    <t.icon className="h-4 w-4" />{t.label}
                    {badge && (
                      <span className={cn(
                        'min-w-5 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums leading-4',
                        badge.urgent ? 'bg-crimson text-white group-data-[state=active]:bg-[#fff] group-data-[state=active]:text-crimson'
                          : 'bg-amber-500/20 text-amber-400 group-data-[state=active]:bg-[#fff]/25 group-data-[state=active]:text-[#fff]'
                      )}>{badge.n > 99 ? '99+' : badge.n}</span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          {sections.map((key) => {
            const t = TABS[key];
            return t ? (
              <TabsContent key={key} value={key} className="mt-5">
                <t.Component data={data} />
              </TabsContent>
            ) : null;
          })}
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- customer

function CustomerDashboard() {
  const { user } = useAuth();
  const { openCreateTicket } = useCreateTicket();
  const { data: tickets, isLoading } = useTickets({ per_page: 6 });

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your support tickets and chat with our team.</p>
        </div>
        <Button onClick={openCreateTicket}><PlusCircle /> New Ticket</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickAction onClick={openCreateTicket} icon={PlusCircle} title="Create a ticket" desc="Report an issue or ask a question" />
        <QuickAction to="/app/tickets" icon={Ticket} title="My tickets" desc="View and track your requests" />
        <QuickAction to="/" icon={Users} title="Meet the team" desc="See the people who support you" />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Your recent tickets</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/app/tickets">View all <ArrowRight /></Link></Button>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : tickets?.data?.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tickets.data.map((t, i) => <TicketCard key={t.id} ticket={t} index={i} />)}
          </div>
        ) : (
          <EmptyState icon={Inbox} title="No tickets yet"
            description="Create your first ticket and our team will jump on it."
            action={<Button onClick={openCreateTicket}><PlusCircle /> Create a ticket</Button>} />
        )}
      </div>
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

