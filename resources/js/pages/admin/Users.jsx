import { useState } from 'react';
import { useQuery, useQueryClient, useMutation, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UserCog, Search, Power, ShieldCheck, UserPlus, Pencil, KeyRound, Copy, CheckCircle2, ChevronLeft, ChevronRight, Lock,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ROLE_COLORS } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton, EmptyState, IconButton, Spinner } from '@/components/ui/misc';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export function useRoleCatalog() {
  return useQuery({
    queryKey: ['role-catalog'],
    queryFn: async () => (await api.get('/admin/roles')).data,
    staleTime: Infinity,
  });
}

export function RoleBadge({ role, label }) {
  const color = ROLE_COLORS[role] ?? '#8A96B8';
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color, background: `${color}1f`, border: `1px solid ${color}40` }}>
      {role === 'admin' && <ShieldCheck className="h-3 w-3" />}{label}
    </span>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const { data: catalog } = useRoleCatalog();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('team');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);      // null | {} new | user
  const [resetting, setResetting] = useState(null);
  const [tempPw, setTempPw] = useState(null);      // {name, password}

  const params = { page, ...(search && { search }), ...(role !== 'all' && { role }), ...(status !== 'all' && { status }) };
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', params],
    queryFn: async () => (await api.get('/admin/users', { params })).data,
    placeholderData: keepPreviousData,
  });
  const users = data?.data ?? [];
  const counts = data?.counts ?? {};
  const meta = data?.meta;
  const roles = catalog?.roles ?? [];
  const teamTotal = roles.filter((r) => r.is_team).reduce((a, r) => a + (counts[r.value] ?? 0), 0);

  const update = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/admin/users/${id}`, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User updated.'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not update user.'),
  });

  const reset = useMutation({
    mutationFn: async (u) => (await api.post(`/admin/users/${u.id}/reset-password`)).data,
    onSuccess: (d, u) => setTempPw({ name: u.name, password: d.temporary_password }),
    onError: (e) => toast.error(e.response?.data?.message || 'Could not reset password.'),
  });

  const pick = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Users & Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create accounts for your team and clients, and control what each person can access.</p>
        </div>
        <Button onClick={() => setDialog({})}><UserPlus /> Add user</Button>
      </div>

      {/* Role chips double as filters */}
      <div className="flex flex-wrap gap-2">
        <Chip active={role === 'team'} onClick={() => pick(setRole)('team')} label="Team" count={teamTotal} />
        {roles.filter((r) => r.is_team).map((r) => (
          <Chip key={r.value} active={role === r.value} onClick={() => pick(setRole)(r.value)} label={r.label}
            count={counts[r.value] ?? 0} color={ROLE_COLORS[r.value]} />
        ))}
        <Chip active={role === 'customer'} onClick={() => pick(setRole)('customer')} label="Clients" count={counts.customer ?? 0} color={ROLE_COLORS.customer} />
        <Chip active={role === 'all'} onClick={() => pick(setRole)('all')} label="Everyone" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email, position or business…" value={search} onChange={(e) => pick(setSearch)(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={pick(setStatus)}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : users.length ? (
        <div className="overflow-hidden rounded-2xl glass">
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
              <thead>
                <tr className="border-b border-navy-600/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Position / Business</th>
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
                        <div className="flex items-center gap-1.5">
                          <RoleBadge role={u.role} label={u.role_label} />
                          {u.has_custom_permissions && <span title="Custom permissions" className="text-muted-foreground"><Lock className="h-3 w-3" /></span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {u.role === 'customer' ? (u.store_name || '—') : (u.position || '—')}
                        {u.role !== 'customer' && u.department && <div className="text-[11px]">{u.department}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${u.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-0.5">
                          <IconButton label="Edit" icon={Pencil} size="icon-sm" onClick={() => setDialog(u)} />
                          {!isSelf && (
                            <>
                              <IconButton label="Reset password" icon={KeyRound} size="icon-sm" onClick={() => setResetting(u)} />
                              <IconButton label={u.is_active ? 'Deactivate' : 'Activate'} icon={Power} size="icon-sm"
                                className={u.is_active ? 'hover:text-rose-400' : 'hover:text-emerald-400'}
                                onClick={() => update.mutate({ id: u.id, payload: { is_active: !u.is_active } })} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-navy-600/40 px-5 py-3 text-xs text-muted-foreground">
              <span>Page {meta.current_page} of {meta.last_page} · {meta.total} users</span>
              <div className="flex gap-1">
                <IconButton label="Previous" icon={ChevronLeft} size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} />
                <IconButton label="Next" icon={ChevronRight} size="icon-sm" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon={UserCog} title="No users found" />
      )}

      {dialog !== null && catalog && (
        <UserDialog user={dialog} catalog={catalog} isSelf={dialog.id === me.id} onClose={() => setDialog(null)}
          onCreated={(u, pw) => { setDialog(null); setTempPw({ name: u.name, password: pw, created: true }); }} />
      )}

      {resetting && (
        <AlertDialog open onOpenChange={(v) => !v && setResetting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset {resetting.name}’s password?</AlertDialogTitle>
              <AlertDialogDescription>A new temporary password is generated and they’re signed out of every device.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { reset.mutate(resetting); setResetting(null); }}>Reset password</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {tempPw && <TempPasswordDialog {...tempPw} onClose={() => setTempPw(null)} />}
    </div>
  );
}

function Chip({ active, onClick, label, count, color }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'border-crimson/50 bg-crimson/15 text-mist' : 'border-navy-600 text-muted-foreground hover:bg-navy-700 hover:text-mist')}>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
      {count != null && <span className="rounded-full bg-navy-700 px-1.5 text-[10px] text-mist/80">{count}</span>}
    </button>
  );
}

function UserDialog({ user, catalog, isSelf, onClose, onCreated }) {
  const isEdit = !!user.id;
  const queryClient = useQueryClient();
  const roleOf = (v) => catalog.roles.find((r) => r.value === v);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: user.name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'developer',
    position: user.position ?? '',
    department: user.department ?? '',
    phone: user.phone ?? '',
    store_name: user.store_name ?? '',
    business_type: user.business_type ?? '',
    contact_person: user.contact_person ?? '',
    address: user.address ?? '',
  });
  const [perms, setPerms] = useState(user.permissions ?? roleOf(user.role ?? 'developer')?.default_permissions ?? []);

  const role = roleOf(form.role);
  const isClient = form.role === 'customer';
  const isOwner = form.role === 'admin';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const err = (k) => errors[k]?.[0];

  const changeRole = (v) => {
    setForm({ ...form, role: v });
    setPerms(roleOf(v)?.default_permissions ?? []); // start from the new role's defaults
  };
  const togglePerm = (key) => setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  const isDefault = [...perms].sort().join() === [...(role?.default_permissions ?? [])].sort().join();

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (role?.is_team && !isOwner && !isSelf) payload.permissions = perms;
      if (isSelf) { delete payload.role; }
      return (await api[isEdit ? 'patch' : 'post'](isEdit ? `/admin/users/${user.id}` : '/admin/users', payload)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-team'] });
      if (isEdit) { toast.success('User updated.'); onClose(); } else onCreated(data.user.data ?? data.user, data.temporary_password);
    },
    onError: (e) => { setErrors(e.response?.data?.errors || {}); if (!e.response?.data?.errors) toast.error(e.response?.data?.message || 'Could not save.'); },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${user.name}` : 'Add a user'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update details, role and access.' : 'Pick a role — a temporary password is generated for them to sign in.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); mutation.mutate(); }} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Role" e={err('role')}>
              <Select value={form.role} onValueChange={changeRole} disabled={isSelf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {catalog.roles.filter((r) => r.is_team).map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLORS[r.value] }} />{r.label}</span>
                    </SelectItem>
                  ))}
                  <SelectItem value="customer">
                    <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLORS.customer }} />Client</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {isSelf && <p className="text-[11px] text-muted-foreground">You can’t change your own role.</p>}
            </F>
            <F label="Full name" e={err('name')}><Input value={form.name} onChange={set('name')} required /></F>
            <F label="Email" e={err('email')}><Input type="email" value={form.email} onChange={set('email')} required /></F>
            <F label="Phone" e={err('phone')}><Input value={form.phone} onChange={set('phone')} /></F>
            {isClient ? (
              <>
                <F label="Store / business name" e={err('store_name')}><Input value={form.store_name} onChange={set('store_name')} /></F>
                <F label="Business type" e={err('business_type')}><Input value={form.business_type} onChange={set('business_type')} placeholder="e.g. Laundry Shop" /></F>
                <F label="Contact person" e={err('contact_person')}><Input value={form.contact_person} onChange={set('contact_person')} /></F>
                <F label="Address / branch" e={err('address')}><Input value={form.address} onChange={set('address')} /></F>
              </>
            ) : (
              <>
                <F label="Position / title" e={err('position')}><Input value={form.position} onChange={set('position')} placeholder={role?.label} /></F>
                <F label="Department" e={err('department')}><Input value={form.department} onChange={set('department')} placeholder="e.g. Development" /></F>
              </>
            )}
          </div>

          {role?.is_team && (
            <div className="space-y-3 rounded-xl border border-navy-600/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Access</div>
                {!isOwner && !isSelf && !isDefault && (
                  <button type="button" className="text-xs text-crimson-soft hover:underline" onClick={() => setPerms(role.default_permissions)}>
                    Reset to {role.label} defaults
                  </button>
                )}
              </div>
              {isOwner ? (
                <p className="flex items-center gap-2 text-sm text-mist"><ShieldCheck className="h-4 w-4 text-crimson-soft" /> Owner / Admin has full access to everything.</p>
              ) : isSelf ? (
                <p className="text-sm text-muted-foreground">You can’t change your own access.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Every team member gets Dashboard, Tasks and Notifications. Tick what else this person can do.</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {catalog.permissions.map((p) => (
                      <label key={p.key} className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors',
                        perms.includes(p.key) ? 'border-crimson/40 bg-crimson/5' : 'border-navy-600 hover:bg-navy-700/40')}>
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#E91E4F]" checked={perms.includes(p.key)} onChange={() => togglePerm(p.key)} />
                        <span>
                          <span className="block text-sm font-medium text-mist">{p.label}</span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">{p.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : <><UserPlus /> Create account</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TempPasswordDialog({ name, password, created, onClose }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md text-center">
        <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-7 w-7" /></div>
        <DialogTitle>{created ? `${name}’s account is ready` : `New password for ${name}`}</DialogTitle>
        <DialogDescription>Share this temporary password securely. It won’t be shown again.</DialogDescription>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-navy-600 bg-navy-800/60 p-4">
          <code className="font-mono text-lg text-crimson-soft">{password}</code>
          <Button size="icon" variant="secondary" onClick={() => { navigator.clipboard.writeText(password); toast.success('Copied'); }} aria-label="Copy"><Copy /></Button>
        </div>
        <DialogFooter className="mt-4 sm:justify-center"><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, e, children }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{e && <p className="text-xs text-crimson-soft">{e}</p>}</div>;
}
