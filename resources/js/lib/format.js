import { formatDistanceToNow, format } from 'date-fns';

export function fromNow(date) {
  if (!date) return '';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '';
  }
}

export function dateTime(date) {
  if (!date) return '';
  try {
    return format(new Date(date), 'MMM d, yyyy · h:mm a');
  } catch {
    return '';
  }
}

export function shortDate(date) {
  if (!date) return '';
  try {
    return format(new Date(date), 'MMM d, yyyy');
  } catch {
    return '';
  }
}

// minutes -> "2h 15m" / "45m" / "3d 4h"
export function humanizeMinutes(mins) {
  if (mins == null) return '—';
  mins = Math.round(mins);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const STATUS_META = {
  open: { label: 'Open', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  accepted: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  resolved: { label: 'Resolved', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  closed: { label: 'Closed', color: '#8A96B8', bg: 'rgba(138,150,184,0.15)' },
  reopened: { label: 'Reopened', color: '#E91E4F', bg: 'rgba(233,30,79,0.15)' },
};
