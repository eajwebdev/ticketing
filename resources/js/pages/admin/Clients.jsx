import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, UserPlus, Copy, CheckCircle2, Store, Check, X, Clock3, Pencil, ServerCog } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { can, P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { BUSINESS_TYPE_SUGGESTIONS } from '@/lib/businessTypes';
import { UserAvatar } from '@/components/ui/avatar';
import { IconButton, Skeleton, EmptyState, Spinner } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const APPROVAL_META = {
  pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-400' },
  approved: { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-400' },
  rejected: { label: 'Rejected', cls: 'bg-rose-500/15 text-rose-400' },
};

export default function AdminClients() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSystems = can(user, P.BILLING) || can(user, P.SYSTEMS_VIEW);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dialog, setDialog] = useState(null); // null closed, {} add, {...client} edit

  const params = { ...(search && { search }), ...(status !== 'all' && { status }) };
  const { data, isLoading } = useQuery({
    queryKey: ['admin-clients', search, status],
    queryFn: async () => (await api.get('/admin/clients', { params })).data,
  });
  const clients = data?.data ?? [];

  const { data: pendingData } = useQuery({
    queryKey: ['admin-clients-pending-count'],
    queryFn: async () => (await api.get('/admin/clients', { params: { status: 'pending' } })).data,
  });
  const pendingCount = pendingData?.meta?.total ?? 0;

  const decide = useMutation({
    mutationFn: ({ id, action }) => api.post(`/admin/clients/${id}/${action}`),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-clients-pending-count'] });
      toast.success(action === 'approve' ? 'Client approved — they can now sign in.' : 'Client rejected.');
    },
    onError: () => toast.error('Action failed.'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Approve new sign-ups and manage client accounts.</p>
        </div>
        <Button onClick={() => setDialog({})}><UserPlus /> Add Client</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-400">{pendingCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : clients.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const meta = APPROVAL_META[c.approval_status] ?? APPROVAL_META.approved;
            return (
              <div key={c.id} className="rounded-2xl glass p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar user={c} className="h-11 w-11" />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-semibold text-mist">{c.store_name || c.name}</span>
                        {c.business_names?.length > 1 && (
                          <span className="shrink-0 rounded-full bg-crimson/15 px-1.5 py-0.5 text-[10px] font-medium text-crimson-soft"
                            title={c.business_names.slice(1).join(', ')}>+{c.business_names.length - 1} more</span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{c.name}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                    {canSystems && c.approval_status === 'approved' && (
                      <IconButton label="Systems & billing" icon={ServerCog} size="icon-sm"
                        onClick={() => navigate(`/app/admin/client-systems?client=${c.id}`)} />
                    )}
                    <IconButton label="Edit details" icon={Pencil} size="icon-sm" onClick={() => setDialog(c)} />
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="truncate">✉ {c.email}</div>
                  {c.phone && <div>☎ {c.phone}</div>}
                  {c.business_names?.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <Building2 className="h-3 w-3" />
                      {c.business_names.map((n) => (
                        <span key={n} className="rounded-md border border-navy-600 px-1.5 py-0.5 text-[10px] font-medium text-mist">{n}</span>
                      ))}
                    </div>
                  )}
                  {c.business_types?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <Store className="h-3 w-3" />
                      {c.business_types.map((t) => (
                        <span key={t} className="rounded-md bg-navy-700/70 px-1.5 py-0.5 text-[10px] font-medium text-mist">{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {c.approval_status === 'pending' && (
                  <div className="mt-4 flex items-center gap-2 border-t border-navy-600/60 pt-3">
                    <Button size="sm" className="flex-1" onClick={() => decide.mutate({ id: c.id, action: 'approve' })} disabled={decide.isPending}>
                      <Check /> Approve
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="flex-1 hover:text-rose-400"><X /> Reject</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reject {c.store_name || c.name}?</AlertDialogTitle>
                          <AlertDialogDescription>They won't be able to sign in. You can approve them later from the Rejected tab.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => decide.mutate({ id: c.id, action: 'reject' })}>Reject</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
                {c.approval_status === 'rejected' && (
                  <div className="mt-4 border-t border-navy-600/60 pt-3">
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => decide.mutate({ id: c.id, action: 'approve' })} disabled={decide.isPending}>
                      <Check /> Approve now
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={status === 'pending' ? Clock3 : Building2}
          title={status === 'pending' ? 'No pending approvals' : 'No clients found'}
          description={status === 'pending' ? 'New self-registered clients will appear here for approval.' : undefined}
        />
      )}

      {dialog !== null && (
        <ClientDialog client={dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function ClientDialog({ client, onClose }) {
  const isEdit = !!client.id;
  const queryClient = useQueryClient();
  const [tempPassword, setTempPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: client.name ?? '',
    business_names: client.business_names?.length ? client.business_names : (client.store_name ? [client.store_name] : []),
    email: client.email ?? '',
    business_types: client.business_types ?? [],
    contact_person: client.contact_person ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
    notes: client.notes ?? '',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const err = (k) => errors[k]?.[0];
  const typeErr = Object.keys(errors).find((k) => k.startsWith('business_types.')) && 'Each business type must be under 100 characters.';
  const nameErr = err('business_names') || err('store_name')
    || (Object.keys(errors).find((k) => k.startsWith('business_names.')) && 'Each business name must be unique and under 255 characters.');

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `/admin/clients/${client.id}` : '/admin/clients';
      return (await api[isEdit ? 'patch' : 'post'](url, form)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      if (isEdit) {
        toast.success('Client updated.');
        onClose();
      } else {
        setTempPassword(data.temporary_password);
        toast.success('Client account created.');
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
            <DialogTitle>Client created 🎉</DialogTitle>
            <DialogDescription className="mt-1">Share this temporary password securely — they'll use it to sign in.</DialogDescription>
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-navy-600 bg-navy-800/60 p-4">
              <code className="font-mono text-lg text-crimson-soft">{tempPassword}</code>
              <Button size="icon" variant="secondary" onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Copied'); }} aria-label="Copy"><Copy /></Button>
            </div>
            <DialogFooter className="mt-6"><Button onClick={onClose}>Done</Button></DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isEdit ? `Edit ${client.store_name || client.name}` : 'Add a new client'}</DialogTitle>
              <DialogDescription>
                {isEdit ? 'Update this client’s business profile and contact details.' : 'Create a rich client profile. A temporary password will be generated.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!form.business_names.length) {
                setErrors({ business_names: ['Add at least one store / business name.'] });
                return;
              }
              setErrors({});
              mutation.mutate();
            }} className="space-y-4">
              <F label="Store / business names" e={nameErr}>
                <TagInput value={form.business_names} onChange={(v) => setForm({ ...form, business_names: v })} splitOnComma={false}
                  placeholder="e.g. Juan Laundry — press Enter to add another" />
                <p className="text-[11px] text-muted-foreground">A client can own several businesses. The first one is the main name shown across the app.</p>
              </F>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <F label="Contact name" e={err('name')}><Input value={form.name} onChange={set('name')} required /></F>
                <F label="Contact person" e={err('contact_person')}><Input value={form.contact_person} onChange={set('contact_person')} /></F>
                <F label="Email" e={err('email')}><Input type="email" value={form.email} onChange={set('email')} required /></F>
                <F label="Phone" e={err('phone')}><Input value={form.phone} onChange={set('phone')} /></F>
                <div className="sm:col-span-2"><F label="Address / branch" e={err('address')}><Input value={form.address} onChange={set('address')} /></F></div>
              </div>
              <F label="Business types" e={err('business_types') || typeErr}>
                <TagInput value={form.business_types} onChange={(v) => setForm({ ...form, business_types: v })}
                  placeholder="e.g. Laundry Shop — press Enter to add" suggestions={BUSINESS_TYPE_SUGGESTIONS} />
              </F>
              <F label="Notes" e={err('notes')}><Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Account notes, plan, special requirements…" /></F>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : <><UserPlus /> Create client</>}</Button>
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
