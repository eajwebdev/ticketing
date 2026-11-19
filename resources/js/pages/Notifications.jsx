import { useNavigate } from 'react-router-dom';
import { Bell, AtSign, UserPlus, MessageSquare, CheckCircle2, CheckCheck, CalendarClock, AlertTriangle, KanbanSquare, Target } from 'lucide-react';
import { useNotifications } from '@/context/NotificationsContext';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { fromNow } from '@/lib/format';
import { cn } from '@/lib/utils';

const ICONS = {
  mention: AtSign, assignment: UserPlus, message: MessageSquare, status: CheckCircle2,
  billing_due: CalendarClock, billing_due_today: CalendarClock, billing_overdue: AlertTriangle,
  subscription_expiring: CalendarClock, subscription_expires_today: CalendarClock, subscription_expired: AlertTriangle,
  task_assigned: KanbanSquare, task_due: KanbanSquare, lead_assigned: Target, lead_follow_up: Target,
};

export default function NotificationsPage() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const open = (n) => {
    if (!n.read_at) markRead(n.id);
    if (n.data?.link) navigate(n.data.link);
    else if (n.data?.ticket_id) navigate(`/app/tickets/${n.data.ticket_id}`);
    else if (n.data?.client_system_id) navigate(`/app/admin/client-systems?focus=${n.data.client_system_id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unread} unread</p>
        </div>
        {unread > 0 && <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck /> Mark all read</Button>}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="Mentions, assignments and updates will appear here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.data?.type] ?? Bell;
            return (
              <button key={n.id} onClick={() => open(n)}
                className={cn('flex w-full items-start gap-4 rounded-2xl glass p-4 text-left transition-colors hover:border-crimson/40',
                  !n.read_at && 'border-crimson/30')}>
                <div className={cn('rounded-xl p-2.5', !n.read_at ? 'bg-crimson/20 text-crimson-soft' : 'bg-navy-700 text-muted-foreground')}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-mist">{n.data?.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.data?.ticket_number && <span className="font-mono text-crimson-soft/80">{n.data.ticket_number}</span>} · {fromNow(n.created_at)}
                  </p>
                </div>
                {!n.read_at && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-crimson" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
