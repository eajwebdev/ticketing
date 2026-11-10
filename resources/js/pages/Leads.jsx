import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Search, Target, Wallet, Trophy, BellRing, Phone, Mail, CalendarDays, UserCheck, Trash2, Copy, CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useLookups } from '@/hooks/queries';
import { can, P } from '@/lib/permissions';
import { peso, localDate } from '@/lib/format';
import { useTeamMembers } from '@/pages/Tasks';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton, Spinner } from '@/components/ui/misc';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const STAGES = [
  { key: 'new', label: 'New', color: '#8A96B8' },
  { key: 'contacted', label: 'Contacted', color: '#3B82F6' },
  { key: 'demo', label: 'Demo', color: '#8B5CF6' },
  { key: 'proposal', label: 'Proposal', color: '#F59E0B' },
  { key: 'won', label: 'Won', color: '#22C55E' },
  { key: 'lost', label: 'Lost', color: '#64748B' },
];
const SOURCES = {
  facebook: 'Facebook', referral: 'Referral', website: 'Website', walk_in: 'Walk-in', event: 'Event', cold_call: 'Cold call', other: 'Other',
};
const fmt = (iso) => (iso ? format(localDate(iso), 'MMM d') : '');

export default function Leads() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { data: members = [] } = useTeamMembers();
  const [owner, setOwner] = useState('all');
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [converting, setConverting] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const query = { ...(owner !== 'all' && { owner }), ...(source !== 'all' && { source }), ...(search && { search }) };
  const key = ['leads', query];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get('/leads', { params: query })).data });
  const leads = data?.data ?? [];
  const s = data?.summary;

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map((c) => [c.key, []]));
    leads.forEach((l) => m[l.stage]?.push(l));
    return m;
  }, [leads]);

  const deepId = Number(params.get('lead'));
  useEffect(() => {
    if (!deepId || !data) return;
    const l = leads.find((x) => x.id === deepId);
    if (l) setEditing(l); else toast.error('That lead no longer exists.');
    setParams({}, { replace: true });
  }, [deepId, data, leads, setParams]);

  const move = useMutation({
    mutationFn: ({ id, stage }) => api.post(`/leads/${id}/move`, { stage }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
    onError: () => toast.error('Could not move lead.'),
  });

  const drop = (stage) => {
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null); setOverCol(null);
    if (!lead || lead.stage === stage) return;
    if (stage === 'won' && !lead.converted_client) { setConverting(lead); return; }
    queryClient.setQueryData(key, (old) => old && { ...old, data: old.data.map((l) => (l.id === lead.id ? { ...l, stage } : l)) });
    move.mutate({ id: lead.id, stage });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prospects from first contact to signed client. Drag to move them along.</p>
        </div>
        <Button onClick={() => setEditing({})}><Plus /> New lead</Button>
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} icon={Target} label="Open leads" value={s.open} accent="#3B82F6" />
          <StatCard index={1} icon={Wallet} label="Pipeline value" value={peso(s.pipeline_value)} accent="#8B5CF6" />
          <StatCard index={2} icon={Trophy} label="Won this month" value={s.won_this_month}
            sub={s.win_rate_this_month != null ? `${s.win_rate_this_month}% win rate · ${peso(s.won_value_this_month)}` : peso(s.won_value_this_month)} accent="#22C55E" />
          <StatCard index={3} icon={BellRing} label="Follow-ups due" value={s.follow_ups_due} accent="#E91E4F" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search business, contact, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            <SelectItem value="me">My leads</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any source</SelectItem>
            {Object.entries(SOURCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">{STAGES.map((c) => <Skeleton key={c.key} className="h-80" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((st) => {
            const total = byStage[st.key].reduce((a, l) => a + (l.estimated_value || 0), 0);
            return (
              <div key={st.key}
                onDragOver={(e) => { e.preventDefault(); setOverCol(st.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
                onDrop={(e) => { e.preventDefault(); drop(st.key); }}
                className={cn('flex min-h-56 flex-col rounded-2xl border border-navy-600/60 bg-navy-800/30 p-2.5 transition-colors',
                  overCol === st.key && 'border-crimson/50 bg-crimson/5')}>
                <div className="mb-2.5 px-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-mist"><span className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} />{st.label}</span>
                    <span className="rounded-full bg-navy-700 px-2 text-xs text-muted-foreground">{byStage[st.key].length}</span>
                  </div>
                  {total > 0 && <div className="mt-0.5 text-[11px] text-muted-foreground">{peso(total)}</div>}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {byStage[st.key].map((l) => (
                    <LeadCard key={l.id} l={l} dragging={dragId === l.id} onOpen={() => setEditing(l)}
                      onDragStart={() => setDragId(l.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} />
                  ))}
                  {byStage[st.key].length === 0 && <p className="py-6 text-center text-xs text-muted-foreground/70">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && <LeadDialog lead={editing} members={members} onClose={() => setEditing(null)}
        onConvert={(l) => { setEditing(null); setConverting(l); }} />}
      {converting && <ConvertDialog lead={converting} onClose={() => setConverting(null)} />}
    </div>
  );
}

function LeadCard({ l, dragging, onOpen, onDragStart, onDragEnd }) {
  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }} onDragEnd={onDragEnd}
      onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className={cn('cursor-grab rounded-xl glass p-3 transition-all hover:border-crimson/40 active:cursor-grabbing',
        dragging && 'opacity-40', l.follow_up_due && 'border-crimson/40')}>
      <div className="text-sm font-semibold leading-snug text-mist">{l.business_name}</div>
      {l.contact_person && <div className="truncate text-xs text-muted-foreground">{l.contact_person}</div>}
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {l.system_type && <span className="truncate">{l.system_type.name}</span>}
        {l.estimated_value != null && <span className="font-medium text-mist">{peso(l.estimated_value)}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {l.converted_client ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400"><UserCheck className="h-3 w-3" /> Client</span>
        ) : l.next_follow_up && ['new', 'contacted', 'demo', 'proposal'].includes(l.stage) ? (
          <span className={cn('inline-flex items-center gap-1 text-[11px]', l.follow_up_due ? 'font-semibold text-crimson-soft' : 'text-muted-foreground')}>
            <CalendarDays className="h-3 w-3" />{l.follow_up_due ? 'Follow up!' : fmt(l.next_follow_up)}
          </span>
        ) : <span className="text-[11px] text-muted-foreground">{SOURCES[l.source]}</span>}
        {l.owner && <UserAvatar user={l.owner} className="h-5 w-5" title={l.owner.name} />}
      </div>
    </div>
  );
}

function LeadDialog({ lead, members, onClose, onConvert }) {
  const isEdit = !!lead.id;
  const { user } = useAuth();
  const { data: lookups } = useLookups();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState({});
  const NONE = '__none';
  const [form, setForm] = useState({
    business_name: lead.business_name ?? '',
    contact_person: lead.contact_person ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    business_type: lead.business_type ?? '',
    source: lead.source ?? 'facebook',
    system_type_id: lead.system_type?.id ? String(lead.system_type.id) : '',
    estimated_value: lead.estimated_value ?? '',
    stage: lead.stage ?? 'new',
    owner_id: lead.owner?.id ? String(lead.owner.id) : String(user.id),
    next_follow_up: lead.next_follow_up ?? '',
    notes: lead.notes ?? '',
    lost_reason: lead.lost_reason ?? '',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const err = (k) => errors[k]?.[0];

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
      payload.source ??= 'other';
      return (await api[isEdit ? 'patch' : 'post'](isEdit ? `/leads/${lead.id}` : '/leads', payload)).data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success(isEdit ? 'Lead updated.' : 'Lead added.'); onClose(); },
    onError: (e) => setErrors(e.response?.data?.errors || {}),
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/leads/${lead.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead deleted.'); onClose(); },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? lead.business_name : 'New lead'}</DialogTitle>
          <DialogDescription>
            {lead.converted_client ? <>Converted to client <span className="text-mist">{lead.converted_client.name}</span>.</> : 'Who are they, what do they need, and when do we follow up?'}
          </DialogDescription>
        </DialogHeader>
        {isEdit && (lead.phone || lead.email) && (
          <div className="flex flex-wrap gap-2">
            {lead.phone && <Button asChild variant="secondary" size="sm"><a href={`tel:${lead.phone}`}><Phone /> {lead.phone}</a></Button>}
            {lead.email && <Button asChild variant="secondary" size="sm"><a href={`mailto:${lead.email}`}><Mail /> Email</a></Button>}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Business name" e={err('business_name')}><Input value={form.business_name} onChange={set('business_name')} required autoFocus={!isEdit} /></F>
            <F label="Business type" e={err('business_type')}><Input value={form.business_type} onChange={set('business_type')} placeholder="e.g. Pharmacy" /></F>
            <F label="Contact person" e={err('contact_person')}><Input value={form.contact_person} onChange={set('contact_person')} /></F>
            <F label="Phone" e={err('phone')}><Input value={form.phone} onChange={set('phone')} /></F>
            <F label="Email" e={err('email')}><Input type="email" value={form.email} onChange={set('email')} /></F>
            <F label="Interested in" e={err('system_type_id')}>
              <Select value={form.system_type_id || NONE} onValueChange={(v) => setForm({ ...form, system_type_id: v === NONE ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not sure yet</SelectItem>
                  {lookups?.system_types?.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <F label="Stage">
              <Select value={form.stage} onValueChange={set('stage')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map((st) => <SelectItem key={st.key} value={st.key}>{st.label}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Source">
              <Select value={form.source} onValueChange={set('source')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SOURCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Est. value (₱)" e={err('estimated_value')}><Input type="number" min="0" step="0.01" value={form.estimated_value} onChange={set('estimated_value')} /></F>
            <F label="Next follow-up" e={err('next_follow_up')}><Input type="date" value={form.next_follow_up} onChange={set('next_follow_up')} /></F>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Owner">
              <Select value={form.owner_id || NONE} onValueChange={(v) => setForm({ ...form, owner_id: v === NONE ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nobody</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}{m.id === user.id ? ' (me)' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            {form.stage === 'lost' && <F label="Why lost?" e={err('lost_reason')}><Input value={form.lost_reason} onChange={set('lost_reason')} placeholder="Price, timing, competitor…" /></F>}
          </div>
          <F label="Notes" e={err('notes')}><Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Calls, needs, budget, objections…" /></F>

          <DialogFooter className="sm:justify-between">
            <div className="flex gap-1">
              {isEdit && (
                <Button type="button" variant="ghost" className="text-rose-400 hover:text-rose-400"
                  onClick={() => window.confirm('Delete this lead?') && del.mutate()}><Trash2 /> Delete</Button>
              )}
              {isEdit && !lead.converted_client && can(user, P.CLIENTS) && (
                <Button type="button" variant="secondary" onClick={() => onConvert(lead)}><UserCheck /> Convert to client</Button>
              )}
              {lead.converted_client && can(user, P.BILLING) && (
                <Button asChild variant="secondary"><Link to="/app/admin/client-systems">Add their system</Link></Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save' : <><Plus /> Add lead</>}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Won → create the client account from the lead in one step. */
function ConvertDialog({ lead, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: lead.contact_person || lead.business_name, email: lead.email || '' });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  const allowed = can(user, P.CLIENTS);

  const convert = useMutation({
    mutationFn: async () => (await api.post(`/leads/${lead.id}/convert`, form)).data,
    onSuccess: (d) => { queryClient.invalidateQueries({ queryKey: ['leads'] }); queryClient.invalidateQueries({ queryKey: ['admin-clients'] }); setDone(d); },
    onError: (e) => { setErrors(e.response?.data?.errors || {}); if (!e.response?.data?.errors) toast.error(e.response?.data?.message || 'Could not convert.'); },
  });
  const justWon = useMutation({
    mutationFn: () => api.post(`/leads/${lead.id}/move`, { stage: 'won' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Marked as won 🎉'); onClose(); },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-7 w-7" /></div>
            <DialogTitle>{lead.business_name} is now a client 🎉</DialogTitle>
            <DialogDescription className="mt-1">Share this temporary password with {form.name} so they can sign in and file tickets.</DialogDescription>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-navy-600 bg-navy-800/60 p-4">
              <code className="font-mono text-lg text-crimson-soft">{done.temporary_password}</code>
              <Button size="icon" variant="secondary" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(done.temporary_password); toast.success('Copied'); }}><Copy /></Button>
            </div>
            <DialogFooter className="mt-5 sm:justify-center">
              {can(user, P.BILLING) && <Button asChild variant="secondary"><Link to="/app/admin/client-systems" onClick={onClose}>Add their system & billing</Link></Button>}
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Won {lead.business_name}! 🎉</DialogTitle>
              <DialogDescription>{allowed ? 'Create their client account now so they can file tickets.' : 'Mark the deal as won. Someone with Clients access can create their account.'}</DialogDescription>
            </DialogHeader>
            {allowed && (
              <div className="space-y-3">
                <F label="Client login name" e={errors.name?.[0]}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
                <F label="Client email" e={errors.email?.[0]}><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => justWon.mutate()} disabled={justWon.isPending}>Just mark as won</Button>
              {allowed && <Button onClick={() => { setErrors({}); convert.mutate(); }} disabled={convert.isPending}>{convert.isPending ? <Spinner className="h-4 w-4" /> : <><UserCheck /> Create client</>}</Button>}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function F({ label, e, children }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{e && <p className="text-xs text-crimson-soft">{e}</p>}</div>;
}
