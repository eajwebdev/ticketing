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

// ---- Billing ----
const pesoFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
const pesoCompact = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 });

export function peso(n) {
  return pesoFmt.format(Number(n) || 0);
}

export function pesoShort(n) {
  return pesoCompact.format(Number(n) || 0);
}

export const CYCLE_LABELS = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Every 6 months',
  yearly: 'Yearly',
};

export const CYCLE_SUFFIX = { monthly: '/mo', quarterly: '/qtr', semiannual: '/6 mo', yearly: '/yr' };

export const METHOD_LABELS = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank transfer',
  check: 'Check',
  other: 'Other',
};

// Today as YYYY-MM-DD in the viewer's local time (not UTC).
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Parse a plain YYYY-MM-DD as a local date (new Date('2026-01-31') would be UTC midnight).
export function localDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dueLabel(days) {
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

export const DUE_META = {
  overdue: { label: 'Overdue', color: '#E91E4F', bg: 'rgba(233,30,79,0.15)' },
  due_today: { label: 'Due today', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  due_soon: { label: 'Due soon', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  upcoming: { label: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  paused: { label: 'Paused', color: '#8A96B8', bg: 'rgba(138,150,184,0.15)' },
  cancelled: { label: 'Cancelled', color: '#64748B', bg: 'rgba(100,116,139,0.15)' },
};
