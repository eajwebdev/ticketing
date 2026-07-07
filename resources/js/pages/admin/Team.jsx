import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Search, UserPlus, Copy, CheckCircle2, ShieldCheck, Pencil, Eye, Power } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { IconButton, Skeleton, EmptyState, Spinner } from '@/components/ui/misc';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export default function AdminTeam() {
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null); // null closed, {} add, {...member} edit
  const { data, isLoading } = useQuery({
    queryKey: ['admin-team', search],
    queryFn: async () => (await api.get('/admin/team', { params: search ? { search } : {} })).data,
  });
  const members = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add and edit agents and admins.</p>
        </div>
        <Button onClick={() => setDialog({})}><UserPlus /> Add Team Member</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search team…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : members.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <div key={m.id} className="rounded-2xl glass p-5">
              <div className="flex items-start justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar user={m} className="h-12 w-12" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-mist">{m.name}</div>
                    <div className="truncate text-xs text-crimson-soft">{m.position || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link to={`/team/${m.id}`}><IconButton label="View public profile" icon={Eye} size="icon-sm" /></Link>
                  <IconButton label="Edit details" icon={Pencil} size="icon-sm" onClick={() => setDialog(m)} />
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                <div className="truncate">✉ {m.email}</div>
                {m.phone && <div>☎ {m.phone}</div>}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{m.department || '—'}</span>
                <Badge className={m.role === 'admin' ? 'text-crimson-soft border-crimson/40' : 'text-mist/70'}>
                  {m.role === 'admin' && <ShieldCheck className="h-3 w-3" />}{m.role}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="No team members found" />
      )}

      {dialog !== null && (
        <TeamDialog member={dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function TeamDialog({ member, onClose }) {
  const isEdit = !!member.id;
  const queryClient = useQueryClient();
  const [tempPassword, setTempPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: member.name ?? '',
    email: member.email ?? '',
    role: member.role ?? 'agent',
    position: member.position ?? '',
    department: member.department ?? '',
    phone: member.phone ?? '',
    bio: member.bio ?? '',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const err = (k) => errors[k]?.[0];

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `/admin/team/${member.id}` : '/admin/team';
      return (await api[isEdit ? 'patch' : 'post'](url, form)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-team'] });
      if (isEdit) {
        toast.success('Team member updated.');
        onClose();
      } else {
        setTempPassword(data.temporary_password);
        toast.success('Team member created.');
      }
    },
    onError: (e) => setErrors(e.response?.data?.errors || {}),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        {tempPassword ? (
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-7 w-7" /></div>
            <DialogTitle>Team member created 🎉</DialogTitle>
            <DialogDescription className="mt-1">Share this temporary password securely.</DialogDescription>
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-navy-600 bg-navy-800/60 p-4">
              <code className="font-mono text-lg text-crimson-soft">{tempPassword}</code>
              <Button size="icon" variant="secondary" onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Copied'); }} aria-label="Copy"><Copy /></Button>
            </div>
            <DialogFooter className="mt-6"><Button onClick={onClose}>Done</Button></DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isEdit ? `Edit ${member.name}` : 'Add a team member'}</DialogTitle>
              <DialogDescription>
                {isEdit ? 'Update this member’s details. Changes appear on their public profile.' : 'Create an agent or admin. A temporary password will be generated.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); setErrors({}); mutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <F label="Full name" e={err('name')}><Input value={form.name} onChange={set('name')} required /></F>
                <F label="Email" e={err('email')}><Input type="email" value={form.email} onChange={set('email')} required /></F>
                <F label="Role" e={err('role')}>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </F>
                <F label="Phone" e={err('phone')}><Input value={form.phone} onChange={set('phone')} /></F>
                <F label="Position / title" e={err('position')}><Input value={form.position} onChange={set('position')} /></F>
                <F label="Department" e={err('department')}><Input value={form.department} onChange={set('department')} /></F>
              </div>
              <F label="Bio" e={err('bio')}><Textarea rows={3} value={form.bio} onChange={set('bio')} /></F>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : <><UserPlus /> Create member</>}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function F({ label, e, children }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{e && <p className="text-xs text-crimson-soft">{e}</p>}</div>;
}
