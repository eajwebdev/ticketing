import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, MonitorCog, Power } from 'lucide-react';
import api from '@/lib/api';
import { SYSTEM_ICONS, systemIcon } from '@/lib/systemIcons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { IconButton, Skeleton, EmptyState, Spinner } from '@/components/ui/misc';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export default function AdminSystems() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);   // null = closed, {} = new, {...item} = edit
  const { data, isLoading } = useQuery({
    queryKey: ['lookup', 'system-types'],
    queryFn: async () => (await api.get('/admin/lookups/system-types')).data.data,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lookup', 'system-types'] });
    queryClient.invalidateQueries({ queryKey: ['lookups'] });
  };

  const toggle = useMutation({
    mutationFn: (item) => api.patch(`/admin/lookups/system-types/${item.id}`, { ...item, is_active: !item.is_active }),
    onSuccess: () => { invalidate(); toast.success('Updated.'); },
    onError: () => toast.error('Could not update.'),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/lookups/system-types/${id}`),
    onSuccess: () => { invalidate(); toast.success('System removed.'); },
    onError: () => toast.error('Could not delete.'),
  });

  const systems = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Systems</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The EAJ products clients can open tickets for. New systems appear on the landing page and ticket form instantly.
          </p>
        </div>
        <Button onClick={() => setEditing({})}><Plus /> Add System</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : systems.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((s, i) => {
            const Icon = systemIcon(s.icon);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={cn('hover-lift rounded-2xl glass p-5', !s.is_active && 'opacity-55')}
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-xl grad-brand shadow-[0_0_18px_rgba(233,30,79,0.3)]">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={s.is_active ? 'Deactivate' : 'Activate'}
                      icon={Power}
                      size="icon-sm"
                      className={s.is_active ? 'hover:text-rose-400' : 'text-emerald-400 hover:text-emerald-300'}
                      onClick={() => toggle.mutate(s)}
                    />
                    <IconButton label="Edit" icon={Pencil} size="icon-sm" onClick={() => setEditing(s)} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <span><IconButton label="Delete" icon={Trash2} size="icon-sm" className="hover:text-rose-400" /></span>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{s.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Existing tickets keep their history, but clients won't be able to select this system anymore.
                            Consider deactivating instead if it's temporary.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(s.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <h3 className="mt-4 font-semibold text-mist">{s.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">{s.description || 'No description'}</p>
                <span className={cn(
                  'mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  s.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-navy-700 text-muted-foreground'
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', s.is_active ? 'bg-emerald-400' : 'bg-muted-foreground')} />
                  {s.is_active ? 'Live' : 'Hidden'}
                </span>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={MonitorCog}
          title="No systems yet"
          description="Add your first EAJ product so clients can open tickets for it."
          action={<Button onClick={() => setEditing({})}><Plus /> Add System</Button>}
        />
      )}

      {editing !== null && (
        <SystemDialog item={editing} onClose={() => setEditing(null)} onSaved={() => { invalidate(); setEditing(null); }} />
      )}
    </div>
  );
}

function SystemDialog({ item, onClose, onSaved }) {
  const isEdit = !!item.id;
  const [form, setForm] = useState({
    name: item.name ?? '',
    description: item.description ?? '',
    icon: item.icon ?? 'Monitor',
    sort_order: item.sort_order ?? 0,
    is_active: item.is_active ?? true,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `/admin/lookups/system-types/${item.id}` : '/admin/lookups/system-types';
      return (await api[isEdit ? 'patch' : 'post'](url, form)).data;
    },
    onSuccess: () => { toast.success(isEdit ? 'System updated.' : 'System added.'); onSaved(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not save.'),
  });

  const Preview = systemIcon(form.icon);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${item.name}` : 'Add a system'}</DialogTitle>
          <DialogDescription>Shown on the landing page, ticket form, filters, and analytics.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl grad-brand shadow-[0_0_18px_rgba(233,30,79,0.35)]">
              <Preview className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pharmacy System" required autoFocus />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-10 gap-1.5 rounded-xl border border-navy-600 bg-navy-800/40 p-2.5">
              {Object.entries(SYSTEM_ICONS).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => setForm({ ...form, icon: name })}
                  className={cn(
                    'grid aspect-square place-items-center rounded-lg transition-all hover:bg-navy-700 hover:scale-110',
                    form.icon === name ? 'bg-crimson/20 text-crimson-soft ring-1 ring-crimson/50' : 'text-mist/60'
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="One line clients see on the landing page…" />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="w-32 space-y-2">
              <Label>Sort order</Label>
              <Input type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-mist">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-crimson" />
              Visible to clients
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : isEdit ? 'Save changes' : 'Add system'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
