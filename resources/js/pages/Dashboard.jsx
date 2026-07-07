import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Ticket, PlusCircle, Inbox, CheckCircle2, Clock, AlertCircle, ArrowRight, Users,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTickets } from '@/hooks/queries';
import { StatCard } from '@/components/StatCard';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Button } from '@/components/ui/button';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import { humanizeMinutes } from '@/lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const isTeam = user?.role !== 'customer';

  const { data: openTickets, isLoading } = useTickets(
    isTeam ? { status: 'open', per_page: 6 } : { per_page: 6 }
  );

  const { data: analytics } = useQuery({
    queryKey: ['dashboard-analytics'],
    enabled: user?.role === 'admin',
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
        <Button asChild><Link to="/app/tickets/new"><PlusCircle /> New Ticket</Link></Button>
      </div>

      {/* Admin KPIs */}
      {user?.role === 'admin' && kpis && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} icon={Ticket} label="Total tickets (30d)" value={kpis.total_tickets}
            trend={kpis.total_tickets_prev ? Math.round(((kpis.total_tickets - kpis.total_tickets_prev) / kpis.total_tickets_prev) * 100) : null} />
          <StatCard index={1} icon={Inbox} label="Open now" value={kpis.open_now} accent="#3B82F6" />
          <StatCard index={2} icon={Clock} label="Avg first response" value={humanizeMinutes(kpis.avg_first_response_minutes)} accent="#F59E0B" />
          <StatCard index={3} icon={CheckCircle2} label="Resolved (30d)" value={kpis.resolved} accent="#22C55E" />
        </div>
      )}

      {/* Quick actions for customers */}
      {!isTeam && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickAction to="/app/tickets/new" icon={PlusCircle} title="Create a ticket" desc="Report an issue or ask a question" />
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
            action={!isTeam && <Button asChild><Link to="/app/tickets/new"><PlusCircle /> Create a ticket</Link></Button>}
          />
        )}
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, desc }) {
  return (
    <Link to={to} className="hover-lift group rounded-2xl glass p-5 hover:border-crimson/40">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-crimson/15 p-3 text-crimson-soft transition-transform group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-mist">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
