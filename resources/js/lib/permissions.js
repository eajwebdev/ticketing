// Mirrors app/Support/Permissions.php. The server is the real gate; this only hides UI.
export const P = {
  TICKETS: 'tickets.handle',
  CLIENTS: 'clients.manage',
  SYSTEMS_VIEW: 'systems.view',
  CREDENTIALS: 'credentials.view',
  BILLING: 'billing.manage',
  ANALYTICS: 'analytics.view',
  TASKS_MANAGE: 'tasks.manage',
  LEADS: 'leads.manage',
  SUBSCRIPTIONS: 'subscriptions.manage',
  SETTINGS: 'settings.manage',
};

/** True if the user has ANY of the given permissions. */
export function can(user, ...perms) {
  const mine = user?.permissions ?? [];
  return perms.some((p) => mine.includes(p));
}

export const isTeamUser = (user) => !!user && user.role !== 'customer';

export const ROLE_COLORS = {
  admin: '#E91E4F',
  manager: '#8B5CF6',
  developer: '#3B82F6',
  designer: '#EC4899',
  qa: '#14B8A6',
  support: '#F59E0B',
  marketing: '#22C55E',
  finance: '#0EA5E9',
  customer: '#8A96B8',
};
