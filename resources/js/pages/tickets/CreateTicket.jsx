import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Send, Ticket, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useLookups } from '@/hooks/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/misc';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

export default function CreateTicket() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: lookups } = useLookups();
  const [form, setForm] = useState({ subject: '', description: '', system_type_id: '', category_id: '', urgency_id: '', customer_id: '' });
  const [errors, setErrors] = useState({});

  // Admin can file a ticket on behalf of an approved client.
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-select'],
    enabled: isAdmin,
    queryFn: async () => (await api.get('/admin/clients', { params: { status: 'approved', per_page: 200 } })).data,
  });
  const clients = clientsData?.data ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      return (await api.post('/tickets', payload)).data.data;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(`Ticket ${ticket.ticket_number} created!`);
      navigate(`/app/tickets/${ticket.id}`);
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors || {});
      toast.error('Please check the form and try again.');
    },
  });

  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const err = (k) => errors[k]?.[0];

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-crimson/15 p-2.5 text-crimson-soft"><Ticket className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Create a ticket</h1>
            <p className="text-sm text-muted-foreground">Tell us what's happening — we'll pick it up fast.</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); setErrors({}); mutation.mutate(); }} className="space-y-5">
              {isAdmin && (
                <div className="space-y-2 rounded-xl border border-crimson/25 bg-crimson/5 p-4">
                  <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-crimson-soft" /> File on behalf of a client</Label>
                  <Select value={form.customer_id} onValueChange={set('customer_id')}>
                    <SelectTrigger><SelectValue placeholder="Select a client (leave empty to file as yourself)" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.store_name || c.name} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">The ticket will belong to the selected client — they'll see it and chat on it as their own.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" placeholder="Briefly, what's the issue?" value={form.subject} onChange={(e) => set('subject')(e.target.value)} required autoFocus />
                {err('subject') && <p className="text-xs text-crimson-soft">{err('subject')}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>System</Label>
                  <Select value={form.system_type_id} onValueChange={set('system_type_id')}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {lookups?.system_types?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={set('category_id')}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {lookups?.categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select value={form.urgency_id} onValueChange={set('urgency_id')}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {lookups?.urgency_levels?.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: u.color }} />
                            {u.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={6} placeholder="Describe the problem, steps to reproduce, and any impact…" value={form.description} onChange={(e) => set('description')(e.target.value)} required />
                {err('description') && <p className="text-xs text-crimson-soft">{err('description')}</p>}
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? <Spinner className="h-4 w-4" /> : <><Send /> Submit ticket</>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
