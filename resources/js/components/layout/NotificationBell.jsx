import { useNavigate } from 'react-router-dom';
import { Bell, AtSign, UserPlus, MessageSquare, CheckCircle2, CheckCheck, CalendarClock, AlertTriangle, KanbanSquare, Target } from 'lucide-react';
import { useNotifications } from '@/context/NotificationsContext';
import { Button } from '@/components/ui/button';
import { fromNow } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';

const ICONS = {
  mention: AtSign, assignment: UserPlus, message: MessageSquare, status: CheckCircle2,
  billing_due: CalendarClock, billing_due_today: CalendarClock, billing_overdue: AlertTriangle,
  task_assigned: KanbanSquare, task_due: KanbanSquare, lead_assigned: Target, lead_follow_up: Target,
};

export function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const open = (n) => {
    if (!n.read_at) markRead(n.id);
    if (n.data?.link) navigate(n.data.link);
    else if (n.data?.ticket_id) navigate(`/app/tickets/${n.data.ticket_id}`);
    else if (n.data?.client_system_id) navigate(`/app/admin/client-systems?focus=${n.data.client_system_id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="text-mist/80" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(233,30,79,0.7)]">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm text-mist">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <Tooltip label="Mark all read">
              <button onClick={markAllRead} className="rounded-md p-1 text-muted-foreground hover:text-crimson-soft">
                <CheckCheck className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You're all caught up ✨</p>
          ) : (
            items.slice(0, 20).map((n) => {
              const Icon = ICONS[n.data?.type] ?? Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={cn(
                    'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-navy-700',
                    !n.read_at && 'bg-crimson/5'
                  )}
                >
                  <div className={cn('mt-0.5 rounded-lg p-1.5', !n.read_at ? 'bg-crimson/20 text-crimson-soft' : 'bg-navy-700 text-muted-foreground')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-mist leading-snug">{n.data?.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{fromNow(n.created_at)}</p>
                  </div>
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-crimson" />}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
