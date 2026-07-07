import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Search, UserPlus, Copy, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton, EmptyState, Spinner } from '@/components/ui/misc';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export default function AdminTeam() {
  const [search, setSearch] = useState('');
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
          <p className="mt-1 text-sm text-muted-foreground">Manage agents and admins.</p>
        </div>
        <AddTeamDialog />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search team…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : members.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Link key={m.id} to={`/team/${m.id}`} className="hover-lift rounded-2xl glass p-5 hover:border-crimson/40">
              <div className="flex items-center gap-3">
                <UserAvatar user={m} className="h-12 w-12" />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-mist">{m.name}</div>
                  <div className="truncate text-xs text-crimson-soft">{m.position}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>{m.department}</span>
                <Badge className={m.role === 'admin' ? 'text-crimson-soft border-crimson/40' : 'text-mist/70'}>
                  {m.role === 'admin' && <ShieldCheck className="h-3 w-3" />}{m.role}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="No team members found" />
      )}
    </div>
  );
}

function AddTeamDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ name: '', email: '', role: 'agent', position: '', department: '', phone: '', bio: '' });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const err = (k) => errors[k]?.[0];

  const mutation = useMutation({
    mutationFn: async () => (await api.post('/admin/team', form)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-team'] });
      setTempPassword(data.temporary_password);
      toast.success('Team member created.');
    },
    onError: (e) => setErrors(e.response?.data?.errors || {}),
  });

  const reset = () => { setForm({ name: '', email: '', role: 'agent', position: '', department: '', phone: '', bio: '' }); setTempPassword(''); setErrors({}); };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild><Button><UserPlus /> Add Team Member</Button></DialogTrigger>
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
            <DialogFooter className="mt-6"><Button onClick={() => { setOpen(false); reset(); }}>Done</Button></DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a team member</DialogTitle>
              <DialogDescription>Create an agent or admin. A temporary password will be generated.</DialogDescription>
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
                <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <Spinner className="h-4 w-4" /> : <><UserPlus /> Create member</>}</Button>
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
