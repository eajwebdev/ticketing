import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  HandCoins, Plus, Pencil, Trash2, History, BadgeCheck, Users, Handshake, PiggyBank, CalendarClock, Wallet,
  PieChart, Undo2, Link2, Receipt, CheckCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { peso, METHOD_LABELS, DUE_META, dueLabel, localDate, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/ui/avatar';
import { IconButton, Skeleton, Spinner, EmptyState } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Kpi, KpiGrid, Panel, BarList, PALETTE, LIVE_INTERVAL } from './widgets';

const NONE = 'none';

export const PAYOUT_CYCLES = {
  once: 'One-time', monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Every 6 months', yearly: 'Yearly',
};
const SUFFIX = { once: ' once', monthly: '/mo', quarterly: '/qtr', semiannual: '/6 mo', yearly: '/yr' };
const UNIT = { monthly: 'month', quarterly: 'quarter', semiannual: 'half-year', yearly: 'year' };
const STATUS_META = {
  ...DUE_META,
  completed: { label: 'Paid (one-time)', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
};
const fmtDate = (iso) => (iso ? format(localDate(iso), 'MMM d, yyyy') : '—');
const PAYEE_KINDS = {
  team: { icon: Users, label: 'Team member' },
  external: { icon: Handshake, label: 'Outside person / agent', tag: 'External', tagClass: 'bg-sky-500/15 text-sky-400' },
  bill: { icon: Receipt, label: 'Company bill', tag: 'Bill', tagClass: 'bg-amber-500/15 text-amber-400' },
};
const endOfMonthISO = () => {
  const d = new Date();
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
};

/** Does the linked client owe us right now? Shown so you know if the money is in before paying a commission. */
export function clientStatus(cs) {
  if (!cs) return null;
  if (cs.due_state === 'overdue') return { text: `Client overdue ${Math.abs(cs.days_until_due)}d — not collected`, color: '#E91E4F' };
  if (cs.due_state === 'due_today') return { text: 'Client pays today', color: '#F97316' };
  if (cs.due_state === 'due_soon') return { text: `Client due ${fmtDate(cs.next_due_date)}`, color: '#F59E0B' };
  if (cs.due_state === 'upcoming') return { text: 'Client paid up', color: '#22C55E' };
  return { text: `Client system ${cs.due_state}`, color: '#8A96B8' };
}

export function useRefreshMoney() {
  const queryClient = useQueryClient();
  return () => ['payouts', 'dashboard', 'expenses', 'client-systems', 'billing-overview', 'sales']
    .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
}

/** Everyone we pay on a schedule — developer, marketing, outside agents — with one-click "Mark paid". */
export default function PayoutsTab() {
  const refresh = useRefreshMoney();
  const [dialog, setDialog] = useState(null); // {kind: 'edit'|'pay'|'history'|'delete', payout}

  const { data, isLoading } = useQuery({
    queryKey: ['payouts'],
    queryFn: async () => (await api.get('/admin/payouts')).data,
    refetchInterval: LIVE_INTERVAL,
  });
  const s = data?.summary;
  const rows = data?.data ?? [];
  const active = rows.filter((p) => p.status !== 'completed');
  const done = rows.filter((p) => p.status === 'completed');

  const del = useMutation({
    mutationFn: (p) => api.delete(`/admin/payouts/${p.id}`),
    onSuccess: () => { toast.success('Payout removed. Past payments stay in Expenses.'); setDialog(null); refresh(); },
    onError: () => toast.error('Could not delete — please try again.'),
  });

  const open = (kind, payout = {}) => setDialog({ kind, payout });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Every regular cost — salaries, maintenance, marketing, commissions, rent, bills. Each payment is saved as an expense.
        </p>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {s?.due_this_month_count > 0 && (
            <Button variant="outline" onClick={() => open('payAll')}>
              <CheckCheck /> Pay all due ({s.due_this_month_count}) · {peso(s.due_this_month_amount)}
            </Button>
          )}
          <Button onClick={() => open('edit')}><Plus /> Add payout</Button>
        </div>
      </div>

      {isLoading && !data ? (
        <KpiGrid>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</KpiGrid>
      ) : s && (
        <KpiGrid>
          <Kpi index={0} icon={HandCoins} label="Monthly payouts" value={peso(s.monthly_total)} accent="#8B5CF6"
            sub={`${s.active_count} active · ${s.by_category.map((c) => c.category).join(', ') || 'none yet'}`} />
          <Kpi index={1} icon={PiggyBank} label="We keep each month" value={peso(s.net_mrr)}
            accent={s.net_mrr >= 0 ? '#22C55E' : '#E91E4F'} tone={s.net_mrr < 0 ? 'danger' : 'default'}
            sub={`${peso(s.mrr)} recurring − ${peso(s.monthly_total)} payouts`} />
          <Kpi index={2} icon={CalendarClock} label="To pay (next 7 days)" value={peso(s.due_soon_amount)}
            accent="#F59E0B" tone={s.overdue_count ? 'danger' : 'default'}
            sub={s.overdue_count ? `${s.overdue_count} overdue · ${peso(s.overdue_amount)}` : `${s.due_soon_count} payout${s.due_soon_count === 1 ? '' : 's'}`} />
          <Kpi index={3} icon={Wallet} label="Paid out this month" value={peso(s.paid_this_month)} accent="#3B82F6"
            sub="Included in Expenses" />
        </KpiGrid>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Payouts" icon={HandCoins} subtitle="Soonest due first.">
          {isLoading && !data ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : active.length ? (
            <ul className="space-y-2">
              {active.map((p) => <PayoutRow key={p.id} p={p} onAction={open} />)}
            </ul>
          ) : (
            <EmptyState icon={HandCoins} title="No payouts yet"
              description="Add salaries, your developer's maintenance fee, marketing, an agent's commission, rent or other monthly bills."
              action={<Button onClick={() => open('edit')}><Plus /> Add payout</Button>} />
          )}
          {done.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-mist">
                {done.length} completed one-time payout{done.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 space-y-2">{done.map((p) => <PayoutRow key={p.id} p={p} onAction={open} />)}</ul>
            </details>
          )}
        </Panel>

        <Panel title="Monthly by category" icon={PieChart} subtitle="Recurring payouts, normalised to a month.">
          <BarList format={peso} empty="No recurring payouts."
            rows={(s?.by_category ?? []).map((c, i) => ({ label: `${c.category} · ${c.count}`, value: c.monthly, color: PALETTE[(i + 4) % PALETTE.length] }))} />
        </Panel>
      </div>

      {dialog?.kind === 'edit' && <PayoutDialog payout={dialog.payout} meta={data} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.kind === 'pay' && <PayoutPayDialog payout={dialog.payout} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'payAll' && <PayAllDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'history' && <PayoutHistoryDialog payout={dialog.payout} onClose={() => setDialog(null)} />}
      <AlertDialog open={dialog?.kind === 'delete'} onOpenChange={(v) => !v && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this payout?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.payout?.payee_name} · {dialog?.payout?.category}. Payments already made stay in Expenses.
              To stop it for a while, edit it and set it to Paused instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-crimson" disabled={del.isPending}
              onClick={(ev) => { ev.preventDefault(); del.mutate(dialog.payout); }}>
              {del.isPending ? <Spinner className="h-4 w-4" /> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** One payout line. Also used on the Finance tab (compact). */
export function PayoutRow({ p, onAction, compact = false }) {
  const meta = STATUS_META[p.due_state] ?? DUE_META.upcoming;
  const cs = p.client_system;
  const client = clientStatus(cs);
  const kind = PAYEE_KINDS[p.payee_kind] ?? PAYEE_KINDS.team;
  const PayeeIcon = kind.icon;

  return (
    <li className="group flex flex-col gap-2 rounded-xl bg-navy-800/50 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {p.payee_user ? <UserAvatar user={p.payee_user} className="h-8 w-8 shrink-0" />
          : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-700 text-muted-foreground"><PayeeIcon className="h-4 w-4" /></span>}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate text-sm font-medium text-mist">
            {p.payee_name}
            {kind.tag && <span className={cn('rounded px-1 text-[10px] font-normal', kind.tagClass)}>{kind.tag}</span>}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {p.category}{p.description ? ` · ${p.description}` : ''}
          </div>
          {cs && !compact && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
              <Link2 className="h-3 w-3" />
              <span className="truncate">{cs.client_name} — {cs.display_name}</span>
              {cs.share_percent != null && <span>· {cs.share_percent}% of {peso(cs.monthly_value)}/mo</span>}
              {client && p.status === 'active' && <span style={{ color: client.color }}>· {client.text}</span>}
            </div>
          )}
          {cs && compact && client && p.status === 'active' && (
            <div className="truncate text-[11px]" style={{ color: client.color }}>{cs.client_name}: {client.text}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        <div className="min-w-24 text-right">
          <div className="text-sm font-semibold tabular-nums text-white">
            {peso(p.amount)}<span className="text-[11px] font-normal text-muted-foreground">{SUFFIX[p.cycle]}</span>
          </div>
          <div className="text-[11px]" style={{ color: meta.color }}>
            {p.status === 'active' ? dueLabel(p.days_until_due) : meta.label}
          </div>
        </div>
        {p.status === 'active' && (
          <Button size="sm" onClick={() => onAction('pay', p)}><BadgeCheck /> Pay</Button>
        )}
        {!compact && (
          <div className="flex items-center">
            <IconButton label="Payment history" icon={History} size="icon-sm" onClick={() => onAction('history', p)} />
            <IconButton label="Edit" icon={Pencil} size="icon-sm" onClick={() => onAction('edit', p)} />
            <IconButton label="Remove" icon={Trash2} size="icon-sm" onClick={() => onAction('delete', p)} />
          </div>
        )}
      </div>
    </li>
  );
}

function PayoutDialog({ payout, meta, onClose, onSaved }) {
  const isEdit = !!payout.id;
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    payee_kind: payout.payee_kind ?? 'team',
    payee_user_id: payout.payee_user?.id ? String(payout.payee_user.id) : NONE,
    payee_name: payout.payee_kind && payout.payee_kind !== 'team' ? payout.payee_name : '',
    category: payout.category ?? '',
    description: payout.description ?? '',
    amount: payout.amount ?? '',
    cycle: payout.cycle ?? 'monthly',
    next_due_date: payout.next_due_date ?? todayISO(),
    client_system_id: payout.client_system?.id ? String(payout.client_system.id) : NONE,
    status: payout.status ?? 'active',
    payout_method: payout.payout_method ?? NONE,
    payout_account: payout.payout_account ?? '',
    notes: payout.notes ?? '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pick = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const err = (k) => errors[k]?.[0];
  const systems = meta?.client_systems ?? [];
  const linked = systems.find((o) => String(o.id) === form.client_system_id);
  const isExternal = form.payee_kind !== 'team'; // a typed name (outside person or company bill)
  const isBill = form.payee_kind === 'bill';

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        payee_user_id: isExternal || form.payee_user_id === NONE ? null : Number(form.payee_user_id),
        payee_name: isExternal ? form.payee_name : null,
        client_system_id: form.client_system_id === NONE ? null : Number(form.client_system_id),
        payout_method: form.payout_method === NONE ? null : form.payout_method,
      };
      return isEdit ? api.patch(`/admin/payouts/${payout.id}`, payload) : api.post('/admin/payouts', payload);
    },
    onSuccess: () => { toast.success(isEdit ? 'Payout saved.' : 'Payout added.'); onSaved(); onClose(); },
    onError: (e) => {
      setErrors(e.response?.data?.errors || {});
      if (!e.response?.data?.errors) toast.error('Could not save — please try again.');
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit payout' : 'Add a payout'}</DialogTitle>
          <DialogDescription>A salary, fee, commission or bill we pay regularly (or once). It shows up here and on the dashboard when it's due.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {Object.entries(PAYEE_KINDS).map(([k, { icon: Icon, label }]) => (
              <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, payee_kind: k }))}
                className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                  form.payee_kind === k ? 'border-crimson bg-crimson/15 text-white' : 'border-navy-600 text-muted-foreground hover:text-mist')}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isExternal ? (
              <Field label={isBill ? 'Bill' : 'Who gets paid'} e={err('payee_name')}>
                <Input value={form.payee_name} onChange={set('payee_name')} required maxLength={255}
                  placeholder={isBill ? 'e.g. Office rent, PLDT internet, Google Workspace' : 'e.g. Ana Reyes (agent)'} />
              </Field>
            ) : (
              <Field label="Team member" e={err('payee_user_id')}>
                <Select value={form.payee_user_id} onValueChange={pick('payee_user_id')}>
                  <SelectTrigger><SelectValue placeholder="Pick a person" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE} disabled>Pick a person</SelectItem>
                    {(meta?.team ?? []).map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name} · {u.role}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="For" e={err('category')}>
              <Input value={form.category} onChange={set('category')} required maxLength={100} list="payout-categories" placeholder="Salaries, Maintenance, Rent…" />
              <datalist id="payout-categories">{(meta?.categories ?? []).map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Amount (₱)" e={err('amount')}>
              <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required placeholder="0.00" />
            </Field>
            <Field label="How often" e={err('cycle')}>
              <Select value={form.cycle} onValueChange={pick('cycle')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PAYOUT_CYCLES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={form.cycle === 'once' ? 'Pay on' : 'Next pay date'} e={err('next_due_date')}>
              <Input type="date" value={form.next_due_date} onChange={set('next_due_date')} required />
            </Field>
            <Field label="Note (optional)" e={err('description')}>
              <Input value={form.description} onChange={set('description')} maxLength={255} placeholder="e.g. Maintains all client systems" />
            </Field>

            <Field label="Tied to a client system? (e.g. commission)" e={err('client_system_id')} className="sm:col-span-2">
              <Select value={form.client_system_id} onValueChange={pick('client_system_id')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No — general payout</SelectItem>
                  {systems.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.client_name ? `${o.client_name} — ` : ''}{o.display_name} ({peso(o.amount)}{SUFFIX[o.billing_cycle] ?? ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linked && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[['10%', 0.1], ['15%', 0.15], ['20%', 0.2]].map(([label, r]) => (
                    <button key={label} type="button" onClick={() => setForm((f) => ({ ...f, amount: Math.round(linked.amount * r * 100) / 100, cycle: linked.billing_cycle }))}
                      className="rounded-lg border border-dashed border-navy-600 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-crimson/50 hover:text-mist">
                      {label} of {peso(linked.amount)} = {peso(linked.amount * r)}
                    </button>
                  ))}
                  {linked.setup_fee > 0 && (
                    <button type="button" onClick={() => setForm((f) => ({ ...f, cycle: 'once', category: f.category || 'Commission', description: f.description || 'Commission on setup fee' }))}
                      className="rounded-lg border border-dashed border-navy-600 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-crimson/50 hover:text-mist">
                      One-time, on the {peso(linked.setup_fee)} setup fee
                    </button>
                  )}
                </div>
              )}
            </Field>

            <Field label="Usually paid via (optional)" e={err('payout_method')}>
              <Select value={form.payout_method} onValueChange={pick('payout_method')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Account no. (optional)" e={err('payout_account')}>
              <Input value={form.payout_account} onChange={set('payout_account')} maxLength={255} placeholder="GCash / bank account" />
            </Field>
            {isEdit && (
              <Field label="Status" e={err('status')}>
                <Select value={form.status} onValueChange={pick('status')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused — not paying for now</SelectItem>
                    {payout.cycle === 'once' && <SelectItem value="completed">Completed</SelectItem>}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field label="Notes (optional)" e={err('notes')}>
            <Textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={2000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : <><Plus /> Add payout</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Mark paid" — records an expense and moves the due date. Used here and on the Finance tab. */
export function PayoutPayDialog({ payout, onClose }) {
  const refresh = useRefreshMoney();
  const once = payout.cycle === 'once';
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    amount: payout.amount, cycles: 1, paid_on: todayISO(),
    method: payout.payout_method ?? 'cash', reference: '', notes: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => errors[k]?.[0];
  const client = clientStatus(payout.client_system);

  const save = useMutation({
    mutationFn: async () => (await api.post(`/admin/payouts/${payout.id}/pay`, form)).data,
    onSuccess: (res) => {
      toast.success(`${peso(form.amount)} paid to ${payout.payee_name}`, {
        description: once ? 'Recorded in Expenses.' : `Recorded in Expenses · next due ${fmtDate(res.data.next_due_date)}`,
      });
      refresh(); onClose();
    },
    onError: (e) => {
      setErrors(e.response?.data?.errors || {});
      if (!e.response?.data?.errors) toast.error(e.response?.data?.message || 'Could not record — please try again.');
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pay {payout.payee_name}</DialogTitle>
          <DialogDescription>{payout.category}{payout.description ? ` · ${payout.description}` : ''} · due {fmtDate(payout.next_due_date)}</DialogDescription>
        </DialogHeader>
        {(client || payout.payout_account) && (
          <div className="space-y-1 rounded-xl border border-navy-600 bg-navy-800/50 p-3 text-sm">
            {client && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{payout.client_system.client_name}</span>
                <span style={{ color: client.color }}>{client.text}</span>
              </div>
            )}
            {payout.payout_account && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Send to</span>
                <span className="text-mist">{METHOD_LABELS[payout.payout_method] ?? ''} {payout.payout_account}</span>
              </div>
            )}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
          {!once && (
            <Field label="Paying for" e={err('cycles')}>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 6].map((n) => (
                  <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, cycles: n, amount: Math.round(payout.amount * n * 100) / 100 }))}
                    className={cn('rounded-lg border px-3 py-1.5 text-xs transition-colors',
                      form.cycles === n ? 'border-crimson bg-crimson/15 text-white' : 'border-navy-600 bg-navy-800/60 text-mist hover:border-crimson/50')}>
                    {n} {UNIT[payout.cycle]}{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Amount paid (₱)" e={err('amount')}>
              <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required autoFocus />
            </Field>
            <Field label="Date paid" e={err('paid_on')}>
              <Input type="date" value={form.paid_on} onChange={set('paid_on')} required />
            </Field>
            <Field label="Method" e={err('method')}>
              <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Reference (optional)" e={err('reference')}>
              <Input value={form.reference} onChange={set('reference')} maxLength={100} placeholder="GCash / bank ref" />
            </Field>
          </div>
          <Field label="Notes (optional)" e={err('notes')}>
            <Textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={2000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner className="h-4 w-4" /> : <><BadgeCheck /> Mark paid</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One click: pay everything due this month (and overdue) at its usual amount. Untick what you're not paying yet. */
export function PayAllDialog({ onClose }) {
  const refresh = useRefreshMoney();
  const { data, isLoading } = useQuery({
    queryKey: ['payouts'],
    queryFn: async () => (await api.get('/admin/payouts')).data,
  });
  const eom = endOfMonthISO();
  const list = (data?.data ?? []).filter((p) => p.status === 'active');
  const dueNow = list.filter((p) => p.next_due_date <= eom);
  const later = list.filter((p) => p.next_due_date > eom);
  const [picked, setPicked] = useState(null); // null until touched → everything due now is ticked
  const selected = picked ?? new Set(dueNow.map((p) => p.id));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };
  const [paidOn, setPaidOn] = useState(todayISO());
  const [method, setMethod] = useState(NONE);
  const chosen = list.filter((p) => selected.has(p.id));
  const total = chosen.reduce((t, p) => t + p.amount, 0);

  const save = useMutation({
    mutationFn: async () => (await api.post('/admin/payouts/pay-bulk', {
      ids: chosen.map((p) => p.id), paid_on: paidOn, method: method === NONE ? null : method,
    })).data,
    onSuccess: (res) => {
      toast.success(`${res.paid_count} payment${res.paid_count === 1 ? '' : 's'} recorded · ${peso(res.paid_total)}`, {
        description: 'Saved in Expenses; each one moved to its next due date.',
      });
      refresh(); onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not record — please try again.'),
  });

  const item = (p) => {
    const meta = STATUS_META[p.due_state] ?? DUE_META.upcoming;
    return (
      <label key={p.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors',
        selected.has(p.id) ? 'bg-crimson/10' : 'bg-navy-800/50 hover:bg-navy-700/60')}>
        <input type="checkbox" className="h-4 w-4 accent-[#E91E4F]" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-mist">{p.payee_name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{p.category}{p.description ? ` · ${p.description}` : ''}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums text-white">{peso(p.amount)}</div>
          <div className="text-[11px]" style={{ color: meta.color }}>{dueLabel(p.days_until_due)}</div>
        </div>
      </label>
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Pay all due</DialogTitle>
          <DialogDescription>Everything due this month is ticked. Untick anything you haven't paid yet, then confirm.</DialogDescription>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-40" /> : (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {dueNow.length ? <div className="space-y-1.5">{dueNow.map(item)}</div>
              : <p className="py-4 text-center text-sm text-muted-foreground">Nothing left to pay this month.</p>}
            {later.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-mist">Pay ahead — {later.length} due later</summary>
                <div className="mt-1.5 space-y-1.5">{later.map(item)}</div>
              </details>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date paid"><Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required /></Field>
          <Field label="Method">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Each one's usual method</SelectItem>
                {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button disabled={save.isPending || !chosen.length} onClick={() => save.mutate()}>
            {save.isPending ? <Spinner className="h-4 w-4" /> : <><CheckCheck /> Mark {chosen.length} paid · {peso(total)}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayoutHistoryDialog({ payout, onClose }) {
  const refresh = useRefreshMoney();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payout-payments', payout.id],
    queryFn: async () => (await api.get(`/admin/payouts/${payout.id}/payments`)).data.data,
  });
  const undo = useMutation({
    mutationFn: (e) => api.delete(`/admin/payouts/${payout.id}/payments/${e.id}`),
    onSuccess: () => { toast.success('Payment removed.'); refresh(); refetch(); },
    onError: () => toast.error('Could not remove — please try again.'),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payments to {payout.payee_name}</DialogTitle>
          <DialogDescription>Removing the latest payment puts its due date back.</DialogDescription>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-32" /> : data?.length ? (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {data.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl bg-navy-800/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-mist">{peso(e.amount)} <span className="text-xs font-normal text-muted-foreground">· {fmtDate(e.spent_on)}</span></div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {e.covered_due_date && `For ${fmtDate(e.covered_due_date)}`}
                    {e.method && ` · ${METHOD_LABELS[e.method] ?? e.method}`}{e.reference && ` · #${e.reference}`}
                    {e.recorded_by && ` · by ${e.recorded_by}`}
                  </div>
                </div>
                <IconButton label={i === 0 ? 'Undo this payment' : 'Remove'} icon={i === 0 ? Undo2 : Trash2} size="icon-sm"
                  disabled={undo.isPending} onClick={() => undo.mutate(e)} />
              </li>
            ))}
          </ul>
        ) : <p className="py-6 text-center text-sm text-muted-foreground">Nothing paid yet.</p>}
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
