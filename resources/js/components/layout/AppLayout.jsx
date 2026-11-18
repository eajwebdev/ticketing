import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Ticket, Bell, BarChart3, Users, Building2,
  SlidersHorizontal, UserCog, LogOut, Menu, X, ChevronDown, MonitorCog, ServerCog, Wallet,
  KanbanSquare, Target, Sun, Moon,
} from 'lucide-react';
import { can, isTeamUser, P } from '@/lib/permissions';
import { useTheme, useApplyTheme } from '@/context/ThemeContext';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Logo } from '@/components/brand/Logo';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { CreateTicketProvider } from '@/components/tickets/CreateTicketDialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

function navItems(user) {
  if (!isTeamUser(user)) {
    return [
      { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/app/tickets', icon: Ticket, label: 'My Tickets' },
      { to: '/app/notifications', icon: Bell, label: 'Notifications' },
    ];
  }
  const items = [
    { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/app/tasks', icon: KanbanSquare, label: 'Tasks' },
    { to: '/app/tickets', icon: Ticket, label: can(user, P.TICKETS) ? 'Tickets' : 'My Tickets' },
    { to: '/app/notifications', icon: Bell, label: 'Notifications' },

    { section: 'Clients & Sales' },
    can(user, P.LEADS) && { to: '/app/leads', icon: Target, label: 'Leads' },
    can(user, P.CLIENTS) && { to: '/app/admin/clients', icon: Building2, label: 'Clients' },
    can(user, P.SYSTEMS_VIEW, P.CREDENTIALS, P.BILLING) && { to: '/app/admin/client-systems', icon: ServerCog, label: 'Client Systems' },
    can(user, P.BILLING) && { to: '/app/admin/sales', icon: Wallet, label: 'Sales' },

    { section: 'Insights' },
    can(user, P.ANALYTICS) && { to: '/app/admin/analytics', icon: BarChart3, label: 'Analytics' },

    { section: 'Settings' },
    can(user, P.SETTINGS) && { to: '/app/admin/users', icon: UserCog, label: 'Users & Roles' },
    can(user, P.SETTINGS) && { to: '/app/admin/team', icon: Users, label: 'Team Profiles' },
    can(user, P.SETTINGS) && { to: '/app/admin/systems', icon: MonitorCog, label: 'Systems' },
    can(user, P.SETTINGS) && { to: '/app/admin/lookups', icon: SlidersHorizontal, label: 'Categories & Urgency' },
  ].filter(Boolean);
  // Drop section headers that ended up with nothing under them.
  return items.filter((it, i) => !it.section || (items[i + 1] && !items[i + 1].section));
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const light = theme === 'light';
  return (
    <Tooltip label={light ? 'Dark mode' : 'Light mode'}>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}>
        {light ? <Moon className="text-mist/80" /> : <Sun className="text-mist/80" />}
      </Button>
    </Tooltip>
  );
}

function SidebarContent({ onNavigate }) {
  const { user } = useAuth();
  const items = navItems(user);
  return (
    <div className="flex h-full flex-col gap-1 p-4">
      <Link to="/app" onClick={onNavigate}
        className="-mx-1 mb-3 flex items-center border-b border-navy-600/60 px-2 pb-4 pt-1 transition-opacity hover:opacity-90">
        <Logo size="sidebar" />
      </Link>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item, i) =>
          item.section ? (
            <div key={i} className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {item.section}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-crimson/15 text-white border border-crimson/30 shadow-[0_0_18px_rgba(233,30,79,0.15)]'
                    : 'text-mist/70 hover:bg-navy-700 hover:text-white border border-transparent'
                )
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {item.label}
            </NavLink>
          )
        )}
      </nav>
      <div className="rounded-xl glass p-3 text-xs text-muted-foreground">
        <p className="font-medium text-mist">Real people. Real support.</p>
        <p className="mt-1">Every ticket is tracked end-to-end.</p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const roleLabel = user?.role_label ?? '';
  useApplyTheme();

  return (
    <CreateTicketProvider>
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-navy-600/60 lg:block">
        <div className="sticky top-0 h-screen glass">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-navy-900/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 glass-strong lg:hidden"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-navy-600/60 glass px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <div className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-navy-700">
                <UserAvatar user={user} className="h-8 w-8" />
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-medium text-mist leading-tight">{user?.name}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{roleLabel}</div>
                </div>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/app/profile')}>
                <UserCog /> My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-crimson-soft focus:text-crimson-soft">
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
    </CreateTicketProvider>
  );
}
