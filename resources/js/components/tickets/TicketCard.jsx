import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, MessageSquare, Zap, Layers } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { STATUS_META, fromNow, humanizeMinutes } from '@/lib/format';

export function UrgencyDot({ urgency }) {
  if (!urgency) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: urgency.color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: urgency.color, boxShadow: `0 0 8px ${urgency.color}` }} />
      {urgency.name}
    </span>
  );
}

export function TicketCard({ ticket, index = 0, showCustomer = true }) {
  const meta = STATUS_META[ticket.status] ?? STATUS_META.open;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        to={`/app/tickets/${ticket.id}`}
        className="hover-lift group block rounded-2xl glass p-5 transition-colors hover:border-crimson/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono text-crimson-soft">{ticket.ticket_number}</span>
              {ticket.system_type && (
                <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />{ticket.system_type.name}</span>
              )}
            </div>
            <h3 className="mt-1.5 truncate font-semibold text-mist group-hover:text-white">{ticket.subject}</h3>
          </div>
          <StatusBadge meta={meta} />
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <UrgencyDot urgency={ticket.urgency} />
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fromNow(ticket.created_at)}</span>
          {ticket.messages_count != null && (
            <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ticket.messages_count}</span>
          )}
          {ticket.response_time_minutes != null && (
            <span className="inline-flex items-center gap-1 text-emerald-400/80"><Zap className="h-3 w-3" />{humanizeMinutes(ticket.response_time_minutes)} response</span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          {showCustomer && ticket.customer ? (
            <div className="flex items-center gap-2">
              <UserAvatar user={ticket.customer} className="h-6 w-6" />
              <span className="text-xs text-mist/80">{ticket.customer.store_name || ticket.customer.name}</span>
            </div>
          ) : <span />}
          {ticket.assignees?.length > 0 && (
            <div className="flex -space-x-2">
              {ticket.assignees.slice(0, 3).map((a) => (
                <UserAvatar key={a.id} user={a} className="h-6 w-6 ring-2 ring-navy-800" />
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
