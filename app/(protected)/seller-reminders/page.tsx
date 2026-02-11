'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import api from '../../../lib/api';
import { Appointment, Seller, SellerReminderOverviewItem } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { Modal } from '../../../components/Modal';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Loading } from '../../../components/Loading';
import { StatusBadge } from '../../../components/StatusBadge';

type RemindersResponse = { data: SellerReminderOverviewItem[]; total: number; page: number; limit: number };

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function SellerRemindersPage() {
  const { seller } = useAuth();
  const isSeller = !!seller;

  const [reminders, setReminders] = useState<SellerReminderOverviewItem[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerFilterId, setSellerFilterId] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const filtersRef = useRef({ search, statusFilter, startDate, endDate, sellerFilterId });

  useEffect(() => {
    filtersRef.current = { search, statusFilter, startDate, endDate, sellerFilterId };
  }, [search, statusFilter, startDate, endDate, sellerFilterId]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<SellerReminderOverviewItem | null>(null);
  const [formState, setFormState] = useState({ title: '', content: '', remindAt: '', appointmentId: '' });
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<SellerReminderOverviewItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  const fetchReminders = useCallback(async (targetPage = page, customFilters = filtersRef.current) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        page: targetPage,
        limit,
        search: customFilters.search || undefined,
        status: customFilters.statusFilter || undefined,
        start: customFilters.startDate || undefined,
        end: customFilters.endDate || undefined
      };
      if (!isSeller && customFilters.sellerFilterId) {
        params.sellerId = customFilters.sellerFilterId;
      }
      const endpoint = isSeller ? '/seller-reminders' : '/seller-reminders/overview';
      const { data } = await api.get<RemindersResponse>(endpoint, { params });
      setReminders(Array.isArray(data?.data) ? data.data : []);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
      setPage(typeof data?.page === 'number' ? data.page : targetPage);
    } catch {
      setReminders([]);
      setTotal(0);
      setError('Nao foi possivel carregar os lembretes.');
    } finally {
      setLoading(false);
    }
  }, [isSeller, limit, page]);

  const fetchSellers = useCallback(async () => {
    if (isSeller) return;
    try {
      const { data } = await api.get<{ data: Seller[] }>('/sellers', { params: { page: 1, limit: 100 } });
      setSellers(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setSellers([]);
    }
  }, [isSeller]);

  const fetchAppointments = useCallback(async () => {
    if (!isSeller) return;
    setAppointmentsLoading(true);
    try {
      const { data } = await api.get<{ data: Appointment[] }>('/appointments', { params: { page: 1, limit: 100 } });
      setAppointments(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [isSeller]);

  useEffect(() => {
    void fetchSellers();
    void fetchAppointments();
    void fetchReminders(1);
  }, [fetchAppointments, fetchReminders, fetchSellers]);

  useEffect(() => {
    const t = window.setTimeout(() => void fetchReminders(1), 400);
    return () => window.clearTimeout(t);
  }, [fetchReminders, search, statusFilter, startDate, endDate, sellerFilterId]);

  const openCreate = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    setEditing(null);
    setFormState({
      title: '',
      content: '',
      remindAt: now.toISOString().slice(0, 16),
      appointmentId: appointments[0]?.id ?? ''
    });
    setIsModalOpen(true);
  };

  const openEdit = (r: SellerReminderOverviewItem) => {
    setEditing(r);
    setFormState({
      title: r.title ?? '',
      content: r.content ?? '',
      remindAt: new Date(r.remindAt).toISOString().slice(0, 16),
      appointmentId: r.appointment?.id ?? ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSeller) return;
    if (!formState.title.trim() || !formState.remindAt) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/seller-reminders/${editing.id}`, {
          title: formState.title,
          content: formState.content || null,
          remindAt: new Date(formState.remindAt).toISOString(),
          appointmentId: formState.appointmentId || null
        });
      } else {
        await api.post('/seller-reminders', {
          title: formState.title,
          content: formState.content || null,
          remindAt: new Date(formState.remindAt).toISOString(),
          appointmentId: formState.appointmentId || undefined
        });
      }
      setIsModalOpen(false);
      await fetchReminders(1);
    } catch {
      setError('Nao foi possivel salvar o lembrete.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (r: SellerReminderOverviewItem) => {
    if (!isSeller) return;
    setError(null);
    try {
      await api.patch(`/seller-reminders/${r.id}`, { status: r.status === 'DONE' ? 'PENDING' : 'DONE' });
      await fetchReminders(page);
    } catch {
      setError('Nao foi possivel atualizar o status.');
    }
  };

  const handleDelete = async () => {
    if (!isSeller || !toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/seller-reminders/${toDelete.id}`);
      setToDelete(null);
      await fetchReminders(1);
    } catch {
      setError('Nao foi possivel remover o lembrete.');
    } finally {
      setDeleting(false);
    }
  };

  const statusLabel = useMemo(() => {
    return {
      PENDING: 'Pendente',
      DONE: 'Concluido',
      CANCELED: 'Cancelado'
    } as const;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Lembretes Seller</h1>
          <p className="text-sm text-gray-500">
            {isSeller ? 'Registre lembretes com data e hora.' : 'Acompanhe os lembretes cadastrados pelos vendedores.'}
          </p>
        </div>
        {isSeller ? (
          <button
            onClick={openCreate}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Novo lembrete
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {!isSeller ? (
            <label className="min-w-[220px] flex-1 text-xs font-semibold text-gray-600">
              Vendedor
              <select
                value={sellerFilterId}
                onChange={(e) => setSellerFilterId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Todos</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="min-w-[220px] flex-1 text-xs font-semibold text-gray-600">
            Buscar
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Titulo ou conteudo"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="min-w-[220px] text-xs font-semibold text-gray-600">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="PENDING">{statusLabel.PENDING}</option>
              <option value="DONE">{statusLabel.DONE}</option>
              <option value="CANCELED">{statusLabel.CANCELED}</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Inicio
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Fim
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-10">
          <Loading />
        </div>
      ) : reminders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum lembrete encontrado.
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow">
          <div className="block xl:hidden divide-y divide-gray-100">
            {reminders.map((r) => (
              <div key={r.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(r.remindAt)}</p>
                    {!isSeller ? (
                      <p className="truncate text-xs font-semibold text-primary">{r.seller?.name ?? '--'}</p>
                    ) : null}
                  </div>
                  <StatusBadge value={r.status} />
                </div>
                {r.appointment?.lead ? (
                  <div className="grid gap-1 text-xs text-gray-600">
                    <p className="truncate">
                      <span className="font-semibold text-gray-500">Lead:</span>{' '}
                      {r.appointment.lead.name ?? r.appointment.lead.email ?? 'Lead'}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold text-gray-500">Call:</span> {formatDateTime(r.appointment.start)}
                    </p>
                  </div>
                ) : r.lead ? (
                  <p className="truncate text-xs text-gray-600">
                    <span className="font-semibold text-gray-500">Lead:</span> {r.lead.name ?? r.lead.email ?? 'Lead'}
                  </p>
                ) : null}
                {r.content ? <p className="whitespace-pre-wrap text-sm text-gray-700">{r.content}</p> : null}
                {isSeller ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void toggleDone(r)}
                      className={clsx(
                        'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                        r.status === 'DONE'
                          ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                          : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                      )}
                    >
                      {r.status === 'DONE' ? 'Marcar pendente' : 'Marcar concluido'}
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setToDelete(r)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="hidden xl:block">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  {!isSeller ? <th className="px-6 py-3">Vendedor</th> : null}
                  <th className="px-6 py-3">Titulo</th>
                  <th className="px-6 py-3">Quando</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Call / Lead</th>
                  <th className="px-6 py-3">Conteudo</th>
                  {isSeller ? <th className="px-6 py-3 text-right">Acoes</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {reminders.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    {!isSeller ? (
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{r.seller?.name ?? '--'}</p>
                        <p className="text-xs text-gray-500">{r.seller?.email ?? '--'}</p>
                      </td>
                    ) : null}
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-500">{r.id}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(r.remindAt)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge value={r.status} />
                    </td>
                    <td className="px-6 py-4">
                      {r.appointment?.lead ? (
                        <>
                          <p className="max-w-[260px] truncate font-semibold text-gray-900">
                            {r.appointment.lead.name ?? r.appointment.lead.email ?? 'Lead'}
                          </p>
                          <p className="max-w-[260px] truncate text-xs text-gray-500">{formatDateTime(r.appointment.start)}</p>
                        </>
                      ) : r.lead ? (
                        <>
                          <p className="max-w-[260px] truncate font-semibold text-gray-900">{r.lead.name ?? r.lead.email ?? 'Lead'}</p>
                          <p className="max-w-[260px] truncate text-xs text-gray-500">Sem call</p>
                        </>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="max-w-[520px] whitespace-pre-wrap">{r.content ?? '--'}</p>
                    </td>
                    {isSeller ? (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => void toggleDone(r)}
                            className={clsx(
                              'rounded-lg border px-3 py-1 text-xs font-semibold transition',
                              r.status === 'DONE'
                                ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                                : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                            )}
                          >
                            {r.status === 'DONE' ? 'Marcar pendente' : 'Concluir'}
                          </button>
                          <button
                            onClick={() => openEdit(r)}
                            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setToDelete(r)}
                            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:text-sm">
        <p>{`Exibindo ${reminders.length} de ${total} lembretes`}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canGoPrevious && void fetchReminders(page - 1)}
            disabled={!canGoPrevious || loading}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="font-medium text-gray-600">
            Pagina {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => canGoNext && void fetchReminders(page + 1)}
            disabled={!canGoNext || loading}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proxima
          </button>
        </div>
      </div>

      {isSeller ? (
        <>
          <Modal
            title={editing ? 'Editar lembrete' : 'Novo lembrete'}
            isOpen={isModalOpen}
            onClose={() => {
              if (saving) return;
              setIsModalOpen(false);
            }}
          >
            {appointmentsLoading ? (
              <div className="flex items-center justify-center p-10">
                <Loading />
              </div>
            ) : (
              <form onSubmit={handleSave} className="grid gap-4">
                <label className="text-sm">
                  Vincular a uma call (opcional)
                  <select
                    value={formState.appointmentId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, appointmentId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                  >
                    <option value="">Sem call</option>
                    {appointments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a.lead?.name ?? a.lead?.email ?? 'Lead') + ' • ' + formatDateTime(a.start)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Titulo
                  <input
                    value={formState.title}
                    onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                    required
                  />
                </label>
                <label className="text-sm">
                  Data e hora
                  <input
                    type="datetime-local"
                    value={formState.remindAt}
                    onChange={(e) => setFormState((prev) => ({ ...prev, remindAt: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                    required
                  />
                </label>
                <label className="text-sm">
                  Conteudo
                  <textarea
                    value={formState.content}
                    onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving || !formState.title.trim()}
                  className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </form>
            )}
          </Modal>

          <ConfirmDialog
            isOpen={toDelete !== null}
            title="Remover lembrete"
            description={toDelete ? <p>Deseja realmente remover este lembrete? Essa acao nao pode ser desfeita.</p> : null}
            confirmLabel="Remover"
            cancelLabel="Cancelar"
            tone="danger"
            isConfirmLoading={deleting}
            onCancel={() => (deleting ? null : setToDelete(null))}
            onConfirm={handleDelete}
          />
        </>
      ) : null}
    </div>
  );
}
