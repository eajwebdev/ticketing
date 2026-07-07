import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, Inbox, Filter } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTickets, useLookups } from '@/hooks/queries';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'accepted', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'reopened', label: 'Reopened' },
  { value: 'closed', label: 'Closed' },
];

export default function TicketsList() {
  const { user } = useAuth();
  const isTeam = user?.role !== 'customer';
  const { data: lookups } = useLookups();
  const [filters, setFilters] = useState({ status: 'all', system_type: 'all', urgency: 'all', mine: false });
  const [search, setSearch] = useState('');

  const params = {
    ...(filters.status !== 'all' && { status: filters.status }),
    ...(filters.system_type !== 'all' && { system_type: filters.system_type }),
    ...(filters.urgency !== 'all' && { urgency: filters.urgency }),
    ...(filters.mine && { mine: 1 }),
    ...(search && { search }),
  };

  const { data, isLoading, isFetching } = useTickets(params);
  const tickets = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{isTeam ? 'Ticket Queue' : 'My Tickets'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.meta?.total != null ? `${data.meta.total} ticket${data.meta.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        <Button asChild><Link to="/app/tickets/new"><PlusCircle /> New Ticket</Link></Button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl glass p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search tickets…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.system_type} onValueChange={(v) => setFilters({ ...filters, system_type: v })}>
            <SelectTrigger><SelectValue placeholder="System" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All systems</SelectItem>
              {lookups?.system_types?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.urgency} onValueChange={(v) => setFilters({ ...filters, urgency: v })}>
            <SelectTrigger><SelectValue placeholder="Urgency" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All urgencies</SelectItem>
              {lookups?.urgency_levels?.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isTeam && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setFilters({ ...filters, mine: !filters.mine })}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filters.mine ? 'bg-crimson text-white' : 'bg-navy-700 text-muted-foreground hover:text-mist'
              }`}
            >
              <Filter className="h-3 w-3" /> Assigned to me
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : tickets.length ? (
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {tickets.map((t, i) => <TicketCard key={t.id} ticket={t} index={i} showCustomer={isTeam} />)}
        </div>
      ) : (
        <EmptyState icon={Inbox} title="No tickets found" description="Try adjusting your filters or create a new ticket." />
      )}
    </div>
  );
}
