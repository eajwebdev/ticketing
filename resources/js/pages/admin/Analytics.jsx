import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Ticket, Inbox, CheckCircle2, Clock, Zap, RotateCcw, Users, CalendarDays, Gauge, Download, Trophy,
} from 'lucide-react';
import api, { getToken } from '@/lib/api';
import { useLookups } from '@/hooks/queries';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { humanizeMinutes } from '@/lib/format';

const PALETTE = ['#E91E4F', '#FF4D75', '#3B82F6', '#F59E0B', '#22C55E', '#8B5CF6', '#8A96B8'];
const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export default function Analytics() {
  const { data: lookups } = useLookups();
  const [filters, setFilters] = useState({ range: '30d', system_type: 'all', urgency: 'all' });

  const params = {
    range: filters.range,
    ...(filters.system_type !== 'all' && { system_type: filters.system_type }),
    ...(filters.urgency !== 'all' && { urgency: filters.urgency }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', params],
    queryFn: async () => (await api.get('/admin/analytics', { params })).data,
    keepPreviousData: true,
  });

  const kpis = data?.kpis;

  const exportCsv = () => {
    const qs = new URLSearchParams(params).toString();
    // token-authed download via fetch → blob
    fetch(`/api/v1/admin/analytics/export?${qs}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `eaj-analytics-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your support command center.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.range} onValueChange={(v) => setFilters({ ...filters, range: v })}>
            <SelectTrigger className="w-40"><CalendarDays className="mr-1 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>{RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.system_type} onValueChange={(v) => setFilters({ ...filters, system_type: v })}>
            <SelectTrigger className="w-40"><SelectValue placeholder="System" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All systems</SelectItem>
              {lookups?.system_types?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}><Download /> Export CSV</Button>
        </div>
      </div>

      {isLoading && !kpis ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : kpis ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard index={0} icon={Ticket} label="Total tickets" value={kpis.total_tickets}
              trend={kpis.total_tickets_prev ? Math.round(((kpis.total_tickets - kpis.total_tickets_prev) / kpis.total_tickets_prev) * 100) : null} />
            <StatCard index={1} icon={Inbox} label="Open now" value={kpis.open_now} accent="#3B82F6" />
            <StatCard index={2} icon={CheckCircle2} label="Resolved" value={kpis.resolved} accent="#22C55E" />
            <StatCard index={3} icon={Clock} label="Tickets today" value={kpis.tickets_today} accent="#8B5CF6" />
            <StatCard index={4} icon={Zap} label="Avg first response" value={humanizeMinutes(kpis.avg_first_response_minutes)} accent="#F59E0B" />
            <StatCard index={5} icon={Gauge} label="Avg resolution" value={humanizeMinutes(kpis.avg_resolution_minutes)} accent="#FF4D75" />
            <StatCard index={6} icon={RotateCcw} label="Reopened rate" value={`${kpis.reopened_rate}%`} accent="#E91E4F" />
            <StatCard index={7} icon={Users} label="Active clients" value={kpis.active_clients} accent="#22C55E" />
          </div>

          {/* SLA bar */}
          {kpis.sla_percent != null && (
            <ChartCard title="SLA compliance" subtitle="Tickets resolved within their urgency SLA">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold grad-text">{kpis.sla_percent}%</div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-navy-700">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-crimson to-crimson-soft"
                    initial={{ width: 0 }} animate={{ width: `${kpis.sla_percent}%` }} transition={{ duration: 1 }} />
                </div>
              </div>
            </ChartCard>
          )}

          {/* Charts grid */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <ChartCard className="lg:col-span-2" title="Tickets over time" subtitle="Created vs resolved">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.tickets_over_time} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E91E4F" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#E91E4F" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d3060" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#8A96B8', fontSize: 11 }} tickFormatter={(d) => d?.slice(5)} minTickGap={24} />
                  <YAxis tick={{ fill: '#8A96B8', fontSize: 11 }} allowDecimals={false} />
                  <RTooltip contentStyle={TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="created" stroke="#E91E4F" fill="url(#gCreated)" strokeWidth={2} name="Created" />
                  <Area type="monotone" dataKey="resolved" stroke="#22C55E" fill="url(#gResolved)" strokeWidth={2} name="Resolved" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="By status">
              <DonutChart data={data.by_status} />
            </ChartCard>

            <ChartCard title="By system type">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.by_system_type} layout="vertical" margin={{ left: 20, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d3060" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8A96B8', fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#8A96B8', fontSize: 11 }} width={90} />
                  <RTooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(233,30,79,0.08)' }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Tickets">
                    {data.by_system_type.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="By urgency">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.by_urgency} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d3060" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#8A96B8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8A96B8', fontSize: 11 }} allowDecimals={false} />
                  <RTooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(233,30,79,0.08)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Tickets">
                    {data.by_urgency.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="By category">
              <DonutChart data={data.by_category} />
            </ChartCard>
          </div>

          {/* Peak hours heatmap */}
          <ChartCard title="Peak hours" subtitle="When tickets come in — by day and hour">
            <PeakHeatmap data={data.peak_hours} />
          </ChartCard>

          {/* Agent leaderboard */}
          <ChartCard title="Agent leaderboard" subtitle="Resolved tickets & average resolution time">
            <div className="space-y-2">
              {data.agent_leaderboard.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No resolutions in this period yet.</p>
              ) : data.agent_leaderboard.map((a, i) => {
                const max = Math.max(...data.agent_leaderboard.map((x) => x.resolved), 1);
                return (
                  <div key={a.id} className="flex items-center gap-4 rounded-xl bg-navy-800/40 p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-700 text-xs font-bold text-mist">
                      {i === 0 ? <Trophy className="h-4 w-4 text-amber-400" /> : i + 1}
                    </div>
                    <UserAvatar user={a} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium text-mist">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{a.resolved} resolved · {humanizeMinutes(a.avg_resolution_minutes)} avg</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy-700">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-crimson to-crimson-soft"
                          initial={{ width: 0 }} animate={{ width: `${(a.resolved / max) * 100}%` }} transition={{ duration: 0.8 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </>
      ) : null}
    </div>
  );
}

const TOOLTIP = {
  background: 'rgba(21,36,73,0.95)', border: '1px solid #1d3060', borderRadius: 12,
  color: '#eaf0ff', fontSize: 12, backdropFilter: 'blur(8px)',
};

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl glass p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PeakHeatmap({ data }) {
  if (!data?.length) return <p className="py-16 text-center text-sm text-muted-foreground">No data</p>;
  const max = Math.max(...data.map((c) => c.value), 1);
  const grid = {};
  data.forEach((c) => { grid[`${c.dow}-${c.hour}`] = c.value; });

  const color = (v) => {
    if (!v) return 'rgba(29,48,96,0.35)';
    const t = 0.18 + (v / max) * 0.82;
    return `rgba(233,30,79,${t.toFixed(2)})`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* hour axis */}
        <div className="mb-1 flex pl-9">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {DOW.map((label, dow) => (
          <div key={dow} className="mb-1 flex items-center">
            <div className="w-9 shrink-0 text-[10px] text-muted-foreground">{label}</div>
            <div className="flex flex-1 gap-1">
              {Array.from({ length: 24 }).map((_, h) => {
                const v = grid[`${dow}-${h}`] ?? 0;
                return (
                  <Tooltip key={h} label={`${label} ${h}:00 — ${v} ticket${v === 1 ? '' : 's'}`}>
                    <div
                      className="h-5 flex-1 rounded-[3px] transition-transform hover:scale-125"
                      style={{ background: color(v) }}
                    />
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          Less
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span key={t} className="h-3 w-3 rounded-[3px]" style={{ background: t ? `rgba(233,30,79,${(0.18 + t * 0.82).toFixed(2)})` : 'rgba(29,48,96,0.35)' }} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}

function DonutChart({ data }) {
  if (!data?.length) return <p className="py-16 text-center text-sm text-muted-foreground">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={90} paddingAngle={3} stroke="none">
          {data.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <RTooltip contentStyle={TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
