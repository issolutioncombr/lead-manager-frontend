'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import api from '../../../lib/api';
import { Appointment, Seller, SellerCallNote } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { Modal } from '../../../components/Modal';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Loading } from '../../../components/Loading';
import { StatusBadge } from '../../../components/StatusBadge';

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

type NotesResponse = { data: SellerCallNote[]; total: number; page: number; limit: number };

export default function SellerNotesPage() {
  const { seller } = useAuth();
  const isSeller = !!seller;

  const [notes, setNotes] = useState<SellerCallNote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerFilterId, setSellerFilterId] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const filtersRef = useRef({ sellerFilterId, search, startDate, endDate });

  useEffect(() => {
    filtersRef.current = { sellerFilterId, search, startDate, endDate };
  }, [sellerFilterId, search, startDate, endDate]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<SellerCallNote | null>(null);
  const [formState, setFormState] = useState({ appointmentId: '', title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const [noteToDelete, setNoteToDelete] = useState<SellerCallNote | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canGoPrevious = page > 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canGoNext = page < totalPages;

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
    setAppointmentsLoading(true);
    try {
      const { data } = await api.get<{ data: Appointment[] }>('/appointments', { params: { page: 1, limit: 100 } });
      setAppointments(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  const fetchNotes = useCallback(async (targetPage = page, customFilters = filtersRef.current) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        page: targetPage,
        limit,
        search: customFilters.search || undefined,
        start: customFilters.startDate || undefined,
        end: customFilters.endDate || undefined
      };
      if (!isSeller && customFilters.sellerFilterId) {
        params.sellerId = customFilters.sellerFilterId;
      }
      const { data } = await api.get<NotesResponse>('/seller-notes', { params });
      setNotes(Array.isArray(data?.data) ? data.data : []);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
      setPage(typeof data?.page === 'number' ? data.page : targetPage);
    } catch {
      setNotes([]);
      setTotal(0);
      setError('Nao foi possivel carregar as notas.');
    } finally {
      setLoading(false);
    }
  }, [isSeller, limit, page]);

  useEffect(() => {
    void fetchSellers();
    void fetchAppointments();
    void fetchNotes(1);
  }, [fetchAppointments, fetchNotes, fetchSellers]);

  useEffect(() => {
    const t = window.setTimeout(() => void fetchNotes(1), 400);
    return () => window.clearTimeout(t);
  }, [fetchNotes, search, startDate, endDate, sellerFilterId]);

  const openCreateModal = () => {
    setEditingNote(null);
    setFormState({ appointmentId: appointments[0]?.id ?? '', title: '', content: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (note: SellerCallNote) => {
    setEditingNote(note);
    setFormState({ appointmentId: note.appointmentId ?? '', title: note.title ?? '', content: note.content ?? '' });
    setIsModalOpen(true);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!formState.appointmentId) return;
    if (!formState.content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingNote) {
        await api.patch(`/seller-notes/${editingNote.id}`, {
          title: formState.title || null,
          content: formState.content
        });
      } else {
        await api.post('/seller-notes', {
          appointmentId: formState.appointmentId,
          title: formState.title || null,
          content: formState.content
        });
      }
      setIsModalOpen(false);
      await fetchNotes(1);
    } catch {
      setError('Nao foi possivel salvar a nota.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (note: SellerCallNote) => setNoteToDelete(note);

  const handleDelete = async () => {
    if (!noteToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/seller-notes/${noteToDelete.id}`);
      setNoteToDelete(null);
      await fetchNotes(1);
    } catch {
      setError('Nao foi possivel remover a nota.');
    } finally {
      setDeleting(false);
    }
  };

  const appointmentLabel = useCallback((a: Appointment) => {
    const lead = a.lead?.name ?? a.lead?.email ?? 'Lead';
    return `${lead} • ${formatDateTime(a.start)}`;
  }, []);

  const appointmentsMap = useMemo(() => {
    const map = new Map<string, Appointment>();
    appointments.forEach((a) => map.set(a.id, a));
    return map;
  }, [appointments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Notas Seller</h1>
          <p className="text-sm text-gray-500">
            {isSeller ? 'Crie notas sobre suas calls vinculadas.' : 'Veja as notas dos vendedores e registre notas da empresa.'}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          Nova nota
        </button>
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
              placeholder="Conteudo da nota"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
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
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nenhuma nota encontrada.
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow">
          <div className="block xl:hidden divide-y divide-gray-100">
            {notes.map((note) => {
              const appointment = note.appointment ?? (note.appointmentId ? appointmentsMap.get(note.appointmentId) : undefined) ?? null;
              const sellerName = note.seller?.name ?? (isSeller ? seller?.name : note.sellerId ? 'Vendedor' : 'Empresa');
              const canManage = isSeller || !note.sellerId;
              return (
                <div key={note.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{note.title?.trim() || 'Nota'}</p>
                      <p className="truncate text-xs text-gray-500">{sellerName}</p>
                    </div>
                    {appointment ? <StatusBadge value={appointment.status} /> : null}
                  </div>

                  {appointment ? (
                    <div className="grid gap-1 text-xs text-gray-600">
                      <p className="truncate">
                        <span className="font-semibold text-gray-500">Call:</span> {appointmentLabel(appointment)}
                      </p>
                      <p className="truncate">
                        <span className="font-semibold text-gray-500">Lead:</span>{' '}
                        {appointment.lead?.name ?? appointment.lead?.email ?? 'Lead'}
                      </p>
                    </div>
                  ) : null}

                  <p className="whitespace-pre-wrap text-sm text-gray-700">{note.content}</p>

                  <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
                    <span>Atualizado: {formatDateTime(note.updatedAt)}</span>
                    {appointment?.meetLink ? (
                      <a href={appointment.meetLink} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
                        Abrir link
                      </a>
                    ) : null}
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openEditModal(note)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => confirmDelete(note)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Remover
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="hidden xl:block">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3">Titulo</th>
                  <th className="px-6 py-3">Vendedor</th>
                  <th className="px-6 py-3">Call</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Atualizado</th>
                  <th className="px-6 py-3">Nota</th>
                  <th className="px-6 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {notes.map((note) => {
                  const appointment = note.appointment ?? (note.appointmentId ? appointmentsMap.get(note.appointmentId) : undefined) ?? null;
                  const canManage = isSeller || !note.sellerId;
                  return (
                    <tr key={note.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{note.title?.trim() || 'Nota'}</p>
                        <p className="text-xs text-gray-500">{note.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">
                          {note.seller?.name ?? (isSeller ? seller?.name : note.sellerId ? 'Vendedor' : 'Empresa')}
                        </p>
                        <p className="text-xs text-gray-500">{note.seller?.email ?? '--'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {appointment ? (
                          <>
                            <p className="max-w-[280px] truncate font-semibold text-gray-900">{appointmentLabel(appointment)}</p>
                            <p className="max-w-[280px] truncate text-xs text-gray-500">
                              {appointment.lead?.name ?? appointment.lead?.email ?? 'Lead'}
                            </p>
                          </>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="px-6 py-4">{appointment ? <StatusBadge value={appointment.status} /> : '--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(note.updatedAt)}</td>
                      <td className="px-6 py-4">
                        <p className="max-w-[520px] whitespace-pre-wrap text-sm text-gray-700">{note.content}</p>
                      </td>
                      {canManage ? (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditModal(note)}
                              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => confirmDelete(note)}
                              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td className="px-6 py-4 text-right text-xs text-gray-400">--</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:text-sm">
        <p>{`Exibindo ${notes.length} de ${total} notas`}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canGoPrevious && void fetchNotes(page - 1)}
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
            onClick={() => canGoNext && void fetchNotes(page + 1)}
            disabled={!canGoNext || loading}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proxima
          </button>
        </div>
      </div>

      <Modal
        title={editingNote ? 'Editar nota' : 'Nova nota'}
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
        ) : !appointments.length ? (
          <p className="text-sm text-gray-500">Nenhuma call vinculada para registrar nota.</p>
        ) : (
          <form onSubmit={handleSave} className="grid gap-4">
            <label className="text-sm">
              Call
              <select
                value={formState.appointmentId}
                onChange={(e) => setFormState((prev) => ({ ...prev, appointmentId: e.target.value }))}
                disabled={!!editingNote}
                className={clsx(
                  'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none',
                  editingNote && 'bg-gray-50'
                )}
              >
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {appointmentLabel(a)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Titulo
              <input
                value={formState.title}
                onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Opcional"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
              />
            </label>

            <label className="text-sm">
              Nota
              <textarea
                value={formState.content}
                onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
                rows={6}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={saving || !formState.content.trim()}
              className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={noteToDelete !== null}
        title="Remover nota"
        description={noteToDelete ? <p>Deseja realmente remover esta nota? Essa acao nao pode ser desfeita.</p> : null}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        tone="danger"
        isConfirmLoading={deleting}
        onCancel={() => (deleting ? null : setNoteToDelete(null))}
        onConfirm={handleDelete}
      />
    </div>
  );
}
