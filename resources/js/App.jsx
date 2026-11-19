import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { FullPageLoader } from '@/components/ui/misc';
import { AppLayout } from '@/components/layout/AppLayout';

import Landing from '@/pages/Landing';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import PublicProfile from '@/pages/PublicProfile';

import Dashboard from '@/pages/Dashboard';
import TicketsList from '@/pages/tickets/TicketsList';
import { OpenCreateTicketRoute } from '@/components/tickets/CreateTicketDialog';
import TicketDetail from '@/pages/tickets/TicketDetail';
import NotificationsPage from '@/pages/Notifications';
import ProfilePage from '@/pages/Profile';

import AdminClients from '@/pages/admin/Clients';
import AdminSystems from '@/pages/admin/Systems';
import AdminTeam from '@/pages/admin/Team';
import AdminLookups from '@/pages/admin/Lookups';
import AdminUsers from '@/pages/admin/Users';
import Analytics from '@/pages/admin/Analytics';
import ClientSystems from '@/pages/admin/ClientSystems';
import Sales from '@/pages/admin/Sales';
import Subscriptions from '@/pages/admin/Subscriptions';

import Tasks from '@/pages/Tasks';
import Leads from '@/pages/Leads';
import { can, P } from '@/lib/permissions';

// Page only for users holding one of these permissions.
function Perm({ any, children }) {
  const { user } = useAuth();
  if (!can(user, ...any)) return <Navigate to="/app" replace />;
  return children;
}

// Any team member (not clients).
function TeamOnly({ children }) {
  const { user } = useAuth();
  if (!user || user.role === 'customer') return <Navigate to="/app" replace />;
  return children;
}

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={user && !loading ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/register" element={user && !loading ? <Navigate to="/app" replace /> : <Register />} />
      <Route path="/team/:id" element={<PublicProfile />} />

      {/* Authenticated app */}
      <Route
        path="/app"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tickets" element={<TicketsList />} />
        <Route path="tickets/new" element={<OpenCreateTicketRoute />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />

        <Route path="tasks" element={<TeamOnly><Tasks /></TeamOnly>} />
        <Route path="leads" element={<Perm any={[P.LEADS]}><Leads /></Perm>} />

        {/* Management */}
        <Route path="admin/analytics" element={<Perm any={[P.ANALYTICS]}><Analytics /></Perm>} />
        <Route path="admin/clients" element={<Perm any={[P.CLIENTS]}><AdminClients /></Perm>} />
        <Route path="admin/client-systems" element={<Perm any={[P.SYSTEMS_VIEW, P.CREDENTIALS, P.BILLING]}><ClientSystems /></Perm>} />
        <Route path="admin/sales" element={<Perm any={[P.BILLING]}><Sales /></Perm>} />
        <Route path="admin/subscriptions" element={<Perm any={[P.SUBSCRIPTIONS]}><Subscriptions /></Perm>} />
        <Route path="admin/systems" element={<Perm any={[P.SETTINGS]}><AdminSystems /></Perm>} />
        <Route path="admin/team" element={<Perm any={[P.SETTINGS]}><AdminTeam /></Perm>} />
        <Route path="admin/lookups" element={<Perm any={[P.SETTINGS]}><AdminLookups /></Perm>} />
        <Route path="admin/users" element={<Perm any={[P.SETTINGS]}><AdminUsers /></Perm>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
