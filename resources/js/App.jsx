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
import CreateTicket from '@/pages/tickets/CreateTicket';
import TicketDetail from '@/pages/tickets/TicketDetail';
import NotificationsPage from '@/pages/Notifications';
import ProfilePage from '@/pages/Profile';

import AdminClients from '@/pages/admin/Clients';
import AdminSystems from '@/pages/admin/Systems';
import AdminTeam from '@/pages/admin/Team';
import AdminLookups from '@/pages/admin/Lookups';
import AdminUsers from '@/pages/admin/Users';
import Analytics from '@/pages/admin/Analytics';

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
        <Route path="tickets/new" element={<CreateTicket />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* Admin */}
        <Route path="admin/analytics" element={<Protected roles={['admin']}><Analytics /></Protected>} />
        <Route path="admin/clients" element={<Protected roles={['admin']}><AdminClients /></Protected>} />
        <Route path="admin/systems" element={<Protected roles={['admin']}><AdminSystems /></Protected>} />
        <Route path="admin/team" element={<Protected roles={['admin']}><AdminTeam /></Protected>} />
        <Route path="admin/lookups" element={<Protected roles={['admin']}><AdminLookups /></Protected>} />
        <Route path="admin/users" element={<Protected roles={['admin']}><AdminUsers /></Protected>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
