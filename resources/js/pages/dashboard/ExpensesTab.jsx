import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Receipt, Plus, ChevronLeft, ChevronRight, Search, Download, Pencil, Trash2, PieChart, ListChecks, Hash, Crown,
} from 'lucide-react';
import api from '@/lib/api';
import { peso, METHOD_LABELS, todayISO, localDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IconButton, Skeleton, Spinner, EmptyState } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Kpi, KpiGrid, Panel, Delta, pctChange, BarList, PALETTE, LIVE_INTERVAL } from './widgets';

const ALL = 'all';
const NONE = 'none';

const thisMonth = () => todayISO().slice(0, 7);
function shiftMonth(ym, by) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const monthLabel = (ym) => localDate(`${ym}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Record and review business expenses month by month. */
export default function ExpensesTab() {
  const queryClient = useQueryClient();
  const [month, setMonthRaw] = useState(thisMonth);
  const [category, setCategory] = useState(ALL);
  // A category filter from one month may not exist in another — reset it.
  const setMonth = (next) => { setMonthRaw(next); setCategory(ALL); };
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (new) | expense
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', month],
    queryFn: async () => (await api.get('/admin/expenses', { params: { month } })).data,
    refetchInterval: LIVE_INTERVAL,
    placeholderData: (prev) => prev,
  });

  // Filter on the client so typing feels instant; the month's data is already here.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.data ?? []).filter((e) =>
      (category === ALL || e.category === category)
      && (!q || [e.description, e.payee, e.reference, e.notes].some((v) => v?.toLowerCase().includes(q))));
  }, [data, category, search]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const remove = useMutation({
    mutationFn: (e) => api.delete(`/admin/expenses/${e.id}`),
    onSuccess: () => { toast.success('Expense deleted.'); setDeleting(null); refreshAll(); },
    onError: () => toast.error('Could not delete — please try again.'),
  });

  const summary = data?.summary;
  const top = summary?.by_category?.[0];
  const filteredTotal = rows.reduce((s, e) => s + Number(e.amount), 0);
  const isCurrent = month === thisMonth();

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Date', 'Category', 'Description', 'Payee', 'Method', 'Reference', 'Amount', 'Notes'].join(','),
      ...rows.map((e) => [e.spent_on, e.category, e.description, e.payee, METHOD_LABELS[e.method] ?? '', e.reference, e.amount, e.notes].map(esc).join(',')),
    ];
    const url = URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `expenses-${month}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" icon={ChevronLeft} size="icon-sm" onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="min-w-36 text-center text-base font-semibold text-white">{monthLabel(month)}</span>
          <IconButton label="Next month" icon={ChevronRight} size="icon-sm" disabled={isCurrent} onClick={() => setMonth(shiftMonth(month, 1))} />
          {!isCurrent && <Button variant="ghost" size="sm" onClick={() => setMonth(thisMonth())}>This month</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses…" className="pl-9" aria-label="Search expenses" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {(summary?.by_category ?? []).map((c) => <SelectItem key={c.category} value={c.category}>{c.category}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download /> CSV</Button>
          <Button onClick={() => setEditing({})}><Plus /> Add expense</Button>
        </div>
      </div>

      {isLoading && !data ? (
        <KpiGrid>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</KpiGrid>
      ) : (
        <KpiGrid>
          <Kpi index={0} icon={Receipt} label={`Total spent · ${monthLabel(month)}`} value={peso(summary?.total)} accent="#E91E4F"
            delta={<Delta value={pctChange(summary?.total, summary?.prev_total)} invert suffix="vs previous month" />} />
          <Kpi index={1} icon={Hash} label="Entries" value={summary?.count ?? 0} accent="#3B82F6"
            sub={summary?.count ? `avg ${peso((summary.total || 0) / summary.count)}` : 'Nothing recorded'} />
          <Kpi index={2} icon={Crown} label="Biggest category" value={top ? top.category : '—'} accent="#F59E0B"
            sub={top ? `${peso(top.total)} · ${Math.round((top.total / (summary.total || 1)) * 100)}% of spend` : 'Add an expense to see this'} />
          <Kpi index={3} icon={ListChecks} label="Last month" value={peso(summary?.prev_total)} accent="#8A96B8"
            sub="Full previous month total" />
        </KpiGrid>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Expenses" icon={Receipt}
          subtitle={rows.length ? `${rows.length} shown · ${peso(filteredTotal)}` : undefined}>
          {isLoading && !data ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : rows.length ? (
            <ul className="space-y-2">
              {rows.map((e) => {
                const color = PALETTE[(summary?.by_category ?? []).findIndex((c) => c.category === e.category) % PALETTE.length] ?? PALETTE[10];
                return (
                  <li key={e.id} className="group flex items-center gap-3 rounded-xl bg-navy-800/50 px-3 py-2.5">
                    <div className="w-11 shrink-0 text-center leading-tight">
                      <div className="text-[10px] uppercase text-muted-foreground">{localDate(e.spent_on).toLocaleDateString(undefined, { month: 'short' })}</div>
                      <div className="text-lg font-bold tabular-nums text-white">{localDate(e.spent_on).getDate()}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-mist">{e.description}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{e.category}</span>
                        {e.payee && <span className="truncate">· {e.payee}</span>}
                        {e.method && <span>· {METHOD_LABELS[e.method] ?? e.method}</span>}
                        {e.reference && <span className="truncate">· #{e.reference}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-white">{peso(e.amount)}</div>
                    <div className="flex shrink-0 items-center opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                      <IconButton label="Edit" icon={Pencil} size="icon-sm" onClick={() => setEditing(e)} />
                      <IconButton label="Delete" icon={Trash2} size="icon-sm" onClick={() => setDeleting(e)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Receipt}
              title={data?.data?.length ? 'No matches' : `No expenses in ${monthLabel(month)}`}
              description={data?.data?.length ? 'Try another search or category.' : 'Record hosting, salaries, rent and other costs to see your real profit.'}
              action={!data?.data?.length && <Button onClick={() => setEditing({})}><Plus /> Add expense</Button>} />
          )}
        </Panel>

        <Panel title="By category" icon={PieChart} subtitle="Click a category to filter.">
          <BarList format={peso} empty="No expenses this month."
            rows={(summary?.by_category ?? []).map((c, i) => ({ label: c.category, value: c.total, color: PALETTE[i % PALETTE.length] }))} />
          {(summary?.by_category?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {summary.by_category.map((c) => (
                <button key={c.category} type="button" onClick={() => setCategory(category === c.category ? ALL : c.category)}
                  className={`rounded-lg border px-2 py-0.5 text-[11px] transition-colors ${category === c.category
                    ? 'border-crimson bg-crimson/15 text-crimson-soft' : 'border-navy-600 text-muted-foreground hover:text-mist'}`}>
                  {c.category} · {c.count}
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {editing && (
        <ExpenseDialog expense={editing} categories={data?.categories ?? []}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            refreshAll();
            // Jump to the month the expense was saved in so it's visible.
            setMonth(saved.spent_on.slice(0, 7));
          }} />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `${deleting.description} · ${peso(deleting.amount)}. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-crimson" disabled={remove.isPending}
              onClick={(ev) => { ev.preventDefault(); remove.mutate(deleting); }}>
              {remove.isPending ? <Spinner className="h-4 w-4" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExpenseDialog({ expense, categories, onClose, onSaved }) {
  const isEdit = !!expense.id;
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    spent_on: expense.spent_on ?? todayISO(),
    amount: expense.amount ?? '',
    category: expense.category ?? '',
    description: expense.description ?? '',
    payee: expense.payee ?? '',
    method: expense.method ?? NONE,
    reference: expense.reference ?? '',
    notes: expense.notes ?? '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => errors[k]?.[0];

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, method: form.method === NONE ? null : form.method };
      const res = isEdit ? await api.patch(`/admin/expenses/${expense.id}`, payload) : await api.post('/admin/expenses', payload);
      return res.data.data;
    },
    onSuccess: (saved) => { toast.success(isEdit ? 'Expense updated.' : 'Expense added.'); onSaved(saved); onClose(); },
    onError: (e) => {
      setErrors(e.response?.data?.errors || {});
      if (!e.response?.data?.errors) toast.error('Could not save — please try again.');
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && !save.isPending && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit expense' : 'Add an expense'}</DialogTitle>
          <DialogDescription>It's counted against this month's collections to show your real profit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Amount (₱)" e={err('amount')}>
              <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required autoFocus placeholder="0.00" />
            </Field>
            <Field label="Date" e={err('spent_on')}>
              <Input type="date" value={form.spent_on} onChange={set('spent_on')} required />
            </Field>
            <Field label="What was it for?" e={err('description')} className="sm:col-span-2">
              <Input value={form.description} onChange={set('description')} required maxLength={255} placeholder="e.g. VPS hosting for client sites" />
            </Field>
            <Field label="Category" e={err('category')}>
              <Input value={form.category} onChange={set('category')} required maxLength={100} list="expense-categories" placeholder="Pick or type a category" />
              <datalist id="expense-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Paid with (optional)" e={err('method')}>
              <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Paid to (optional)" e={err('payee')}>
              <Input value={form.payee} onChange={set('payee')} maxLength={255} placeholder="e.g. Hostinger" />
            </Field>
            <Field label="Reference no. (optional)" e={err('reference')}>
              <Input value={form.reference} onChange={set('reference')} maxLength={100} placeholder="OR / GCash ref" />
            </Field>
          </div>
          {!form.category && (
            <div className="flex flex-wrap gap-1.5">
              {categories.slice(0, 8).map((c) => (
                <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className="rounded-lg border border-dashed border-navy-600 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-crimson/50 hover:text-mist">
                  + {c}
                </button>
              ))}
            </div>
          )}
          <Field label="Notes (optional)" e={err('notes')}>
            <Textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={2000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : <><Plus /> Add expense</>}
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
