import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Search, KanbanSquare, CalendarDays, AlertTriangle, CheckCircle2, ListTodo, Trash2, Ticket as TicketIcon, Building2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { can, P } from '@/lib/permissions';
import { localDate } from '@/lib/format';
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

export const COLUMNS = [
  { key: 'todo', label: 'To do', color: '#8A96B8' },
  { key: 'in_progress', label: 'In progress', color: '#3B82F6' },
  { key: 'review', label: 'Review / QA', color: '#F59E0B' },
  { key: 'done', label: 'Done', color: '#22C55E' },
];
export const PRIORITIES = {
  urgent: { label: 'Urgent', color: '#E91E4F' },
  high: { label: 'High', color: '#F59E0B' },
  medium: { label: 'Medium', color: '#3B82F6' },
  low: { label: 'Low', color: '#8A96B8' },
};
export const TYPES = {
  feature: 'Feature', bug: 'Bug', improvement: 'Improvement', design: 'Design', marketing: 'Marketing', support: 'Support', other: 'Other',
};

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => (await api.get('/team-members')).data.data,
    staleTime: 60_000,
  });
}

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { data: members = [] } = useTeamMembers();
  const [assignee, setAssignee] = useState('all');
  const [priority, setPriority] = useState('all');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | {} new | task
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const query = {
    ...(assignee !== 'all' && { assignee }),
    ...(priority !== 'all' && { priority }),
    ...(type !== 'all' && { type }),
    ...(search && { search }),
  };
  const key = ['tasks', query];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get('/tasks', { params: query })).data });
  const tasks = data?.data ?? [];
  const s = data?.summary;

  const byCol = useMemo(() => {
    const m = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    tasks.forEach((t) => m[t.status]?.push(t));
    return m;
  }, [tasks]);

  // Deep link: /app/tasks?task=12 opens it.
  const deepId = Number(params.get('task'));
  useEffect(() => {
    if (!deepId) return;
    const t = tasks.find((x) => x.id === deepId);
    if (t) { setEditing(t); setParams({}, { replace: true }); }
    else if (data) {
      api.get('/tasks', { params: { include_old_done: 1 } }).then(({ data: all }) => {
        const found = all.data.find((x) => x.id === deepId);
        if (found) setEditing(found); else toast.error('That task no longer exists.');
        setParams({}, { replace: true });
      });
    }
  }, [deepId, tasks, data, setParams]);

  const move = useMutation({
    mutationFn: ({ id, status, ordered_ids }) => api.post(`/tasks/${id}/move`, { status, ordered_ids }),
    onError: (e) => { toast.error(e.response?.data?.message || 'Could not move task.'); queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // Drop onto a column (append) or onto a card (insert before it).
  const drop = (colKey, beforeId = null) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null); setOverCol(null);
    if (!task) return;
    if (!task.can_edit) { toast.error('Only the creator, the assignee or a manager can move this task.'); return; }
    const ids = byCol[colKey].map((t) => t.id).filter((id) => id !== task.id);
    const at = beforeId ? ids.indexOf(beforeId) : -1;
    if (at >= 0) ids.splice(at, 0, task.id); else ids.push(task.id);
    if (task.status === colKey && ids.join() === byCol[colKey].map((t) => t.id).join()) return;

    // Optimistic update so the card lands instantly.
    queryClient.setQueryData(key, (old) => old && {
      ...old,
      data: old.data.map((t) => (t.id === task.id ? { ...t, status: colKey } : t))
        .map((t) => (t.status === colKey ? { ...t, position: ids.indexOf(t.id) } : t))
        .sort((a, b) => a.position - b.position),
    });
    move.mutate({ id: task.id, status: colKey, ordered_ids: ids });
    if (colKey === 'done' && task.status !== 'done') toast.success('Nice — task done ✅');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything the team is working on. Drag cards between columns.</p>
        </div>
        <Button onClick={() => setEditing({})}><Plus /> New task</Button>
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} icon={ListTodo} label="My open tasks" value={s.mine_open} accent="#3B82F6" />
          <StatCard index={1} icon={AlertTriangle} label="My overdue" value={s.mine_overdue} accent="#E91E4F" />
          <StatCard index={2} icon={KanbanSquare} label="Team open" value={s.open} sub={s.overdue ? `${s.overdue} overdue` : 'Nothing overdue'} accent="#8B5CF6" />
          <StatCard index={3} icon={CheckCircle2} label="Done this week" value={s.done_this_week} accent="#22C55E" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.filter((m) => m.id !== user.id).map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any priority</SelectItem>
            {Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any type</SelectItem>
            {Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{COLUMNS.map((c) => <Skeleton key={c.key} className="h-96" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); drop(col.key); }}
              className={cn('flex min-h-64 flex-col rounded-2xl border border-navy-600/60 bg-navy-800/30 p-3 transition-colors',
                overCol === col.key && 'border-crimson/50 bg-crimson/5')}>
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-mist">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />{col.label}
                </div>
                <span className="rounded-full bg-navy-700 px-2 text-xs text-muted-foreground">{byCol[col.key].length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {byCol[col.key].map((t) => (
                  <TaskCard key={t.id} t={t} dragging={dragId === t.id}
                    onOpen={() => setEditing(t)}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onDropBefore={() => drop(col.key, t.id)} />
                ))}
                {col.key === 'todo' && (
                  <button type="button" onClick={() => setEditing({ status: 'todo' })}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-navy-600 py-2.5 text-xs text-muted-foreground transition-colors hover:border-crimson/40 hover:text-mist">
                    <Plus className="h-3.5 w-3.5" /> Add task
                  </button>
                )}
                {col.key !== 'todo' && byCol[col.key].length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground/70">Drop tasks here</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <TaskDialog task={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TaskCard({ t, dragging, onOpen, onDragStart, onDragEnd, onDropBefore }) {
  const pr = PRIORITIES[t.priority];
  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }} onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropBefore(); }}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      role="button" tabIndex={0}
      className={cn('cursor-grab rounded-xl glass p-3 text-left transition-all hover:border-crimson/40 active:cursor-grabbing',
        dragging && 'opacity-40', t.status === 'done' && 'opacity-75')}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
        <span className="rounded px-1.5 py-0.5" style={{ color: pr.color, background: `${pr.color}1f` }}>{pr.label}</span>
        <span className="text-muted-foreground">{TYPES[t.type]}</span>
      </div>
      <div className={cn('text-sm font-medium leading-snug text-mist', t.status === 'done' && 'line-through decoration-muted-foreground/60')}>{t.title}</div>
      {(t.client || t.ticket) && (
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {t.client && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{t.client.store_name || t.client.name}</span>}
          {t.ticket && <span className="inline-flex items-center gap-1 font-mono"><TicketIcon className="h-3 w-3" />{t.ticket.ticket_number}</span>}
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between">
        {t.due_date ? (
          <span className={cn('inline-flex items-center gap-1 text-[11px]', t.is_overdue ? 'font-semibold text-crimson-soft' : 'text-muted-foreground')}>
            <CalendarDays className="h-3 w-3" />{t.is_overdue ? 'Overdue · ' : ''}{format(localDate(t.due_date), 'MMM d')}
          </span>
        ) : <span />}
        {t.assignee ? <UserAvatar user={t.assignee} className="h-6 w-6" title={t.assignee.name} /> : <span className="text-[11px] text-muted-foreground">Unassigned</span>}
      </div>
    </div>
  );
}

