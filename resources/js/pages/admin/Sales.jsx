import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import { Wallet, CalendarDays, TrendingUp, Receipt, Download, Trash2, ChevronLeft, ChevronRight, ServerCog } from 'lucide-react';
import api, { getToken } from '@/lib/api';
import { useLookups } from '@/hooks/queries';
import { systemIcon } from '@/lib/systemIcons';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import { IconButton, Skeleton, EmptyState } from '@/components/ui/misc';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { peso, pesoShort, METHOD_LABELS, localDate, todayISO } from '@/lib/format';

const PALETTE = ['#E91E4F', '#FF4D75', '#3B82F6', '#F59E0B', '#22C55E', '#8B5CF6', '#8A96B8'];
const TOOLTIP = {
  background: 'rgba(21,36,73,0.95)', border: '1px solid #1d3060', borderRadius: 12,
  color: '#eaf0ff', fontSize: 12, backdropFilter: 'blur(8px)',
};
const fmtDate = (iso) => (iso ? format(localDate(iso), 'MMM d, yyyy') : '—');

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PRESETS = {
  this_month: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), todayISO()]; },
  last_month: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))]; },
  this_year: () => [`${new Date().getFullYear()}-01-01`, todayISO()],
  all: () => ['2000-01-01', todayISO()],
};

