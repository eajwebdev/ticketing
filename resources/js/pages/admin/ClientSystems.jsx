import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  KeyRound, Search, Plus, Pencil, Trash2, Eye, EyeOff, Copy, ExternalLink, History, BadgeCheck,
  AlertTriangle, CalendarClock, Wallet, Layers, ServerCog, Lock, Wrench, CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import { can, P } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { useLookups } from '@/hooks/queries';
import { systemIcon } from '@/lib/systemIcons';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/avatar';
import { IconButton, Skeleton, EmptyState, Spinner } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  peso, CYCLE_LABELS, CYCLE_SUFFIX, METHOD_LABELS, DUE_META, dueLabel, localDate, todayISO,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const fmtDate = (iso) => (iso ? format(localDate(iso), 'MMM d, yyyy') : '—');

export default function ClientSystems() {
  const { user } = useAuth();
  const isAdmin = can(user, P.BILLING); // money, edits and mark-paid
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [state, setState] = useState(params.get('state') || 'all');
  const [dialog, setDialog] = useState(null); // {type: 'edit'|'pay'|'setup'|'creds'|'history'|'delete', system}

  // ?client=12 — opened from a client's card: show only that client's systems.
  const clientFilter = Number(params.get('client')) || null;
  const query = {
    per_page: 200, ...(search && { search }), ...(state !== 'all' && { state }),
    ...(clientFilter && { client_id: clientFilter }),
  };
  const { data, isLoading } = useQuery({
    queryKey: ['client-systems', query],
    queryFn: async () => (await api.get('/admin/client-systems', { params: query })).data,
  });
  const systems = data?.data ?? [];

  const { data: overview } = useQuery({
    queryKey: ['billing-overview'],
    enabled: isAdmin,
    queryFn: async () => (await api.get('/admin/billing/overview')).data,
  });

  // Deep link from a notification: /app/admin/client-systems?focus=12
  const focusId = Number(params.get('focus'));
  useEffect(() => {
    if (!focusId || !systems.length) return;
    const el = document.getElementById(`cs-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => setParams((p) => { p.delete('focus'); return p; }, { replace: true }), 4000);
      return () => clearTimeout(t);
    }
  }, [focusId, systems.length, setParams]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['client-systems'] });
    queryClient.invalidateQueries({ queryKey: ['billing-overview'] });
    queryClient.invalidateQueries({ queryKey: ['sales'] });
  };

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/client-systems/${id}`),
    onSuccess: () => { refresh(); toast.success('System removed.'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not delete.'),
  });

  const open = (type, system = {}) => setDialog({ type, system });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Systems</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? 'Systems we manage for clients — due dates, payments and logins.' : 'Logins for the client systems you have access to.'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => open('edit', clientFilter ? { client: { id: clientFilter } } : {})}><Plus /> Add System</Button>
        )}
      </div>

      {clientFilter && (
        <div className="flex items-center gap-2 rounded-xl border border-crimson/30 bg-crimson/10 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Showing systems for</span>
          <span className="font-medium text-mist">{systems[0]?.client?.store_name || systems[0]?.client?.name || 'this client'}</span>
          <button type="button" className="ml-auto text-xs text-crimson-soft hover:underline"
            onClick={() => { params.delete('client'); setParams(params, { replace: true }); }}>
            Show all clients
          </button>
        </div>
      )}

      {isAdmin && overview && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} icon={AlertTriangle} label="Overdue" value={overview.overdue}
            sub={[
              overview.overdue ? `${peso(overview.overdue_amount)} unpaid` : 'All caught up',
              overview.setup_unpaid ? `+ ${peso(overview.setup_unpaid_amount)} setup` : null,
            ].filter(Boolean).join(' · ')} accent="#E91E4F" />
          <StatCard index={1} icon={CalendarClock} label="Due in 7 days" value={overview.due_soon}
            sub={overview.due_soon ? peso(overview.due_soon_amount) : undefined} accent="#F59E0B" />
          <StatCard index={2} icon={Wallet} label="Sales this month" value={peso(overview.sales_this_month)} accent="#22C55E" />
          <StatCard index={3} icon={Layers} label="Active systems" value={overview.active}
            sub={`≈ ${peso(overview.mrr)} / month recurring`} accent="#3B82F6" />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={state} onValueChange={setState}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue
              {overview?.overdue > 0 && <span className="ml-1.5 rounded-full bg-crimson/25 px-1.5 text-[10px] font-bold text-crimson-soft">{overview.overdue}</span>}
            </TabsTrigger>
            <TabsTrigger value="due_soon">Due soon</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Paused / Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search client or system…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : systems.length ? (
        <div className="space-y-3">
          {systems.map((s) => (
            <SystemRow key={s.id} s={s} isAdmin={isAdmin} canSeeCreds={can(user, P.CREDENTIALS)}
              focused={s.id === focusId} onAction={open} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ServerCog}
          title={state === 'overdue' ? 'Nothing overdue 🎉' : 'No client systems yet'}
          description={isAdmin && state === 'all' && !search ? 'Add the systems you manage for each client to track due dates and sales.' : undefined}
          action={isAdmin && state === 'all' && !search ? <Button onClick={() => open('edit')}><Plus /> Add System</Button> : undefined}
        />
      )}

      {dialog?.type === 'edit' && <SystemDialog system={dialog.system} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.type === 'pay' && <PayDialog system={dialog.system} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.type === 'setup' && <SetupPayDialog system={dialog.system} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.type === 'creds' && <CredentialsDialog system={dialog.system} onClose={() => setDialog(null)} />}
      {dialog?.type === 'history' && <HistoryDialog system={dialog.system} onClose={() => setDialog(null)} onChanged={refresh} />}
      {dialog?.type === 'delete' && (
        <AlertDialog open onOpenChange={(v) => !v && setDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {dialog.system.display_name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the system and its saved login. Systems with recorded sales can’t be deleted — set them to Cancelled instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate(dialog.system.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function SystemRow({ s, isAdmin, canSeeCreds, focused, onAction }) {
  const Icon = systemIcon(s.system_type?.icon);
  const meta = DUE_META[s.due_state] ?? DUE_META.upcoming;
  const active = s.status === 'active';

  return (
    <div id={`cs-${s.id}`}
      className={cn('flex flex-col gap-4 rounded-2xl glass p-4 transition-all lg:flex-row lg:items-center',
        s.due_state === 'overdue' && 'border-crimson/40',
        focused && 'ring-2 ring-crimson shadow-[0_0_24px_rgba(233,30,79,0.35)]')}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-700 text-crimson-soft"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-mist">{s.display_name}</div>
          {s.system_name && s.system_type?.name && (
            <div className="truncate text-[11px] text-muted-foreground/80">{s.system_type.name}</div>
          )}
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <UserAvatar user={s.client} className="h-4 w-4" />
            <span className="truncate">{s.client?.store_name || s.client?.name}</span>
            {s.started_on && <span className="shrink-0 text-muted-foreground/70">· since {format(localDate(s.started_on), 'MMM yyyy')}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm lg:flex-nowrap">
        {isAdmin && (
          <div className="min-w-28">
            <div className="font-semibold text-white">{peso(s.amount)}<span className="text-xs font-normal text-muted-foreground">{CYCLE_SUFFIX[s.billing_cycle]}</span></div>
            {s.discount_amount > 0 ? (
              <div className="text-[11px] text-amber-400" title={`Regular ${peso(s.regular_cycle_amount)} at ${peso(s.regular_monthly_rate)}/mo`}>
                {CYCLE_LABELS[s.billing_cycle]} lock-in · saves {peso(s.discount_amount)} ({s.discount_percent}%)
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">{CYCLE_LABELS[s.billing_cycle]}</div>
            )}
            {s.setup_state === 'unpaid' && (
              <button type="button" onClick={() => onAction('setup', s)}
                className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
                title="Record the one-time setup payment">
                <Wrench className="h-3 w-3" /> {peso(s.setup_fee)} setup unpaid
              </button>
            )}
            {s.setup_state === 'paid' && (
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-400" title={`Paid ${fmtDate(s.setup_paid_at)}`}>
                <CheckCircle2 className="h-3 w-3" /> {peso(s.setup_fee)} setup paid
              </div>
            )}
          </div>
        )}
        <div className="min-w-32">
          <div className="text-mist">{fmtDate(s.next_due_date)}</div>
          <div className="text-[11px]" style={{ color: active ? meta.color : undefined }}>
            {active ? dueLabel(s.days_until_due) : 'Not billing'}
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}33` }}>
          {meta.label}
        </span>
      </div>

      <div className="flex items-center gap-1 border-t border-navy-600/60 pt-3 lg:border-0 lg:pt-0">
        {isAdmin && active && (
          <Button size="sm" onClick={() => onAction('pay', s)} className="mr-1"><BadgeCheck /> Mark paid</Button>
        )}
        {canSeeCreds && (
          <IconButton label={s.has_credentials ? 'View login' : 'No login saved'} icon={KeyRound} size="icon-sm"
            disabled={!s.has_credentials && !s.login_url} onClick={() => onAction('creds', s)} />
        )}
        {isAdmin && (
          <>
            <IconButton label="Payment history" icon={History} size="icon-sm" onClick={() => onAction('history', s)} />
            <IconButton label="Edit" icon={Pencil} size="icon-sm" onClick={() => onAction('edit', s)} />
            <IconButton label="Delete" icon={Trash2} size="icon-sm" onClick={() => onAction('delete', s)} />
          </>
        )}
      </div>
    </div>
  );
}

function SystemDialog({ system, onClose, onSaved }) {
  const isEdit = !!system.id;
  const { data: lookups } = useLookups();
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-all'],
    queryFn: async () => (await api.get('/admin/clients', { params: { per_page: 200, status: 'approved' } })).data,
  });
  const clients = clientsData?.data ?? [];
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    client_id: system.client?.id ? String(system.client.id) : '',
    system_type_id: system.system_type?.id ? String(system.system_type.id) : '',
    system_name: system.system_name ?? '',
    label: system.label ?? '',
    amount: system.amount ?? '',
    setup_fee: system.setup_fee ?? '',
    setup_paid_at: system.setup_paid_at ?? '',
    regular_monthly_rate: system.regular_monthly_rate ?? '',
    billing_cycle: system.billing_cycle ?? 'monthly',
    next_due_date: system.next_due_date ?? '',
    started_on: system.started_on ?? '',
    status: system.status ?? 'active',
    login_url: system.login_url ?? '',
    username: '',
    password: '',
    notes: system.notes ?? '',
  });

  // Prefill the username when editing (password stays blank = unchanged).
  useEffect(() => {
    if (!isEdit || !system.has_credentials) return;
    api.get(`/admin/client-systems/${system.id}/credentials`)
      .then(({ data }) => setForm((f) => ({ ...f, username: data.username ?? '' })))
      .catch(() => {});
  }, [isEdit, system.id, system.has_credentials]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const err = (k) => errors[k]?.[0];

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `/admin/client-systems/${system.id}` : '/admin/client-systems';
      return (await api[isEdit ? 'patch' : 'post'](url, form)).data;
    },
    onSuccess: () => { onSaved(); toast.success(isEdit ? 'System updated.' : 'System added.'); onClose(); },
    onError: (e) => setErrors(e.response?.data?.errors || {}),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${system.display_name}` : 'Add a client system'}</DialogTitle>
          <DialogDescription>Billing details drive the due-date reminders. Logins are encrypted.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); mutation.mutate(); }} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Client" e={err('client_id')}>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder={clients.length ? 'Choose a client' : 'No approved clients yet'} /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.store_name || c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="System type" e={err('system_type_id')}>
              <Select value={form.system_type_id} onValueChange={(v) => setForm({ ...form, system_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose a system" /></SelectTrigger>
                <SelectContent>
                  {lookups?.system_types?.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="System name (optional)" e={err('system_name')} className="sm:col-span-2">
              <Input value={form.system_name} onChange={set('system_name')} maxLength={255}
                placeholder={`Exact name the client knows it by, e.g. "Juan's LaundryPro"`} />
              <p className="text-[11px] text-muted-foreground">
                Shown on tickets, billing and reminders. Leave blank to use the system type
                {lookups?.system_types?.find((t) => String(t.id) === form.system_type_id)?.name
                  ? ` (“${lookups.system_types.find((t) => String(t.id) === form.system_type_id).name}”)` : ''}.
              </p>
            </F>
            <F label="Label (optional)" e={err('label')}><Input value={form.label} onChange={set('label')} placeholder="e.g. Main branch" /></F>
            <F label="Status" e={err('status')}>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active — send reminders</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </F>
          </div>

          <Section title="Billing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Subscription price per cycle (₱)" e={err('amount')}>
                <Input type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required />
              </F>
              <F label="Billing cycle" e={err('billing_cycle')}>
                <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CYCLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label={isEdit ? 'Next due date' : 'First due date'} e={err('next_due_date')}>
                <Input type="date" value={form.next_due_date} onChange={set('next_due_date')} required />
              </F>
              <F label="Subscribed since (optional)" e={err('started_on')}>
                <Input type="date" value={form.started_on} onChange={set('started_on')} max={todayISO()} />
              </F>
            </div>
            {form.billing_cycle !== 'monthly' && (
              <LockInPanel form={form} setForm={setForm} err={err('regular_monthly_rate')} />
            )}
            <SetupFeeFields form={form} setForm={setForm} err={err} recorded={isEdit && system.setup_recorded} paidAt={system.setup_paid_at} />
            <p className="text-[11px] text-muted-foreground">
              Set the first due date — every “Mark paid” records a sale and moves it forward one {CYCLE_LABELS[form.billing_cycle].toLowerCase()} cycle.
            </p>
          </Section>

          <Section title="Our login for this system" icon={Lock}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Login URL" e={err('login_url')} className="sm:col-span-2">
                <Input value={form.login_url} onChange={set('login_url')} placeholder="https://…" />
              </F>
              <F label="Username" e={err('username')}><Input value={form.username} onChange={set('username')} autoComplete="off" /></F>
              <F label="Password" e={err('password')}>
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete="new-password"
                    placeholder={isEdit && system.has_credentials ? 'Leave blank to keep current' : ''} className="pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-mist">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </F>
            </div>
          </Section>

          <F label="Notes" e={err('notes')}><Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Plan, inclusions, contact for payment…" /></F>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : <><Plus /> Add system</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Optional one-time setup fee. For systems that were set up (and paid) before being
 * added here, tick "already paid" — that marks it paid without adding a sale.
 */
function SetupFeeFields({ form, setForm, err, recorded, paidAt }) {
  const hasFee = parseFloat(form.setup_fee) > 0;
  const paid = !!form.setup_paid_at;
  return (
    <div className="space-y-3 border-t border-navy-600/60 pt-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <F label="One-time setup fee (₱, optional)" e={err('setup_fee')}>
          <Input type="number" min="0" step="0.01" inputMode="decimal" value={form.setup_fee}
            onChange={(e) => setForm({ ...form, setup_fee: e.target.value, ...(parseFloat(e.target.value) > 0 ? {} : { setup_paid_at: '' }) })}
            placeholder="Leave blank if none" />
        </F>
        {hasFee && (recorded ? (
          <div className="flex items-end pb-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Paid {fmtDate(paidAt)} · recorded in Sales
            </span>
          </div>
        ) : (
          <F label="Setup payment" e={err('setup_paid_at')}>
            <div className="flex h-10 items-center gap-2">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-mist">
                <input type="checkbox" className="h-4 w-4 accent-[#E91E4F]" checked={paid}
                  onChange={(e) => setForm({ ...form, setup_paid_at: e.target.checked ? (paidAt || (form.started_on && form.started_on <= todayISO() ? form.started_on : todayISO())) : '' })} />
                Already paid
              </label>
              {paid && (
                <Input type="date" className="h-9 flex-1" max={todayISO()} value={form.setup_paid_at}
                  onChange={(e) => setForm({ ...form, setup_paid_at: e.target.value })} aria-label="Setup paid on" />
              )}
            </div>
          </F>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {!hasFee
          ? 'Only for systems with an installation / setup charge on top of the subscription.'
          : recorded
            ? 'To change it, void the setup payment in Payment history.'
            : paid
              ? 'Marked as paid before it was tracked here — no sale is added. To record it in Sales instead, untick and use “Setup unpaid” on the system.'
              : 'Not paid yet — use “Setup unpaid” on the system to record the payment in Sales.'}
      </p>
    </div>
  );
}

const CYCLE_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };
const CYCLE_UNIT = { monthly: 'month', quarterly: 'quarter', semiannual: 'half-year', yearly: 'year' };
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Lock-in plans (quarterly / 6 months / yearly): compare the price to the
 * client's regular month-to-month rate and show what they save.
 */
function LockInPanel({ form, setForm, err }) {
  const months = CYCLE_MONTHS[form.billing_cycle] ?? 1;
  const rate = parseFloat(form.regular_monthly_rate);
  const amount = parseFloat(form.amount);
  const hasRate = rate > 0;
  const regular = hasRate ? round2(rate * months) : 0;
  const saves = hasRate && amount >= 0 ? round2(regular - amount) : 0;
  const pct = regular ? Math.round((saves / regular) * 1000) / 10 : 0;
  const freeMonths = hasRate ? Math.round((saves / rate) * 10) / 10 : 0;
  const cycle = CYCLE_LABELS[form.billing_cycle].toLowerCase();

  const presets = [
    { label: '5% off', amount: () => regular * 0.95 },
    { label: '10% off', amount: () => regular * 0.9 },
    { label: '15% off', amount: () => regular * 0.85 },
    ...(months >= 6 ? [{ label: '1 month free', amount: () => rate * (months - 1) }] : []),
    ...(months >= 12 ? [{ label: '2 months free', amount: () => rate * (months - 2) }] : []),
  ];

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <F label="Regular monthly rate (₱)" e={err}>
          <Input type="number" min="0" step="0.01" inputMode="decimal" value={form.regular_monthly_rate}
            onChange={(e) => setForm({ ...form, regular_monthly_rate: e.target.value })}
            placeholder="What they'd pay month-to-month" />
        </F>
        <div className="space-y-2">
          <Label>Lock-in discount</Label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p.label} type="button" disabled={!hasRate}
                onClick={() => setForm({ ...form, amount: String(round2(p.amount())) })}
                className="rounded-lg border border-navy-600 bg-navy-800/60 px-2 py-1 text-xs text-mist hover:border-amber-500/60 disabled:cursor-not-allowed disabled:opacity-40">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {hasRate ? (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-navy-800/60 p-2">
            <div className="text-muted-foreground">Regular ({months} × {peso(rate)})</div>
            <div className="mt-0.5 font-semibold text-mist">{peso(regular)}</div>
          </div>
          <div className="rounded-lg bg-navy-800/60 p-2">
            <div className="text-muted-foreground">Lock-in price</div>
            <div className="mt-0.5 font-semibold text-mist">{amount >= 0 ? peso(amount) : '—'}</div>
          </div>
          <div className={cn('rounded-lg p-2', saves > 0 ? 'bg-emerald-500/10' : saves < 0 ? 'bg-crimson/10' : 'bg-navy-800/60')}>
            <div className="text-muted-foreground">{saves < 0 ? 'Costs more by' : 'Client saves'}</div>
            <div className={cn('mt-0.5 font-semibold', saves > 0 ? 'text-emerald-400' : saves < 0 ? 'text-crimson-soft' : 'text-mist')}>
              {peso(Math.abs(saves))}{saves > 0 && ` (${pct}%)`}
            </div>
          </div>
          {saves > 0 && freeMonths >= 0.5 && (
            <p className="col-span-3 text-[11px] text-muted-foreground">≈ {freeMonths} month{freeMonths === 1 ? '' : 's'} free every {cycle} cycle.</p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Enter their regular monthly rate to see how much this {cycle} lock-in saves them.</p>
      )}
    </div>
  );
}

/** Mirrors ClientSystem::dueDateAfterCycles — same anchor-day rule as the server. */
function dueAfterCycles(iso, cycle, anchorDay, cycles) {
  const d = localDate(iso);
  const months = (CYCLE_MONTHS[cycle] ?? 1) * cycles;
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(anchorDay || d.getDate(), daysInMonth));
  return target;
}

function PayDialog({ system, onClose, onSaved }) {
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ amount: system.amount, cycles: 1, paid_at: todayISO(), method: 'cash', reference: '', notes: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const err = (k) => errors[k]?.[0];
  const cycles = Math.max(1, Math.min(24, Number(form.cycles) || 1));
  const setCycles = (n) => setForm({ ...form, cycles: n, amount: round2(system.amount * n) });
  const months = (CYCLE_MONTHS[system.billing_cycle] ?? 1) * cycles;
  const nextDue = dueAfterCycles(system.next_due_date, system.billing_cycle, system.billing_anchor_day, cycles);

  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/admin/client-systems/${system.id}/pay`, form)).data,
    onSuccess: (data) => {
      onSaved();
      toast.success(`${peso(data.payment.amount)} recorded as a sale`, { description: `Next due ${fmtDate(data.system.next_due_date)}` });
      onClose();
    },
    onError: (e) => setErrors(e.response?.data?.errors || {}),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark as paid</DialogTitle>
          <DialogDescription>
            {system.client?.store_name || system.client?.name} · {system.display_name}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-navy-600 bg-navy-800/50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Settles due date</span><span className="text-mist">{fmtDate(system.next_due_date)}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Cycle</span><span className="text-mist">{CYCLE_LABELS[system.billing_cycle]}</span></div>
          {system.discount_amount > 0 && (
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Lock-in discount</span>
              <span className="text-amber-400">{peso(system.regular_cycle_amount)} − {peso(system.discount_amount)} ({system.discount_percent}%)</span>
            </div>
          )}
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Next due date after this</span>
            <span className="font-medium text-emerald-400">{format(nextDue, 'MMM d, yyyy')}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This payment is recorded in Sales and covers {months} month{months === 1 ? '' : 's'}.
          </p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); mutation.mutate(); }} className="space-y-4">
          <F label="Paying for" e={err('cycles')}>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 6, 12].map((n) => (
                <button key={n} type="button" onClick={() => setCycles(n)}
                  className={cn('rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    cycles === n ? 'border-crimson bg-crimson/15 text-white' : 'border-navy-600 bg-navy-800/60 text-mist hover:border-crimson/50')}>
                  {n === 1 ? `1 ${CYCLE_UNIT[system.billing_cycle]}` : `${n} ${CYCLE_UNIT[system.billing_cycle]}s`}
                </button>
              ))}
            </div>
            {cycles > 1 && <p className="text-[11px] text-muted-foreground">Advance payment — the due date jumps {cycles} cycles ahead.</p>}
          </F>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Amount received (₱)" e={err('amount')}>
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required />
            </F>
            <F label="Date paid" e={err('paid_at')}><Input type="date" max={todayISO()} value={form.paid_at} onChange={set('paid_at')} required /></F>
            <F label="Method" e={err('method')}>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Reference no. (optional)" e={err('reference')}><Input value={form.reference} onChange={set('reference')} placeholder="OR / GCash ref" /></F>
          </div>
          <F label="Notes (optional)" e={err('notes')}><Textarea rows={2} value={form.notes} onChange={set('notes')} /></F>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : <><BadgeCheck /> Record payment</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Record the one-time setup fee. Doesn't move the subscription due date. */
function SetupPayDialog({ system, onClose, onSaved }) {
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ amount: system.setup_fee, paid_at: todayISO(), method: 'cash', reference: '', notes: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const err = (k) => errors[k]?.[0];

  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/admin/client-systems/${system.id}/pay-setup`, form)).data,
    onSuccess: (data) => {
      onSaved();
      toast.success(`${peso(data.payment.amount)} setup fee recorded as a sale`);
      onClose();
    },
    onError: (e) => {
      setErrors(e.response?.data?.errors || {});
      if (!e.response?.data?.errors) toast.error(e.response?.data?.message || 'Could not record payment.');
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record setup payment</DialogTitle>
          <DialogDescription>{system.client?.store_name || system.client?.name} · {system.display_name}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-navy-600 bg-navy-800/50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">One-time setup fee</span><span className="font-semibold text-mist">{peso(system.setup_fee)}</span></div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Subscription</span>
            <span className="text-mist">{peso(system.amount)}{CYCLE_SUFFIX[system.billing_cycle]} · next due {fmtDate(system.next_due_date)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Recorded in Sales as a setup fee. The subscription due date doesn’t change.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); mutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Amount received (₱)" e={err('amount')}>
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required />
            </F>
            <F label="Date paid" e={err('paid_at')}><Input type="date" max={todayISO()} value={form.paid_at} onChange={set('paid_at')} required /></F>
            <F label="Method" e={err('method')}>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Reference no. (optional)" e={err('reference')}><Input value={form.reference} onChange={set('reference')} placeholder="OR / GCash ref" /></F>
          </div>
          <F label="Notes (optional)" e={err('notes')}><Textarea rows={2} value={form.notes} onChange={set('notes')} /></F>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : <><Wrench /> Record setup payment</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({ system, onClose }) {
  const [show, setShow] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['credentials', system.id],
    queryFn: async () => (await api.get(`/admin/client-systems/${system.id}/credentials`)).data,
    gcTime: 0,
    staleTime: 0,
  });

  const copy = (v, what) => { navigator.clipboard.writeText(v ?? ''); toast.success(`${what} copied`); };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-crimson-soft" /> Login details</DialogTitle>
          <DialogDescription>{system.client?.store_name || system.client?.name} · {system.display_name}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-crimson-soft">{error.response?.data?.message || 'Could not load credentials.'}</p>
        ) : (
          <div className="space-y-3">
            {data.login_url && (
              <CredRow label="Login URL" value={data.login_url}
                extra={<IconButton label="Open" icon={ExternalLink} size="icon-sm"
                  onClick={() => window.open(/^https?:\/\//i.test(data.login_url) ? data.login_url : `https://${data.login_url}`, '_blank', 'noopener')} />}
                onCopy={() => copy(data.login_url, 'URL')} />
            )}
            <CredRow label="Username" value={data.username || '—'} onCopy={data.username ? () => copy(data.username, 'Username') : null} />
            <CredRow label="Password" value={data.password ? (show ? data.password : '••••••••••') : '—'} mono
              extra={data.password && <IconButton label={show ? 'Hide' : 'Reveal'} icon={show ? EyeOff : Eye} size="icon-sm" onClick={() => setShow(!show)} />}
              onCopy={data.password ? () => copy(data.password, 'Password') : null} />
            <p className="pt-1 text-[11px] text-muted-foreground">Access to these details is logged.</p>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredRow({ label, value, mono, extra, onCopy }) {
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-800/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1">
        <div className={cn('min-w-0 flex-1 truncate text-sm text-mist', mono && 'font-mono')}>{value}</div>
        {extra}
        {onCopy && <IconButton label="Copy" icon={Copy} size="icon-sm" onClick={onCopy} />}
      </div>
    </div>
  );
}

function HistoryDialog({ system, onClose, onChanged }) {
  const queryClient = useQueryClient();
  const [voiding, setVoiding] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['system-payments', system.id],
    queryFn: async () => (await api.get(`/admin/client-systems/${system.id}/payments`)).data.data,
  });
  const voidPay = useMutation({
    mutationFn: (id) => api.delete(`/admin/sales/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-payments', system.id] });
      onChanged();
      toast.success('Payment voided.');
    },
    onError: () => toast.error('Could not void payment.'),
  });
  const total = (data ?? []).reduce((a, p) => a + p.amount, 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment history</DialogTitle>
          <DialogDescription>{system.client?.store_name || system.client?.name} · {system.display_name}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
        ) : data?.length ? (
          <>
            <div className="text-sm text-muted-foreground">{data.length} payment{data.length > 1 ? 's' : ''} · <span className="font-semibold text-emerald-400">{peso(total)}</span> total</div>
            <div className="space-y-2">
              {data.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-navy-600 bg-navy-800/50 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white">
                      {peso(p.amount)} <span className="text-xs font-normal text-muted-foreground">· {METHOD_LABELS[p.method]}{p.reference && ` · ${p.reference}`}</span>
                      {p.kind === 'setup' && <span className="ml-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">Setup fee</span>}
                      {p.cycles > 1 && <span className="ml-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">{p.cycles} cycles in advance</span>}
                      {p.discount_amount > 0 && <span className="ml-1 text-xs font-normal text-amber-400">· {peso(p.discount_amount)} lock-in discount</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Paid {fmtDate(p.paid_at)}{p.kind === 'setup' ? ' · one-time setup' : ` · settled due ${fmtDate(p.covered_due_date)}`}{p.recorded_by && ` · by ${p.recorded_by.name}`}
                    </div>
                  </div>
                  <IconButton label="Void payment" icon={Trash2} size="icon-sm" onClick={() => setVoiding(p)} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
      {voiding && (
        <AlertDialog open onOpenChange={(v) => !v && setVoiding(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Void {peso(voiding.amount)} payment?</AlertDialogTitle>
              <AlertDialogDescription>
                {voiding.kind === 'setup'
                  ? 'It will be removed from Sales and the setup fee will show as unpaid again.'
                  : `It will be removed from Sales. If it’s the latest payment, the due date goes back to ${fmtDate(voiding.covered_due_date)}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { voidPay.mutate(voiding.id); setVoiding(null); }}>Void payment</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="space-y-3 rounded-xl border border-navy-600/70 p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}{title}
      </div>
      {children}
    </div>
  );
}

function F({ label, e, children, className }) {
  return <div className={cn('space-y-2', className)}><Label>{label}</Label>{children}{e && <p className="text-xs text-crimson-soft">{e}</p>}</div>;
}
