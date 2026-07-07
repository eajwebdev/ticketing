import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, SlidersHorizontal } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IconButton, Skeleton, EmptyState, Spinner } from '@/components/ui/misc';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const TYPES = [
  { key: 'categories', label: 'Categories', fields: [] },
  { key: 'urgency-levels', label: 'Urgency Levels', fields: ['color', 'sla_hours'] },
];

export default function AdminLookups() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Categories & Urgency</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage ticket categories and urgency levels (with SLA targets). Systems have their own page.</p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          {TYPES.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TYPES.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <LookupTable type={t} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function LookupTable({ type }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['lookup', type.key],
    queryFn: async () => (await api.get(`/admin/lookups/${type.key}`)).data.data,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lookup', type.key] });
    queryClient.invalidateQueries({ queryKey: ['lookups'] });
  };

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/lookups/${type.key}/${id}`),
    onSuccess: () => { invalidate(); toast.success('Deleted.'); },
    onError: () => toast.error('Could not delete.'),
  });

  const items = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LookupDialog type={type} onSaved={invalidate} trigger={<Button size="sm"><Plus /> Add {type.label.replace(/s$/, '')}</Button>} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length ? (
        <div className="overflow-hidden rounded-2xl glass">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  {type.fields.includes('color') && <th className="px-5 py-3 font-medium">Color</th>}
                  {type.fields.includes('sla_hours') && <th className="px-5 py-3 font-medium">SLA</th>}
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-navy-600/30 last:border-0 hover:bg-navy-700/40">
                    <td className="px-5 py-3 font-medium text-mist">{item.name}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{item.description || '—'}</td>
                    {type.fields.includes('color') && (
                      <td className="px-5 py-3"><span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full" style={{ background: item.color }} />{item.color}</span></td>
                    )}
                    {type.fields.includes('sla_hours') && <td className="px-5 py-3 text-muted-foreground">{item.sla_hours}h</td>}
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${item.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-navy-700 text-muted-foreground'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <LookupDialog type={type} item={item} onSaved={invalidate}
                          trigger={<span><IconButton label="Edit" icon={Pencil} size="icon-sm" /></span>} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild><span><IconButton label="Delete" icon={Trash2} size="icon-sm" className="hover:text-rose-400" /></span></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Existing tickets keep their data, but this option won't be selectable anymore.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(item.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState icon={SlidersHorizontal} title={`No ${type.label.toLowerCase()} yet`} />
      )}
    </div>
  );
}

function LookupDialog({ type, item, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const editing = !!item;
  const [form, setForm] = useState(() => ({
    name: item?.name ?? '', description: item?.description ?? '',
    icon: item?.icon ?? '', color: item?.color ?? '#E91E4F', sla_hours: item?.sla_hours ?? 24,
    is_active: item?.is_active ?? true,
  }));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const mutation = useMutation({
    mutationFn: async () => {
      const url = editing ? `/admin/lookups/${type.key}/${item.id}` : `/admin/lookups/${type.key}`;
      const method = editing ? 'patch' : 'post';
      return (await api[method](url, form)).data;
    },
    onSuccess: () => { onSaved(); toast.success(editing ? 'Updated.' : 'Created.'); setOpen(false); },
    onError: () => toast.error('Could not save.'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} {type.label.replace(/s$/, '')}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={set('name')} required autoFocus /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={set('description')} /></div>
          {type.fields.includes('icon') && (
            <div className="space-y-2"><Label>Icon (Lucide name)</Label><Input value={form.icon} onChange={set('icon')} placeholder="e.g. Store" /></div>
          )}
          {type.fields.includes('color') && (
            <div className="space-y-2"><Label>Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.color} onChange={set('color')} className="h-11 w-14 rounded-lg border border-navy-600 bg-transparent" />
                <Input value={form.color} onChange={set('color')} className="flex-1" />
              </div>
            </div>
          )}
          {type.fields.includes('sla_hours') && (
            <div className="space-y-2"><Label>SLA (hours)</Label><Input type="number" min="1" value={form.sla_hours} onChange={set('sla_hours')} /></div>
          )}
          <label className="flex items-center gap-2 text-sm text-mist">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-crimson" />
            Active
          </label>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
