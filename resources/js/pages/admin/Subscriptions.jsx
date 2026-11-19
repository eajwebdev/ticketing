import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Globe, Server, HardDrive, ShieldCheck, Mail, AppWindow, Package, Plus, Search, Pencil, Trash2, RefreshCw,
  AlertTriangle, CalendarClock, Layers, Wallet, ExternalLink, BellRing, Sparkles, Repeat,
} from 'lucide-react';
import api from '@/lib/api';
import { peso, METHOD_LABELS, localDate, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IconButton, Skeleton, EmptyState, Spinner } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const ALL = 'all';
const NONE = 'none';

const TYPE_ICONS = { domain: Globe, hosting: Server, vps: HardDrive, ssl: ShieldCheck, email: Mail, software: AppWindow, other: Package };

const CYCLE_LABELS = {
  monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Every 6 months',
  yearly: 'Yearly', biennial: 'Every 2 years', triennial: 'Every 3 years',
};
const CYCLE_SUFFIX = { monthly: '/mo', quarterly: '/qtr', semiannual: '/6 mo', yearly: '/yr', biennial: '/2 yrs', triennial: '/3 yrs' };
const CYCLE_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12, biennial: 24, triennial: 36 };

const STATE_META = {
  expired: { label: 'Expired', color: '#E91E4F', bg: 'rgba(233,30,79,0.15)' },
  expires_today: { label: 'Expires today', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  expiring_soon: { label: 'Expiring soon', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  active: { label: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  cancelled: { label: 'Cancelled', color: '#64748B', bg: 'rgba(100,116,139,0.15)' },
};

const fmtDate = (iso) => (iso ? format(localDate(iso), 'MMM d, yyyy') : '—');

function expiryLabel(days) {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
}

function addMonthsISO(iso, months) {
  const d = localDate(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + months, 1);
  t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Domains, hosting, VPS… that the company pays for, with expiry alerts to Owner/Admin users. */
export default function Subscriptions() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState(params.get('state') || ALL);
  const [type, setType] = useState(ALL);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null); // {kind: 'edit'|'renew'|'delete', sub}

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => (await api.get('/admin/subscriptions')).data,
  });
  const all = data?.data ?? [];
  const summary = data?.summary;
  const types = data?.types ?? {};

  // Filter on the client — the whole list is already here, so it feels instant.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((s) => {
      if (type !== ALL && s.type !== type) return false;
      if (state === 'expired' && s.state !== 'expired') return false;
      if (state === 'expiring' && !['expires_today', 'expiring_soon'].includes(s.state)) return false;
      if (state === 'active' && s.status !== 'active') return false;
      if (state === 'cancelled' && s.status !== 'cancelled') return false;
      return !q || [s.name, s.provider, s.account, s.client?.name, s.client?.store_name, s.client_system?.display_name]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [all, state, type, search]);

  // Deep link from an alert: /app/admin/subscriptions?focus=12
  const focusId = Number(params.get('focus'));
  useEffect(() => {
    if (!focusId || !all.length) return;
    const el = document.getElementById(`sub-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => setParams((p) => { p.delete('focus'); return p; }, { replace: true }), 4000);
      return () => clearTimeout(t);
    }
  }, [focusId, all.length, setParams]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/subscriptions/${id}`),
    onSuccess: () => { refresh(); setDialog(null); toast.success('Removed.'); },
    onError: () => toast.error('Could not delete — please try again.'),
  });

  const open = (kind, sub = {}) => setDialog({ kind, sub });
  const recipients = data?.alert_recipients ?? [];
  const suggestions = data?.suggestions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Domains, hosting and servers we pay for — and when each one expires.</p>
        </div>
        <Button onClick={() => open('edit')}><Plus /> Add subscription</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} icon={AlertTriangle} label="Expired" value={summary.expired}
            sub={summary.expired ? 'Renew these now' : 'Nothing has lapsed'} accent="#E91E4F" />
          <StatCard index={1} icon={CalendarClock} label={`Expiring in ${summary.soon_days} days`} value={summary.expiring} accent="#F59E0B" />
          <StatCard index={2} icon={Layers} label="Active" value={summary.active} accent="#3B82F6" />
          <StatCard index={3} icon={Wallet} label="Yearly cost" value={peso(summary.yearly_cost)}
            sub="Paid by us, normalised to a year" accent="#22C55E" />
        </div>
      )}

      {data && (
        <div className="flex items-start gap-3 rounded-xl border border-navy-600/60 bg-navy-800/50 px-4 py-3 text-sm">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-crimson-soft" />
          <div className="min-w-0 text-muted-foreground">
            Email alerts go out <span className="text-mist">{(data.alert_days ?? []).join(', ')} day(s) before expiry</span>, on the day,
            and daily once expired, to{' '}
            {recipients.length ? (
              recipients.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && (i === recipients.length - 1 ? ' and ' : ', ')}
                  <span className="text-mist" title={r.email}>{r.name}</span> <span className="text-xs">({r.role})</span>
                </span>
              ))
            ) : (
              <span className="text-amber-400">no one yet — give someone the Owner / Admin role in Users &amp; Roles</span>
            )}
            .
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-2xl glass p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist">
            <Sparkles className="h-4 w-4 text-crimson-soft" /> Domains found in Client Systems
            <span className="font-normal text-muted-foreground">— not tracked yet</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.domain} type="button"
                onClick={() => open('edit', { type: 'domain', name: s.domain, client_system: { id: s.client_system_id }, paid_by: 'company' })}
                className="group flex items-center gap-2 rounded-xl border border-dashed border-navy-600 px-3 py-2 text-left transition-colors hover:border-crimson/50">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-crimson-soft" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-mist">{s.domain}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{s.client_name} · {s.system_name}</span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-crimson-soft" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={state} onValueChange={setState}>
          <TabsList>
            <TabsTrigger value={ALL}>All</TabsTrigger>
            <TabsTrigger value="expired">
              Expired
              {summary?.expired > 0 && <span className="ml-1.5 rounded-full bg-crimson/25 px-1.5 text-[10px] font-bold text-crimson-soft">{summary.expired}</span>}
            </TabsTrigger>
            <TabsTrigger value="expiring">Expiring soon</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {Object.entries(types).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search domain, provider, client…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search subscriptions" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : rows.length ? (
        <div className="space-y-3">
          {rows.map((s) => <SubscriptionRow key={s.id} s={s} focused={s.id === focusId} onAction={open} />)}
        </div>
      ) : (
        <EmptyState icon={Globe}
          title={all.length ? 'No matches' : 'No subscriptions yet'}
          description={all.length ? 'Try another filter or search.' : 'Add your domains, hosting and VPS so nobody forgets a renewal.'}
          action={!all.length && <Button onClick={() => open('edit')}><Plus /> Add subscription</Button>} />
      )}

      {dialog?.kind === 'edit' && (
        <SubscriptionDialog sub={dialog.sub} meta={data} onClose={() => setDialog(null)} onSaved={refresh} />
      )}
      {dialog?.kind === 'renew' && <RenewDialog sub={dialog.sub} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.kind === 'delete' && (
        <AlertDialog open onOpenChange={(v) => !v && setDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {dialog.sub.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Its expiry alerts stop. If you just stopped paying for it, set it to Cancelled instead to keep the record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-crimson" disabled={del.isPending}
                onClick={(ev) => { ev.preventDefault(); del.mutate(dialog.sub.id); }}>
                {del.isPending ? <Spinner className="h-4 w-4" /> : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function SubscriptionRow({ s, focused, onAction }) {
  const Icon = TYPE_ICONS[s.type] ?? Package;
  const meta = STATE_META[s.state] ?? STATE_META.active;
  const active = s.status === 'active';

  return (
    <div id={`sub-${s.id}`}
      className={cn('flex flex-col gap-4 rounded-2xl glass p-4 transition-all lg:flex-row lg:items-center',
        s.state === 'expired' && 'border-crimson/40',
        focused && 'ring-2 ring-crimson shadow-[0_0_24px_rgba(233,30,79,0.35)]')}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-700 text-crimson-soft"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-mist">{s.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>{s.type_label}</span>
            {s.provider && <span>· {s.provider}</span>}
            {s.account && <span className="truncate">· {s.account}</span>}
          </div>
          {(s.client || s.client_system) && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
              For {s.client?.store_name || s.client?.name}{s.client_system && ` — ${s.client_system.display_name}`}
              {s.paid_by === 'client' && <span className="ml-1 text-amber-400/90">(client pays)</span>}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm lg:flex-nowrap">
        <div className="min-w-28">
          {s.cost != null ? (
            <div className="font-semibold text-white">{peso(s.cost)}<span className="text-xs font-normal text-muted-foreground">{CYCLE_SUFFIX[s.billing_cycle]}</span></div>
          ) : (
            <div className="text-muted-foreground">—</div>
          )}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {s.auto_renew && <Repeat className="h-3 w-3 text-emerald-400" />}
            {s.auto_renew ? 'Auto-renews' : CYCLE_LABELS[s.billing_cycle]}
          </div>
        </div>
        <div className="min-w-32">
          <div className="text-mist">{fmtDate(s.expires_on)}</div>
          <div className="text-[11px]" style={{ color: active ? meta.color : undefined }}>
            {active ? expiryLabel(s.days_left) : 'Not renewing'}
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}33` }}>
          {meta.label}
        </span>
      </div>

      <div className="flex items-center gap-1 border-t border-navy-600/60 pt-3 lg:border-0 lg:pt-0">
        {active && <Button size="sm" onClick={() => onAction('renew', s)} className="mr-1"><RefreshCw /> Renew</Button>}
        {s.login_url && (
          <IconButton label="Open provider" icon={ExternalLink} size="icon-sm"
            onClick={() => window.open(s.login_url, '_blank', 'noopener,noreferrer')} />
        )}
        <IconButton label="Edit" icon={Pencil} size="icon-sm" onClick={() => onAction('edit', s)} />
        <IconButton label="Delete" icon={Trash2} size="icon-sm" onClick={() => onAction('delete', s)} />
      </div>
    </div>
  );
}

function SubscriptionDialog({ sub, meta, onClose, onSaved }) {
  const isEdit = !!sub.id;
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    type: sub.type ?? 'domain',
    name: sub.name ?? '',
    provider: sub.provider ?? '',
    client_system_id: sub.client_system?.id ? String(sub.client_system.id) : NONE,
    client_id: !sub.client_system && sub.client?.id ? String(sub.client.id) : NONE,
    paid_by: sub.paid_by ?? 'company',
    cost: sub.cost ?? '',
    billing_cycle: sub.billing_cycle ?? 'yearly',
    expires_on: sub.expires_on ?? '',
    auto_renew: sub.auto_renew ?? false,
    status: sub.status ?? 'active',
    login_url: sub.login_url ?? '',
    account: sub.account ?? '',
    notes: sub.notes ?? '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => errors[k]?.[0];
  const systems = meta?.client_systems ?? [];

  // Picking a client system pre-fills the domain from its login URL.
  const pickSystem = (v) => setForm((f) => {
    const cs = systems.find((o) => String(o.id) === v);
    return { ...f, client_system_id: v, client_id: NONE, name: !f.name && f.type === 'domain' && cs?.domain ? cs.domain : f.name };
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        client_system_id: form.client_system_id === NONE ? null : Number(form.client_system_id),
        client_id: form.client_system_id !== NONE || form.client_id === NONE ? null : Number(form.client_id),
        cost: form.cost === '' ? null : form.cost,
      };
      const res = isEdit ? await api.patch(`/admin/subscriptions/${sub.id}`, payload) : await api.post('/admin/subscriptions', payload);
      return res.data.data;
    },
    onSuccess: () => { toast.success(isEdit ? 'Saved.' : 'Subscription added.'); onSaved(); onClose(); },
    onError: (e) => {
      setErrors(e.response?.data?.errors || {});
      if (!e.response?.data?.errors) toast.error('Could not save — please try again.');
    },
  });

  const namePlaceholder = { domain: 'e.g. juanlaundry.com', hosting: 'e.g. Hostinger Business plan', vps: 'e.g. DigitalOcean 2GB – prod' }[form.type] ?? 'Name';

  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${sub.name}` : 'Add a subscription'}</DialogTitle>
          <DialogDescription>Owner/Admin users are emailed before it expires.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type" e={err('type')}>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(meta?.types ?? {}).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={form.type === 'domain' ? 'Domain' : 'Name'} e={err('name')}>
              <Input value={form.name} onChange={set('name')} required maxLength={255} autoFocus placeholder={namePlaceholder} />
            </Field>

            <Field label="Client system (optional)" e={err('client_system_id')} className="sm:col-span-2">
              <Select value={form.client_system_id} onValueChange={pickSystem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not linked — our own / general</SelectItem>
                  {systems.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.client_name ? `${o.client_name} — ` : ''}{o.display_name}{o.domain ? ` (${o.domain})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {form.client_system_id === NONE && (
              <Field label="Client (optional)" e={err('client_id')}>
                <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None — company's own</SelectItem>
                    {(meta?.clients ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Who pays?" e={err('paid_by')}>
              <Select value={form.paid_by} onValueChange={(v) => setForm((f) => ({ ...f, paid_by: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">We pay (company)</SelectItem>
                  <SelectItem value="client">Client pays — we just track it</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Provider (optional)" e={err('provider')}>
              <Input value={form.provider} onChange={set('provider')} maxLength={255} placeholder="Namecheap, Hostinger, DigitalOcean…" />
            </Field>
            <Field label="Account / login email (optional)" e={err('account')}>
              <Input value={form.account} onChange={set('account')} maxLength={255} placeholder="Which account it's under" />
            </Field>

            <Field label="Expiry date" e={err('expires_on')}>
              <Input type="date" value={form.expires_on} onChange={set('expires_on')} required />
            </Field>
            <Field label="Renews" e={err('billing_cycle')}>
              <Select value={form.billing_cycle} onValueChange={(v) => setForm((f) => ({ ...f, billing_cycle: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(meta?.cycles ?? Object.keys(CYCLE_LABELS)).map((c) => <SelectItem key={c} value={c}>{CYCLE_LABELS[c] ?? c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cost per renewal (₱, optional)" e={err('cost')}>
              <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.cost} onChange={set('cost')} placeholder="0.00" />
            </Field>
            <Field label="Provider login URL (optional)" e={err('login_url')}>
              <Input type="url" value={form.login_url} onChange={set('login_url')} maxLength={255} placeholder="https://…" />
            </Field>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-mist">
              <input type="checkbox" className="h-4 w-4 accent-[#E91E4F]" checked={form.auto_renew}
                onChange={(e) => setForm((f) => ({ ...f, auto_renew: e.target.checked }))} />
              Auto-renew is on at the provider
            </label>
            {isEdit && (
              <Field label="Status" e={err('status')}>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active — alert me</SelectItem>
                    <SelectItem value="cancelled">Cancelled — let it lapse, no alerts</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field label="Notes (optional)" e={err('notes')}>
            <Textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={2000} placeholder="Nameservers, plan details, who to call…" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : <><Plus /> Add subscription</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenewDialog({ sub, onClose, onSaved }) {
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    expires_on: addMonthsISO(sub.expires_on, CYCLE_MONTHS[sub.billing_cycle] ?? 12),
    amount: sub.cost ?? '',
    record_expense: sub.paid_by === 'company' && sub.cost != null,
    paid_on: todayISO(),
    method: NONE,
    reference: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => errors[k]?.[0];

  const save = useMutation({
    mutationFn: () => api.post(`/admin/subscriptions/${sub.id}/renew`, {
      ...form,
      amount: form.amount === '' ? null : form.amount,
      method: form.method === NONE ? null : form.method,
    }),
    onSuccess: () => {
      toast.success(`Renewed until ${fmtDate(form.expires_on)}${form.record_expense ? ' · added to expenses' : ''}.`);
      onSaved(); onClose();
    },
    onError: (e) => {
      setErrors(e.response?.data?.errors || {});
      if (!e.response?.data?.errors) toast.error('Could not renew — please try again.');
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Renew {sub.name}</DialogTitle>
          <DialogDescription>Currently expires {fmtDate(sub.expires_on)}. Alerts start over for the new date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="New expiry date" e={err('expires_on')}>
              <Input type="date" value={form.expires_on} min={sub.expires_on} onChange={set('expires_on')} required />
            </Field>
            <Field label="Amount paid (₱)" e={err('amount')}>
              <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-mist">
            <input type="checkbox" className="h-4 w-4 accent-[#E91E4F]" checked={form.record_expense}
              onChange={(e) => setForm((f) => ({ ...f, record_expense: e.target.checked }))} />
            Record it as an expense (Hosting &amp; Domains)
          </label>
          {form.record_expense && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Paid on" e={err('paid_on')}>
                <Input type="date" value={form.paid_on} onChange={set('paid_on')} />
              </Field>
              <Field label="Paid with" e={err('method')}>
                <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference" e={err('reference')}>
                <Input value={form.reference} onChange={set('reference')} maxLength={100} placeholder="Order / ref no." />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || (form.record_expense && !form.amount)}>
              {save.isPending ? <Spinner className="h-4 w-4" /> : <><RefreshCw /> Mark renewed</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, e, children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
      {e && <p className="text-xs text-crimson-soft">{e}</p>}
    </div>
  );
}