/** Create / edit a task. Also used from a ticket (prefilled with ticket + client). */
export function TaskDialog({ task, onClose }) {
  const isEdit = !!task.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: members = [] } = useTeamMembers();
  const canPickClient = can(user, P.CLIENTS, P.BILLING, P.TICKETS, P.LEADS);
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-select'],
    enabled: canPickClient,
    queryFn: async () => (await api.get('/admin/clients', { params: { status: 'approved', per_page: 200 } })).data,
  });
  const clients = clientsData?.data ?? [];
  const readOnly = isEdit && !task.can_edit;
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    title: task.title ?? '',
    description: task.description ?? '',
    status: task.status ?? 'todo',
    priority: task.priority ?? 'medium',
    type: task.type ?? 'feature',
    assignee_id: task.assignee?.id ? String(task.assignee.id) : (isEdit ? '' : String(user.id)),
    client_id: task.client?.id ? String(task.client.id) : (task.client_id ? String(task.client_id) : ''),
    ticket_id: task.ticket?.id ?? task.ticket_id ?? null,
    due_date: task.due_date ?? '',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const err = (k) => errors[k]?.[0];
  const NONE = '__none';

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, assignee_id: form.assignee_id || null, client_id: form.client_id || null, due_date: form.due_date || null };
      if (!canPickClient) delete payload.client_id;
      return (await api[isEdit ? 'patch' : 'post'](isEdit ? `/tasks/${task.id}` : '/tasks', payload)).data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); toast.success(isEdit ? 'Task updated.' : 'Task created.'); onClose(); },
    onError: (e) => { setErrors(e.response?.data?.errors || {}); if (!e.response?.data?.errors) toast.error(e.response?.data?.message || 'Could not save.'); },
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/tasks/${task.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task deleted.'); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not delete.'),
  });
  const canDelete = isEdit && (can(user, P.TASKS_MANAGE) || task.creator?.id === user.id);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? <>Created by {task.creator?.name ?? '—'}{task.completed_at && ` · completed ${format(new Date(task.completed_at), 'MMM d, yyyy')}`}{readOnly && ' · view only'}</>
              : 'Assign work to anyone on the team. They get notified.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); save.mutate(); }} className="space-y-4">
          <fieldset disabled={readOnly} className="space-y-4">
            <F label="Title" e={err('title')}><Input value={form.title} onChange={set('title')} required autoFocus={!isEdit} placeholder="e.g. Fix receipt printing on Laundry POS" /></F>
            <F label="Details" e={err('description')}><Textarea rows={4} value={form.description} onChange={set('description')} placeholder="Steps, acceptance criteria, links…" /></F>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <F label="Status">
                <Select value={form.status} onValueChange={set('status')} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Priority">
                <Select value={form.priority} onValueChange={set('priority')} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Type">
                <Select value={form.type} onValueChange={set('type')} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Due date" e={err('due_date')}><Input type="date" value={form.due_date} onChange={set('due_date')} /></F>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Assignee" e={err('assignee_id')}>
                <Select value={form.assignee_id || NONE} onValueChange={(v) => setForm({ ...form, assignee_id: v === NONE ? '' : v })} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}{m.id === user.id ? ' (me)' : ''} · {m.role_label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              {canPickClient && (
                <F label="Client (optional)" e={err('client_id')}>
                  <Select value={form.client_id || NONE} onValueChange={(v) => setForm({ ...form, client_id: v === NONE ? '' : v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Internal / no client</SelectItem>
                      {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.store_name || c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
              )}
            </div>
            {task.ticket && (
              <Link to={`/app/tickets/${task.ticket.id}`} onClick={onClose}
                className="flex items-center gap-2 rounded-xl border border-navy-600 bg-navy-800/50 px-3 py-2 text-sm text-mist hover:border-crimson/40">
                <TicketIcon className="h-4 w-4 text-crimson-soft" /><span className="font-mono text-xs">{task.ticket.ticket_number}</span>
                <span className="truncate text-muted-foreground">{task.ticket.subject}</span>
              </Link>
            )}
          </fieldset>
          <DialogFooter className="sm:justify-between">
            <div>
              {canDelete && (
                <Button type="button" variant="ghost" className="text-rose-400 hover:text-rose-400" disabled={del.isPending}
                  onClick={() => window.confirm('Delete this task?') && del.mutate()}>
                  <Trash2 /> Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
              {!readOnly && (
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save' : <><Plus /> Create task</>}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, e, children }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{e && <p className="text-xs text-crimson-soft">{e}</p>}</div>;
}