export default function Sales() {
  const { data: lookups } = useLookups();
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState('this_year');
  const [[from, to], setRange] = useState(PRESETS.this_year());
  const [systemType, setSystemType] = useState('all');
  const [method, setMethod] = useState('all');
  const [page, setPage] = useState(1);
  const [voiding, setVoiding] = useState(null);

  const params = {
    from, to, page,
    ...(systemType !== 'all' && { system_type_id: systemType }),
    ...(method !== 'all' && { method }),
  };
  const { data, isLoading } = useQuery({
    queryKey: ['sales', params],
    queryFn: async () => (await api.get('/admin/sales', { params })).data,
    placeholderData: keepPreviousData,
  });

  const voidPay = useMutation({
    mutationFn: (id) => api.delete(`/admin/sales/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['client-systems'] });
      queryClient.invalidateQueries({ queryKey: ['billing-overview'] });
      toast.success('Payment voided.');
    },
    onError: () => toast.error('Could not void payment.'),
  });

  const pickPreset = (p) => { setPreset(p); if (PRESETS[p]) setRange(PRESETS[p]()); setPage(1); };
  const setDate = (which) => (e) => { setPreset('custom'); setRange(which === 'from' ? [e.target.value, to] : [from, e.target.value]); setPage(1); };

  const exportCsv = () => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'page'))).toString();
    fetch(`/api/v1/admin/sales/export?${qs}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `eaj-sales-${from}-to-${to}.csv`; a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Export failed.'));
  };

  const s = data?.summary;
  const payments = data?.data ?? [];
  const meta = data?.meta;
  const monthTrend = s && s.last_month ? Math.round(((s.this_month - s.last_month) / s.last_month) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every payment marked as paid on a client system.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild><Link to="/app/admin/client-systems"><ServerCog /> Client Systems</Link></Button>
          <Button variant="outline" onClick={exportCsv}><Download /> Export CSV</Button>
        </div>
      </div>

      {isLoading && !s ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard index={0} icon={Wallet} label="This month" value={peso(s.this_month)} trend={monthTrend} sub={`Last month ${peso(s.last_month)}`} accent="#22C55E" />
            <StatCard index={1} icon={CalendarDays} label="This year" value={peso(s.this_year)} accent="#3B82F6" />
            <StatCard index={2} icon={TrendingUp} label="All time" value={peso(s.all_time)} accent="#8B5CF6" />
            <StatCard index={3} icon={Receipt} label="In selected range" value={peso(s.range_total)} sub={`${s.range_count} payment${s.range_count === 1 ? '' : 's'}${s.range_setup > 0 ? ` · ${peso(s.range_setup)} setup fees` : ''}${s.range_discounts > 0 ? ` · ${peso(s.range_discounts)} lock-in discounts` : ''}`} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2" title="Monthly sales" subtitle="Last 12 months">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.monthly} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d3060" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#8A96B8', fontSize: 11 }} tickFormatter={(m) => m.split(' ')[0]} minTickGap={12} />
                  <YAxis tick={{ fill: '#8A96B8', fontSize: 11 }} tickFormatter={pesoShort} width={64} />
                  <RTooltip contentStyle={TOOLTIP} formatter={(v) => [peso(v), 'Sales']} />
                  <Area type="monotone" dataKey="total" stroke="#22C55E" fill="url(#gSales)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card title="By system" subtitle="Selected range">
              {data.by_system.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.by_system} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1d3060" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#8A96B8', fontSize: 11 }} tickFormatter={pesoShort} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#8A96B8', fontSize: 11 }} width={100} />
                    <RTooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(233,30,79,0.08)' }} formatter={(v) => [peso(v), 'Sales']} />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                      {data.by_system.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">No sales in this range.</p>
              )}
            </Card>
          </div>
        </>
      ) : null}

      <Card title="Payments">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Select value={preset} onValueChange={pickPreset}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} max={to} onChange={setDate('from')} className="w-40" aria-label="From" />
          <Input type="date" value={to} min={from} onChange={setDate('to')} className="w-40" aria-label="To" />
          <Select value={systemType} onValueChange={(v) => { setSystemType(v); setPage(1); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All systems</SelectItem>
              {lookups?.system_types?.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {payments.length ? (
          <>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Paid on</th>
                    <th className="px-2 py-2 font-medium">Client</th>
                    <th className="px-2 py-2 font-medium">System</th>
                    <th className="px-2 py-2 font-medium">Method</th>
                    <th className="px-2 py-2 text-right font-medium">Amount</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const Icon = systemIcon(p.system_type?.icon);
                    return (
                      <tr key={p.id} className="border-t border-navy-600/50 hover:bg-navy-700/30">
                        <td className="whitespace-nowrap px-2 py-3 text-mist">
                          {fmtDate(p.paid_at)}
                          {p.kind === 'setup'
                            ? <div className="text-[11px] font-medium text-violet-400">One-time setup fee</div>
                            : <div className="text-[11px] text-muted-foreground">for due {fmtDate(p.covered_due_date)}</div>}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <UserAvatar user={p.client} className="h-6 w-6" />
                            <span className="truncate text-mist">{p.client?.store_name || p.client?.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2 text-mist">
                            <Icon className="h-4 w-4 shrink-0 text-crimson-soft" />
                            <span className="truncate">{p.system_name || p.system_type?.name}{p.label && <span className="text-muted-foreground"> · {p.label}</span>}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {METHOD_LABELS[p.method]}
                          {p.reference && <div className="text-[11px]">{p.reference}</div>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 text-right font-semibold text-emerald-400">
                          {peso(p.amount)}
                          {p.discount_amount > 0 && <div className="text-[11px] font-normal text-amber-400">−{peso(p.discount_amount)} lock-in</div>}
                        </td>
                        <td className="px-2 py-3"><IconButton label="Void payment" icon={Trash2} size="icon-sm" onClick={() => setVoiding(p)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {meta && meta.last_page > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Page {meta.current_page} of {meta.last_page} · {meta.total} payments</span>
                <div className="flex gap-1">
                  <IconButton label="Previous" icon={ChevronLeft} size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} />
                  <IconButton label="Next" icon={ChevronRight} size="icon-sm" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)} />
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={Receipt} title="No payments in this range"
            description="Use “Mark paid” on a client system and it will show up here as a sale." />
        )}
      </Card>

      {voiding && (
        <AlertDialog open onOpenChange={(v) => !v && setVoiding(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Void {peso(voiding.amount)} payment?</AlertDialogTitle>
              <AlertDialogDescription>
                {voiding.kind === 'setup'
                  ? 'It will be removed from Sales and that system’s setup fee will show as unpaid again.'
                  : `It will be removed from Sales. If it’s the latest payment for that system, its due date goes back to ${fmtDate(voiding.covered_due_date)}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { voidPay.mutate(voiding.id); setVoiding(null); }}>Void payment</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function Card({ title, subtitle, className, children }) {
  return (
    <div className={`rounded-2xl glass p-5 ${className ?? ''}`}>
      <div className="mb-4">
        <h3 className="font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
