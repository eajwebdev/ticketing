import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useLookups() {
  return useQuery({
    queryKey: ['lookups'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await api.get('/lookups')).data,
  });
}

export function useTickets(params) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => (await api.get('/tickets', { params })).data,
    keepPreviousData: true,
  });
}

export function useTicket(id) {
  return useQuery({
    queryKey: ['ticket', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/tickets/${id}`)).data.data,
  });
}

export function useMessages(id) {
  return useQuery({
    queryKey: ['messages', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/tickets/${id}/messages`)).data.data,
  });
}

export function useTeamDirectory() {
  return useQuery({
    queryKey: ['team'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await api.get('/team')).data.data,
  });
}
