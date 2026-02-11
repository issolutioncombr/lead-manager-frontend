'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Modal } from '../../../components/Modal';
import { StatusBadge } from '../../../components/StatusBadge';
import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { Appointment, Lead, Seller } from '../../../types';

type AppointmentStatusOption = 'AGENDADA' | 'REMARCADO';
type LeadStageOption = 'NOVO' | 'AGENDOU_CALL' | 'ENTROU_CALL' | 'COMPROU' | 'NO_SHOW';
type LeadSummary = Pick<Lead, 'id' | 'name' | 'email' | 'contact'>;

interface AppointmentsResponse {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
}

interface LeadsResponse {
  data: Lead[];
}

const statusOptions: AppointmentStatusOption[] = ['AGENDADA', 'REMARCADO'];
const statusLabels: Record<AppointmentStatusOption, string> = {
  AGENDADA: 'Agendada',
  REMARCADO: 'Remarcado'
};
const leadStageOptions: Array<{ value: LeadStageOption; label: string }> = [
  { value: 'NOVO', label: 'Novo' },
  { value: 'AGENDOU_CALL', label: 'Agendou uma call' },
  { value: 'ENTROU_CALL', label: 'Entrou na call' },
  { value: 'COMPROU', label: 'Comprou' },
  { value: 'NO_SHOW', label: 'Não compareceu' }
];
const PAGE_SIZE = 20;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });

