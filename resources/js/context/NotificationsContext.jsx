import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getEcho } from '@/lib/echo';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications');
      setItems(data.notifications);
      setUnread(data.unread_count);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time notifications on the user's private channel
  useEffect(() => {
    if (!user) return;
    let channel;
    try {
      const echo = getEcho();
      channel = echo.private(`App.Models.User.${user.id}`);
      channel.notification((notification) => {
        setItems((prev) => [
          { id: notification.id ?? crypto.randomUUID(), read_at: null, created_at: new Date().toISOString(), data: notification },
          ...prev,
        ]);
        setUnread((u) => u + 1);
        toast(notification.message ?? 'New notification', {
          description: notification.ticket_number,
        });
      });
    } catch (e) {
      console.warn('Realtime notifications unavailable', e);
    }
    return () => {
      if (channel) channel.stopListening('.notification');
    };
  }, [user]);

  const markRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.post(`/notifications/${id}/read`);
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await api.post('/notifications/read-all');
    } catch {
      /* ignore */
    }
  };

  return (
    <NotificationsContext.Provider value={{ items, unread, markRead, markAllRead, reload: load }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext) ?? { items: [], unread: 0, markRead: () => {}, markAllRead: () => {}, reload: () => {} };
}
