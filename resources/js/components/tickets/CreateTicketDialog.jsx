import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Ticket, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { can, P } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { useLookups } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/misc';
import { systemIcon } from '@/lib/systemIcons';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const CreateTicketContext = createContext({ openCreateTicket: () => {} });

/** Wrap the app shell once; any component can then call useCreateTicket().openCreateTicket(). */
export function CreateTicketProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openCreateTicket = useCallback(() => setOpen(true), []);

  return (
    <CreateTicketContext.Provider value={{ openCreateTicket }}>
      {children}
      {open && <CreateTicketDialog onClose={() => setOpen(false)} />}
    </CreateTicketContext.Provider>
  );
}

export function useCreateTicket() {
  return useContext(CreateTicketContext);
}

/** For the old /app/tickets/new URL (bookmarks, links): open the modal over the tickets list. */
export function OpenCreateTicketRoute() {
  const { openCreateTicket } = useCreateTicket();
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/app/tickets', { replace: true });
    openCreateTicket();
  }, [navigate, openCreateTicket]);
  return null;
}

const EMPTY = { subject: '', description: '', system_type_id: '', client_system_id: '', category_id: '', urgency_id: '', customer_id: '' };

function CreateTicketDialog({ onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Support/admin staff can file on a client's behalf.
  const isAdmin = can(user, P.TICKETS, P.CLIENTS);
  const { data: lookups } = useLookups();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  // Admin can file a ticket on behalf of an approved client.
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-select'],
    enabled: isAdmin,
    queryFn: async () => (await api.get('/admin/clients', { params: { status: 'approved', per_page: 200 } })).data,
  });
  const clients = clientsData?.data ?? [];

  // The systems this ticket can be about: the client's own (or, for an admin, the chosen client's).
  const isCustomer = user?.role === 'customer';
  const targetClient = isCustomer ? user.id : form.customer_id;
  const { data: clientSystems, isFetching: loadingSystems } = useQuery({
    queryKey: ['ticket-systems', targetClient],
    enabled: !!targetClient,
    queryFn: async () => (await api.get('/ticket-systems', { params: isAdmin ? { customer_id: targetClient } : {} })).data.data,
  });
  const ownSystems = targetClient ? clientSystems ?? [] : [];
  const useOwnSystems = ownSystems.length > 0;

  // Only one system? Pick it for them.
  useEffect(() => {
    if (ownSystems.length === 1 && !form.client_system_id) {
      setForm((f) => ({ ...f, client_system_id: String(ownSystems[0].id) }));
    }
  }, [ownSystems, form.client_system_id]);

  const mutation = useMutation({
    mutationFn: async () => {
      const data = { ...form };
      // Send either the client's specific system or a general system type, never both.
      if (useOwnSystems) data.system_type_id = ''; else data.client_system_id = '';
      const payload = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ''));
      return (await api.post('/tickets', payload)).data.data;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(`Ticket ${ticket.ticket_number} created!`);
      onClose();
      navigate(`/app/tickets/${ticket.id}`);
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors || {});
      toast.error('Please check the form and try again.');
    },
  });

  // Functional update so two quick changes can't overwrite each other.
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const err = (k) => errors[k]?.[0];
  const dirty = form.subject.trim() || form.description.trim();

  // Don't lose a half-written ticket to a stray click outside the modal.
  const requestClose = () => {
    if (mutation.isPending) return;
    if (dirty && !window.confirm('Discard this ticket?')) return;
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && requestClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-crimson/15 p-2.5 text-crimson-soft"><Ticket className="h-5 w-5" /></div>
            <div>
              <DialogTitle>Create a ticket</DialogTitle>
              <DialogDescription>Tell us what's happening — we'll pick it up fast.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); setErrors({}); mutation.mutate(); }} className="space-y-5">
          {isAdmin && (
            <div className="space-y-2 rounded-xl border border-crimson/25 bg-crimson/5 p-4">
              <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-crimson-soft" /> File on behalf of a client</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v, client_system_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="Select a client (leave empty to file as yourself)" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.store_name || c.name} — {c.name}</SelectItem>
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
              <Label>System{useOwnSystems && <span className="text-crimson-soft"> *</span>}</Label>
              {useOwnSystems ? (
                <Select value={form.client_system_id} onValueChange={set('client_system_id')}>
                  <SelectTrigger><SelectValue placeholder={isCustomer ? 'Which of your systems?' : 'Which system?'} /></SelectTrigger>
                  <SelectContent>
                    {ownSystems.map((cs) => {
                      const Icon = systemIcon(cs.system_type.icon);
                      return (
                        <SelectItem key={cs.id} value={String(cs.id)}>
                          <span className="inline-flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-crimson-soft" />{cs.display_name}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={form.system_type_id} onValueChange={set('system_type_id')} disabled={!!targetClient && loadingSystems}>
                  <SelectTrigger><SelectValue placeholder={targetClient && loadingSystems ? 'Loading…' : 'Select…'} /></SelectTrigger>
                  <SelectContent>
                    {lookups?.system_types?.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {(err('client_system_id') || err('system_type_id')) && <p className="text-xs text-crimson-soft">{err('client_system_id') || err('system_type_id')}</p>}
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={set('category_id')}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {lookups?.categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {err('category_id') && <p className="text-xs text-crimson-soft">{err('category_id')}</p>}
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
              {err('urgency_id') && <p className="text-xs text-crimson-soft">{err('urgency_id')}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={6} placeholder="Describe the problem, steps to reproduce, and any impact…" value={form.description} onChange={(e) => set('description')(e.target.value)} required />
            {err('description') && <p className="text-xs text-crimson-soft">{err('description')}</p>}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={requestClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : <><Send /> Submit ticket</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
