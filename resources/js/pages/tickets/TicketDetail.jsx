import { useState } from 'react';
import { can, P } from '@/lib/permissions';
import { TaskDialog } from '@/pages/Tasks';
import { KanbanSquare } from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Check, RotateCcw, UserPlus, X, Clock, Zap, CheckCircle2,
  Layers, Tag, Activity, Users, ShieldCheck, CalendarClock, MessageSquare, Info,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTicket } from '@/hooks/queries';
import { ChatPanel } from '@/components/tickets/ChatPanel';
import { UrgencyDot } from '@/components/tickets/TicketCard';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { IconButton, FullPageLoader, EmptyState } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { STATUS_META, dateTime, fromNow, humanizeMinutes } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: ticket, isLoading, isError } = useTicket(id);
  // Mobile: Messenger-style — chat fills the screen, info lives in its own tab.
  const [mobileTab, setMobileTab] = useState('chat');
  const [taskOpen, setTaskOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const action = useMutation({
    mutationFn: ({ verb, payload }) => api.post(`/tickets/${id}/${verb}`, payload ?? {}),
    onSuccess: (_, { verb }) => {
      invalidate();
      toast.success(`Ticket ${verb === 'accept' ? 'accepted' : verb === 'resolve' ? 'resolved' : 'reopened'}.`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed.'),
  });

  if (isLoading) return <FullPageLoader />;
  if (isError || !ticket) return (
    <EmptyState icon={X} title="Ticket not found" description="It may have been removed or you don't have access."
      action={<Button variant="outline" onClick={() => navigate('/app/tickets')}><ArrowLeft /> Back to tickets</Button>} />
  );

  const isTeam = user.role !== 'customer';
  const meta = STATUS_META[ticket.status] ?? STATUS_META.open;
  const isAssignee = ticket.assignees?.some((a) => a.id === user.id);
  const canAccept = isTeam && ['open', 'reopened'].includes(ticket.status) && !ticket.accepted_by;
  const canResolve = isTeam && isAssignee && ['accepted', 'reopened'].includes(ticket.status);
  const canReopen = ['resolved', 'closed'].includes(ticket.status);
  const canManage = isTeam && (can(user, P.SETTINGS) || isAssignee);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/tickets')} aria-label="Back"><ArrowLeft /></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-crimson-soft">{ticket.ticket_number}</span>
            <span>· created {fromNow(ticket.created_at)}</span>
          </div>
          <h1 className="truncate text-xl font-bold text-white">{ticket.subject}</h1>
        </div>
        <StatusBadge meta={meta} />

        {/* Lifecycle actions (icon-only) */}
        <div className="flex items-center gap-1.5">
          {canAccept && (
            <Tooltip label="Accept ticket">
              <Button size="sm" onClick={() => action.mutate({ verb: 'accept' })} disabled={action.isPending}>
                <Check /> Accept
              </Button>
            </Tooltip>
          )}
          {canResolve && (
            <>
              <EtaDialog ticket={ticket} onSaved={invalidate} />
              <Tooltip label="Mark resolved">
                <Button size="sm" variant="secondary" onClick={() => action.mutate({ verb: 'resolve' })} disabled={action.isPending}>
                  <CheckCircle2 /> Resolve
                </Button>
              </Tooltip>
            </>
          )}
          {canReopen && (
            <ReopenButton onConfirm={() => action.mutate({ verb: 'reopen' })} />
          )}
          {isTeam && (
            <Tooltip label="Turn this into a task for the team">
              <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}><KanbanSquare /> Create task</Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Mobile tab switch: chat stays full-screen like a messenger; info is one tap away. */}
      <div className="flex gap-1 rounded-xl bg-navy-800/60 p-1 border border-navy-600 lg:hidden">
        {[
          { key: 'chat', icon: MessageSquare, label: 'Chat' },
          { key: 'info', icon: Info, label: 'Details & Timeline' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setMobileTab(t.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              mobileTab === t.key
                ? 'bg-crimson text-white shadow-[0_0_16px_rgba(233,30,79,0.35)]'
                : 'text-muted-foreground hover:text-mist'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Chat — kept mounted on mobile even when Info tab is open (websocket stays live) */}
        <div className={cn('lg:col-span-2', mobileTab !== 'chat' && 'hidden lg:block')}>
          <ChatPanel ticket={ticket} />
        </div>

        {/* Sidebar */}
        <div className={cn('space-y-5', mobileTab !== 'info' && 'hidden lg:block')}>
          <DetailsCard ticket={ticket} />
          <CollaboratorsCard ticket={ticket} canManage={canManage} onChange={invalidate} />
          <TimelineCard ticket={ticket} />
        </div>
      </div>

      {taskOpen && (
        <TaskDialog
          task={{
            title: `${ticket.ticket_number}: ${ticket.subject}`,
            description: ticket.description,
            ticket_id: ticket.id,
            ticket: { id: ticket.id, ticket_number: ticket.ticket_number, subject: ticket.subject },
            client_id: ticket.customer?.role === 'customer' ? ticket.customer.id : null,
            type: 'bug',
            priority: ['High', 'Critical'].includes(ticket.urgency?.name) ? 'high' : 'medium',
          }}
          onClose={() => setTaskOpen(false)}
        />
      )}
    </div>
  );
}

function EtaDialog({ ticket, onSaved }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (date) => {
    setSaving(true);
    try {
      await api.post(`/tickets/${ticket.id}/eta`, { expected_resolution_at: date });
      toast.success('Expected fix date set — the client has been notified.');
      onSaved();
      setOpen(false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not set the timeline.');
    } finally {
      setSaving(false);
    }
  };

  const preset = (days, label) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(17, 0, 0, 0); // end of business day
    return { label, date: d };
  };

  const presets = [
    preset(0, 'Today (5 PM)'),
    preset(1, 'Tomorrow'),
    preset(2, 'In 2 days'),
    preset(3, 'In 3 days'),
    preset(7, 'In 1 week'),
  ].filter((p) => p.date > new Date());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClock /> {ticket.expected_resolution_at ? 'Update timeline' : 'Set timeline'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>When will this be fixed?</DialogTitle>
          <DialogDescription>
            The client sees this on the ticket and gets notified — great for requests that take a few days.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              disabled={saving}
              onClick={() => save(p.date.toISOString())}
              className="rounded-full border border-navy-600 bg-navy-700/60 px-3.5 py-1.5 text-xs font-medium text-mist/80 transition-colors hover:border-crimson/50 hover:text-white disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 border-t border-navy-600/60 pt-4">
          <Label>Or pick an exact date & time</Label>
          <Input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={!custom || saving}
            onClick={() => save(new Date(custom).toISOString())}
          >
            {saving ? 'Saving…' : 'Set expected fix date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReopenButton({ onConfirm }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline"><RotateCcw /> Reopen</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reopen this ticket?</AlertDialogTitle>
          <AlertDialogDescription>The ticket will move back to active and assignees will be notified.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-crimson hover:bg-crimson-dark">Reopen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DetailsCard({ ticket }) {
  const rows = [
    { icon: Layers, label: 'System', value: ticket.system_type?.name && (ticket.client_system?.label ? `${ticket.system_type.name} (${ticket.client_system.label})` : ticket.system_type.name) },
    { icon: Tag, label: 'Category', value: ticket.category?.name },
    { icon: Zap, label: 'Urgency', value: ticket.urgency ? <UrgencyDot urgency={ticket.urgency} /> : null },
  ].filter((r) => r.value);

  return (
    <div className="rounded-2xl glass p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-crimson-soft" /> Details</h3>
      <p className="mb-4 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground"><r.icon className="h-3.5 w-3.5" />{r.label}</span>
            <span className="text-mist">{r.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5" />Requested by</span>
          <span className="text-mist">{ticket.customer?.store_name || ticket.customer?.name}</span>
        </div>
      </div>

      {/* Expected fix date — the promise made to the client */}
      {ticket.expected_resolution_at && !ticket.resolved_at && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-crimson/25 bg-crimson/5 p-3">
          <div className="rounded-lg bg-crimson/15 p-2 text-crimson-soft"><CalendarClock className="h-4 w-4" /></div>
          <div>
            <div className="text-xs text-muted-foreground">Expected fix by</div>
            <div className="text-sm font-semibold text-mist">{dateTime(ticket.expected_resolution_at)}</div>
            <div className="text-[11px] text-crimson-soft">{fromNow(ticket.expected_resolution_at)}</div>
          </div>
        </div>
      )}

      {/* Time metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-navy-600/60 pt-4">
        <Metric icon={Zap} label="Response" value={humanizeMinutes(ticket.response_time_minutes)} color="#22C55E" />
        <Metric icon={Clock} label="Resolution" value={humanizeMinutes(ticket.resolution_time_minutes)} color="#F59E0B" />
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl bg-navy-800/50 p-3">
      <Icon className="h-4 w-4" style={{ color }} />
      <div className="mt-1.5 text-lg font-bold text-white">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function CollaboratorsCard({ ticket, canManage, onChange }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [open, setOpen] = useState(false);

  const loadTeam = async () => {
    if (teamMembers.length) return;
    try { setTeamMembers((await api.get('/team-members')).data.data); } catch { /* ignore */ }
  };

  const add = async (userId) => {
    try {
      await api.post(`/tickets/${ticket.id}/assignees`, { user_id: userId });
      toast.success('Collaborator added.');
      onChange();
      setOpen(false);
    } catch (e) { toast.error(e.response?.data?.message || 'Could not add collaborator.'); }
  };

  const remove = async (userId) => {
    try {
      await api.delete(`/tickets/${ticket.id}/assignees/${userId}`);
      toast.success('Collaborator removed.');
      onChange();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not remove.'); }
  };

  const assignees = ticket.assignees ?? [];
  const existingIds = new Set(assignees.map((a) => a.id));

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-crimson-soft" /> Team on this ticket</h3>
        {canManage && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadTeam(); }}>
            <DialogTrigger asChild>
              <IconButton label="Add collaborator" icon={UserPlus} size="icon-sm" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a collaborator</DialogTitle></DialogHeader>
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {teamMembers.filter((m) => !existingIds.has(m.id)).map((m) => (
                  <button key={m.id} onClick={() => add(m.id)}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-navy-700">
                    <UserAvatar user={m} className="h-9 w-9" />
                    <div>
                      <div className="text-sm font-medium text-mist">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.position} · {m.department}</div>
                    </div>
                    <UserPlus className="ml-auto h-4 w-4 text-crimson-soft" />
                  </button>
                ))}
                {teamMembers.filter((m) => !existingIds.has(m.id)).length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Everyone's already here.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {assignees.length === 0 ? (
        <p className="text-sm text-muted-foreground">Unassigned — waiting for an agent to accept.</p>
      ) : (
        <div className="space-y-2">
          {assignees.map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <UserAvatar user={a} className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <Link to={`/team/${a.id}`} className="block truncate text-sm font-medium text-mist hover:text-crimson-soft">{a.name}</Link>
                <div className="truncate text-xs text-muted-foreground">{a.position}</div>
              </div>
              {a.is_primary ? (
                <span className="rounded-full bg-crimson/15 px-2 py-0.5 text-[10px] font-medium text-crimson-soft">Primary</span>
              ) : canManage ? (
                <IconButton label="Remove" icon={X} size="icon-sm" onClick={() => remove(a.id)} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineCard({ ticket }) {
  const activities = ticket.activities ?? [];
  const LABELS = {
    created: 'created the ticket', accepted: 'accepted the ticket', resolved: 'marked as resolved',
    reopened: 'reopened the ticket', collaborator_added: 'added a collaborator',
    collaborator_removed: 'removed a collaborator', updated: 'updated the ticket',
    eta_set: 'set the expected fix date',
  };
  return (
    <div className="rounded-2xl glass p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white"><Activity className="h-4 w-4 text-crimson-soft" /> Activity timeline</h3>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="space-y-4">
          {activities.map((a, i) => (
            <div key={a.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn('h-2.5 w-2.5 rounded-full', i === 0 ? 'bg-crimson shadow-[0_0_8px_#e91e4f]' : 'bg-navy-500')} />
                {i < activities.length - 1 && <span className="mt-1 w-px flex-1 bg-navy-600" />}
              </div>
              <div className="-mt-1 pb-1">
                <p className="text-sm text-mist">
                  <span className="font-medium">{a.user?.name ?? 'System'}</span>{' '}
                  <span className="text-muted-foreground">{LABELS[a.action] ?? a.action}</span>
                  {a.action === 'eta_set' && a.meta?.expected_resolution_at && (
                    <span className="text-crimson-soft"> — {dateTime(a.meta.expected_resolution_at)}</span>
                  )}
                </p>
                <Tooltip label={dateTime(a.created_at)}>
                  <span className="text-[11px] text-muted-foreground">{fromNow(a.created_at)}</span>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