export default function AppointmentsPage() {
  const { seller } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [isLeadsLoading, setIsLeadsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const filtersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    leadId: '',
    start: '',
    end: '',
    status: 'AGENDADA' as AppointmentStatusOption,
    leadStage: '' as LeadStageOption | '',
    meetLink: ''
  });
  const [selectedLeadInfo, setSelectedLeadInfo] = useState<LeadSummary | null>(null);
  const [isLeadPickerOpen, setIsLeadPickerOpen] = useState(false);
  const [appointmentPendingDeletion, setAppointmentPendingDeletion] = useState<Appointment | null>(null);
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkingAppointment, setLinkingAppointment] = useState<Appointment | null>(null);
  const [linkSellers, setLinkSellers] = useState<Seller[]>([]);
  const [linkSelectedSellerId, setLinkSelectedSellerId] = useState<string>('');
  const [linkSellersLoading, setLinkSellersLoading] = useState(false);
  const [linkIsLoading, setLinkIsLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const hasFetchedInitial = useRef(false);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const effectivePage = Math.min(currentPage, totalPages);
  const showingFrom = total === 0 ? 0 : (effectivePage - 1) * PAGE_SIZE + 1;
  const showingTo = total === 0 ? 0 : Math.min(effectivePage * PAGE_SIZE, total);
  const canGoPrevious = effectivePage > 1;
  const canGoNext = effectivePage < totalPages && total > 0;
  const hasFilters = Boolean(selectedStatus || searchTerm.trim() || startDate || endDate);
  const currentPageRef = useRef(currentPage);

  const fetchAppointments = useCallback(
    async (options?: { page?: number; status?: string; search?: string; start?: string; end?: string }) => {
      const pageToFetch = options?.page ?? currentPageRef.current ?? 1;
      const statusFilter = options?.status ?? selectedStatus;
      const searchFilter = options?.search ?? searchTerm;
      const startFilter = options?.start ?? startDate;
      const endFilter = options?.end ?? endDate;
      const previousPage = currentPageRef.current ?? 1;

      if (pageToFetch !== currentPage) {
        setCurrentPage(pageToFetch);
      }

      try {
        setIsLoading(true);
        setError(null);
        const params: Record<string, unknown> = {
          limit: PAGE_SIZE,
          page: pageToFetch
        };
        if (statusFilter) params.status = statusFilter;
        const normalizedSearch = searchFilter.trim();
        if (normalizedSearch) params.search = normalizedSearch;
        if (startFilter) params.start = startFilter;
        if (endFilter) params.end = endFilter;
        const response = await api.get<AppointmentsResponse>('/appointments', { params });
        setAppointments(response.data.data);
        setTotal(response.data.total);
        setCurrentPage(response.data.page ?? pageToFetch);
      } catch (e) {
        setError('Nao foi possivel carregar as calls.');
        setCurrentPage(previousPage);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedStatus, searchTerm, startDate, endDate, currentPage]
  );

  const fetchLeads = useCallback(
    async (searchTerm?: string) => {
      try {
        setIsLeadsLoading(true);
        const response = await api.get<LeadsResponse>('/leads', {
          params: { limit: 50, search: searchTerm || undefined }
        });
        setLeads(response.data.data);
      } catch (e) {
        setLeads([]);
      } finally {
        setIsLeadsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isLeadPickerOpen) {
      return;
    }
    const delay = setTimeout(() => {
      fetchLeads(leadSearch.trim() || undefined);
    }, 300);
    return () => clearTimeout(delay);
  }, [leadSearch, fetchLeads, isLeadPickerOpen]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (hasFetchedInitial.current) {
      return;
    }
    hasFetchedInitial.current = true;
    fetchAppointments();
  }, [fetchAppointments]);

  const isoToLocalInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);

  const openModal = (appointment?: Appointment) => {
    if (appointment) {
      setEditingAppointmentId(appointment.id);
      setFormState({
        leadId: appointment.leadId,
        start: isoToLocalInput(appointment.start),
        end: isoToLocalInput(appointment.end),
        status: (appointment.status as AppointmentStatusOption) ?? 'AGENDADA',
        leadStage: (appointment.lead.stage as LeadStageOption) ?? '',
        meetLink: appointment.meetLink ?? ''
      });
      setSelectedLeadInfo(appointment.lead);
    } else {
      setEditingAppointmentId(null);
      setFormState({
        leadId: '',
        start: '',
        end: '',
        status: 'AGENDADA',
        leadStage: '',
        meetLink: ''
      });
      setSelectedLeadInfo(null);
    }
    setIsModalOpen(true);
  };

  const openLinkModal = async (appointment: Appointment) => {
    if (seller) return;
    setLinkError(null);
    setLinkSuccess(null);
    setLinkSelectedSellerId('');
    setLinkSellers([]);
    setLinkingAppointment(appointment);
    setIsLinkModalOpen(true);
    setLinkSellersLoading(true);
    try {
      const resp = await api.get<{ data: Seller[]; total?: number }>('/sellers', { params: { page: 1, limit: 100 } });
      const list = Array.isArray(resp.data?.data) ? resp.data.data : [];
      setLinkSellers(list);
    } catch (err) {
      setLinkError('Nao foi possivel carregar os vendedores.');
    } finally {
      setLinkSellersLoading(false);
    }
  };

  const submitLink = async () => {
    if (seller) return;
    if (!linkingAppointment) return;
    if (!linkSelectedSellerId) {
      setLinkError('Selecione um vendedor.');
      return;
    }
    setLinkIsLoading(true);
    setLinkError(null);
    setLinkSuccess(null);
    try {
      const { data } = await api.post<{
        id: string;
        sellerId: string;
        leadId: string;
        appointmentId: string | null;
        status: string;
        expiresAt: string | null;
      }>(`/sellers/${linkSelectedSellerId}/video-call-links`, { appointmentId: linkingAppointment.id });

      const sellerInfo = linkSellers.find((s) => s.id === linkSelectedSellerId);
      setLinkingAppointment((prev) => {
        if (!prev) return prev;
        const next = (prev.sellerVideoCallAccesses ?? []).filter((item) => item.sellerId !== data.sellerId);
        next.push({
          id: data.id,
          sellerId: data.sellerId,
          leadId: data.leadId,
          appointmentId: data.appointmentId,
          status: data.status,
          expiresAt: data.expiresAt,
          seller: {
            id: data.sellerId,
            name: sellerInfo?.name ?? 'Vendedor',
            email: sellerInfo?.email ?? null
          }
        });
        return { ...prev, sellerVideoCallAccesses: next };
      });

      setLinkSuccess('Vendedor vinculado com sucesso.');
      void fetchAppointments({ page: currentPageRef.current });
    } catch (err) {
      setLinkError('Erro ao vincular vendedor.');
    } finally {
      setLinkIsLoading(false);
    }
  };

  const revokeLink = async (target: NonNullable<Appointment['sellerVideoCallAccesses']>[number]) => {
    if (seller) return;
    if (!linkingAppointment) return;
    setLinkIsLoading(true);
    setLinkError(null);
    setLinkSuccess(null);
    try {
      await api.delete(`/sellers/${target.sellerId}/video-call-links/${target.id}`);
      setLinkSuccess('Vinculo removido com sucesso.');
      setLinkSelectedSellerId('');
      setLinkingAppointment((prev) => {
        if (!prev) return prev;
        const next = (prev.sellerVideoCallAccesses ?? []).filter((item) => item.id !== target.id);
        return { ...prev, sellerVideoCallAccesses: next };
      });
      void fetchAppointments({ page: currentPageRef.current });
    } catch {
      setLinkError('Erro ao remover vinculo.');
    } finally {
      setLinkIsLoading(false);
    }
  };

  const handleLeadSelection = (lead: Lead) => {
    setFormState((prev) => ({ ...prev, leadId: lead.id }));
    setSelectedLeadInfo(lead);
    setIsLeadPickerOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.leadId) {
      setError('Selecione um lead para a call.');
      return;
    }
    const payload: Record<string, unknown> = {
      leadId: formState.leadId,
      start: new Date(formState.start).toISOString(),
      end: new Date(formState.end).toISOString(),
      status: formState.status,
      meetLink: formState.meetLink || null
    };

    if (editingAppointmentId && formState.leadStage) {
      payload.leadStage = formState.leadStage;
    }

    try {
      if (editingAppointmentId) {
        await api.patch(`/appointments/${editingAppointmentId}`, payload);
      } else {
        await api.post('/appointments', payload);
      }
      setIsModalOpen(false);
      await fetchAppointments({ page: currentPage });
    } catch (e) {
      setError('Erro ao salvar call.');
    }
  };

  const openLeadPicker = () => {
    setLeadSearch('');
    setLeads([]);
    setIsLeadPickerOpen(true);
  };

  const requestDeleteAppointment = (appointment: Appointment) => {
    setAppointmentPendingDeletion(appointment);
  };

  const handleConfirmDeleteAppointment = async () => {
    if (!appointmentPendingDeletion) {
      return;
    }
    try {
      setIsDeletingAppointment(true);
      await api.delete(`/appointments/${appointmentPendingDeletion.id}`);
      setAppointmentPendingDeletion(null);
      await fetchAppointments({ page: currentPage });
    } catch (e) {
      setError('Erro ao remover call.');
    } finally {
      setIsDeletingAppointment(false);
    }
  };

  const handleCancelDeleteAppointment = () => {
    if (isDeletingAppointment) {
      return;
    }
    setAppointmentPendingDeletion(null);
  };

  const handleClearFilters = () => {
    setSelectedStatus('');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    fetchAppointments({ page: 1, status: '', search: '', start: '', end: '' });
  };

  useEffect(() => {
    filtersTimerRef.current && clearTimeout(filtersTimerRef.current);
    filtersTimerRef.current = setTimeout(() => {
      fetchAppointments({ page: 1 });
    }, 400);
    return () => {
      if (filtersTimerRef.current) {
        clearTimeout(filtersTimerRef.current);
      }
    };
  }, [searchTerm, startDate, endDate, selectedStatus, fetchAppointments]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || isLoading) {
      return;
    }
    fetchAppointments({ page });
  };

  const handlePreviousPage = () => {
    if (!canGoPrevious) {
      return;
    }
    handlePageChange(currentPage - 1);
  };

  const handleNextPage = () => {
    if (!canGoNext) {
      return;
    }
    handlePageChange(currentPage + 1);
  };

  return (
    <div className="space-y-6 w-full max-w-screen-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Video chamadas</h1>
          <p className="text-sm text-gray-500">Agende e acompanhe as chamadas dos leads.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          Nova call
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[180px] text-xs font-semibold text-gray-600">
            Buscar por lead ou contato
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nome, email ou telefone"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Inicio a partir de
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Fim ate
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Status
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Todos os status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleClearFilters}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      <div className="rounded-2xl bg-white shadow">
        <div className="block xl:hidden">
          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Carregando...</div>
            ) : appointments.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Nenhuma call encontrada.</div>
            ) : (
              appointments.map((appointment) => (
                <div key={appointment.id} className="space-y-3 p-4">
                  {(() => {
                    const linked = appointment.sellerVideoCallAccesses ?? [];
                    const names = linked.map((item) => item.seller?.name).filter(Boolean) as string[];
                    const preview = names.slice(0, 2).join(', ');
                    const extra = names.length > 2 ? ` +${names.length - 2}` : '';
                    return (
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {appointment.lead.name ?? appointment.lead.email ?? 'Sem nome'}
                          </p>
                          <p className="truncate text-xs text-gray-500">{appointment.lead.email ?? '--'}</p>
                          {names.length ? (
                            <p className="mt-1 truncate text-xs font-semibold text-primary">
                              Vinculados ({names.length}): {preview}
                              {extra}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge value={appointment.status} />
                          {appointment.lead.stage ? <StatusBadge value={appointment.lead.stage} /> : null}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid gap-2 text-xs text-gray-600">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-500">Contato</span>
                      <span className="truncate">{appointment.lead.contact ?? '--'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-500">Inicio</span>
                      <span className="whitespace-nowrap">{formatDateTime(appointment.start)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-500">Fim</span>
                      <span className="whitespace-nowrap">{formatDateTime(appointment.end)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-500">Agendada</span>
                      <span className="whitespace-nowrap">{formatDateTime(appointment.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-500">Link</span>
                      {appointment.meetLink ? (
                        <a
                          href={appointment.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="max-w-[60%] truncate font-semibold text-primary underline"
                        >
                          Abrir link
                        </a>
                      ) : (
                        <span>--</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!seller && (
                      <button
                        onClick={() => void openLinkModal(appointment)}
                        className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10"
                      >
                        {appointment.sellerVideoCallAccesses?.length ? 'Gerenciar vendedores' : 'Vincular vendedor'}
                      </button>
                    )}
                    <button
                      onClick={() => openModal(appointment)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                    >
                      Atualizar
                    </button>
                    <button
                      onClick={() => requestDeleteAppointment(appointment)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hidden xl:block">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3">Lead</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Inicio</th>
                <th className="px-6 py-3">Fim</th>
                <th className="px-6 py-3">Link</th>
                <th className="px-6 py-3">Agendada</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Status do lead</th>
                <th className="px-6 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-6 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-6 text-center text-gray-500">
                    Nenhuma call encontrada.
                  </td>
                </tr>
              ) : (
                appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="max-w-[240px] truncate font-semibold">{appointment.lead.name ?? 'Sem nome'}</p>
                      <p className="max-w-[240px] truncate text-xs text-gray-400">{appointment.lead.email ?? '--'}</p>
                      {appointment.sellerVideoCallAccesses?.length ? (
                        <p className="mt-1 max-w-[240px] truncate text-xs font-semibold text-primary">
                          Vinculados ({appointment.sellerVideoCallAccesses.length}):{' '}
                          {appointment.sellerVideoCallAccesses
                            .map((item) => item.seller?.name)
                            .filter(Boolean)
                            .slice(0, 2)
                            .join(', ')}
                          {appointment.sellerVideoCallAccesses.length > 2
                            ? ` +${appointment.sellerVideoCallAccesses.length - 2}`
                            : ''}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      <span className="block max-w-[180px] truncate">{appointment.lead.contact ?? '--'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(appointment.start)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(appointment.end)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {appointment.meetLink ? (
                        <a href={appointment.meetLink} target="_blank" rel="noreferrer" className="text-primary underline">
                          Abrir link
                        </a>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(appointment.createdAt)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge value={appointment.status} />
                    </td>
                    <td className="px-6 py-4">
                      {appointment.lead.stage ? <StatusBadge value={appointment.lead.stage} /> : '--'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {!seller && (
                          <button
                            onClick={() => void openLinkModal(appointment)}
                            className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
                          >
                            {appointment.sellerVideoCallAccesses?.length ? 'Gerenciar vendedores' : 'Vincular vendedor'}
                          </button>
                        )}
                        <button
                          onClick={() => openModal(appointment)}
                          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500 transition hover:bg-gray-100"
                        >
                          Atualizar
                        </button>
                        <button
                          onClick={() => requestDeleteAppointment(appointment)}
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:text-sm">
        <p>
          {isLoading
            ? 'Carregando chamadas...'
            : total > 0
              ? `Exibindo ${showingFrom}-${showingTo} de ${total} chamadas`
              : hasFilters
                ? 'Nenhuma chamada encontrada para os filtros aplicados.'
                : 'Nenhuma chamada registrada.'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreviousPage}
            disabled={!canGoPrevious || isLoading}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="font-medium text-gray-600">
            Pagina {total > 0 ? effectivePage : 1} de {totalPages}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!canGoNext || isLoading}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proxima
          </button>
        </div>
      </div>

      <Modal
        title={editingAppointmentId ? 'Atualizar call' : 'Nova call'}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsLeadPickerOpen(false);
        }}
      >
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2 text-sm">
            <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase text-gray-500">Lead selecionado</p>
              {selectedLeadInfo ? (
                <>
                  <p className="font-semibold text-gray-900">
                    {selectedLeadInfo.name ?? selectedLeadInfo.email ?? 'Lead sem nome'}
                  </p>
                  <p className="text-xs text-gray-500">{selectedLeadInfo.email ?? '--'}</p>
                  <p className="text-xs text-gray-500">{selectedLeadInfo.contact ?? '--'}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Nenhum lead selecionado</p>
              )}
            </div>
            {!editingAppointmentId && (
              <button
                type="button"
                onClick={openLeadPicker}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
              >
                {formState.leadId ? 'Trocar lead' : 'Selecionar lead'}
              </button>
            )}
          </div>

          <div className="text-sm">
            <label>
              Link da call (Google Meet)
              <input
                value={formState.meetLink}
                onChange={(event) => setFormState((prev) => ({ ...prev, meetLink: event.target.value }))}
                placeholder="https://meet.google.com/..."
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
              />
            </label>
            <div className="mt-4 grid gap-4">
              <label className="text-sm">
                Inicio
                <input
                  required
                  type="datetime-local"
                  value={formState.start}
                  onChange={(event) => setFormState((prev) => ({ ...prev, start: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>

              <label className="text-sm">
                Fim
                <input
                  required
                  type="datetime-local"
                  value={formState.end}
                  onChange={(event) => setFormState((prev) => ({ ...prev, end: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>
            </div>
          </div>

          <label className="text-sm md:col-span-2">
            Status
            <select
              value={formState.status}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, status: event.target.value as AppointmentStatusOption }))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          {editingAppointmentId && (
            <label className="text-sm md:col-span-2">
              Status do lead
              <select
                value={formState.leadStage}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, leadStage: event.target.value as LeadStageOption | '' }))
                }
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
              >
                <option value="">Manter status atual</option>
                {leadStageOptions.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white transition hover:bg-primary-dark"
            >
              Salvar call
            </button>
          </div>
        </form>
      </Modal>
      <Modal title="Selecionar lead" isOpen={isLeadPickerOpen} onClose={() => setIsLeadPickerOpen(false)}>
        <div className="space-y-4">
          <label className="block text-sm">
            Buscar por nome ou contato
            <input
              type="search"
              value={leadSearch}
              onChange={(event) => setLeadSearch(event.target.value)}
              placeholder="Ex.: Maria ou 5599999999"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          {isLeadsLoading ? (
            <p className="text-sm text-gray-500">Carregando leads...</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum lead encontrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="font-semibold text-gray-900">{lead.name ?? lead.email ?? 'Lead sem nome'}</p>
                    <p className="text-xs text-gray-500">{lead.email ?? '--'}</p>
                    <p className="text-xs text-gray-500">{lead.contact ?? '--'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLeadSelection(lead)}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                  >
                    Selecionar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        title="Vincular vendedor à video chamada"
        isOpen={isLinkModalOpen}
        onClose={() => {
          if (linkIsLoading) return;
          setIsLinkModalOpen(false);
          setLinkingAppointment(null);
          setLinkSelectedSellerId('');
          setLinkSellers([]);
          setLinkSellersLoading(false);
          setLinkError(null);
          setLinkSuccess(null);
        }}
      >
        <div className="space-y-4">
          {linkingAppointment ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-gray-500">Video chamada</p>
              <p className="font-semibold text-gray-900">{linkingAppointment.lead.name ?? 'Sem nome'}</p>
              <p className="text-xs text-gray-500">{linkingAppointment.lead.contact ?? '--'}</p>
              <p className="text-xs text-gray-500">{formatDateTime(linkingAppointment.start)}</p>
            </div>
          ) : null}

          {!seller && linkingAppointment?.sellerVideoCallAccesses?.length ? (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-gray-500">
                Vendedores vinculados ({linkingAppointment.sellerVideoCallAccesses.length})
              </p>
              <ul className="mt-2 divide-y divide-gray-100">
                {linkingAppointment.sellerVideoCallAccesses.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{item.seller?.name ?? 'Vendedor'}</p>
                      <p className="truncate text-xs text-gray-500">{item.seller?.email ?? '--'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void revokeLink(item)}
                      disabled={linkSellersLoading || linkIsLoading}
                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {linkError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{linkError}</div>
          )}
          {linkSuccess && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">{linkSuccess}</p>
              {linkSelectedSellerId ? (
                <p className="mt-1 text-xs text-green-800/80">
                  Vendedor:{' '}
                  {linkSellers.find((s) => s.id === linkSelectedSellerId)?.name ?? 'selecionado'}
                </p>
              ) : null}
            </div>
          )}

          <label className="block text-xs font-semibold text-gray-600">
            Vendedor
            <select
              value={linkSelectedSellerId}
              onChange={(e) => {
                setLinkSelectedSellerId(e.target.value);
                setLinkError(null);
                setLinkSuccess(null);
              }}
              disabled={linkSellersLoading || linkIsLoading}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
            >
              <option value="">Selecione...</option>
              {linkSellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.email ? `(${s.email})` : ''}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void submitLink()}
            disabled={linkSellersLoading || linkIsLoading || !linkingAppointment}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {linkSellersLoading ? 'Carregando vendedores...' : linkIsLoading ? 'Vinculando...' : 'Vincular'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={appointmentPendingDeletion !== null}
        title="Remover call"
        description={
          appointmentPendingDeletion ? (
            <p>
              Deseja realmente remover a call de{' '}
              <span className="font-semibold text-slate-900">
                {appointmentPendingDeletion.lead.name ??
                  appointmentPendingDeletion.lead.email ??
                  'lead'}
              </span>
              ? Essa acao nao pode ser desfeita.
            </p>
          ) : null
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        tone="danger"
        isConfirmLoading={isDeletingAppointment}
        onCancel={handleCancelDeleteAppointment}
        onConfirm={handleConfirmDeleteAppointment}
      />
    </div>
  );
}
