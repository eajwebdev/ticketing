import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserCog, Search, Power, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton, EmptyState, IconButton } from '@/components/ui/misc';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

const ROLE_FILTERS = [
  { value: 'all', label: 'All roles' },
  { value: 'customer', label: 'Customers' },
  { value: 'agent', label: 'Agents' },
  { value: 'admin', label: 'Admins' },
];

export default function AdminUsers() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, role],
    queryFn: async () => (await api.get('/admin/users', {
      params: { ...(search && { search }), ...(role !== 'all' && { role }) },
    })).data,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/admin/users/${id}`, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User updated.'); },
    onError: () => toast.error('Could not update user.'),
  });

  const users = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users & Roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage roles and account status across all users.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{ROLE_FILTERS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : users.length ? (
        <div className="overflow-hidden rounded-2xl glass">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === me.id;
                  return (
                    <tr key={u.id} className="border-b border-navy-600/30 last:border-0 hover:bg-navy-700/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={u} className="h-9 w-9" />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-mist">{u.name}{isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Select value={u.role} disabled={isSelf} onValueChange={(v) => update.mutate({ id: u.id, payload: { role: v } })}>
                          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${u.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          {!isSelf && (
                            <IconButton
                              label={u.is_active ? 'Deactivate' : 'Activate'}
                              icon={Power}
                              size="icon-sm"
                              className={u.is_active ? 'hover:text-rose-400' : 'hover:text-emerald-400'}
                              onClick={() => update.mutate({ id: u.id, payload: { is_active: !u.is_active } })}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState icon={UserCog} title="No users found" />
      )}
    </div>
  );
}
