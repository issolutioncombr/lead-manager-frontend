'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import api from '../../../../lib/api';
import { AppointmentBySellerReportRow, Seller } from '../../../../types';
import { StatusBadge } from '../../../../components/StatusBadge';
import { Loading } from '../../../../components/Loading';

type ReportFilters = {
  start?: string;
  end?: string;
  sellerId?: string;
  status?: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function SellerAppointmentsReportPage() {
  const [rows, setRows] = useState<AppointmentBySellerReportRow[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchSellers = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Seller[] }>('/sellers', { params: { page: 1, limit: 100 } });
      setSellers(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setSellers([]);
    }
  }, []);

  const fetchReport = useCallback(async (customFilters: ReportFilters = filtersRef.current) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<AppointmentBySellerReportRow[]>('/reports/appointments-by-seller', { params: customFilters });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      setError('Nao foi possivel carregar o relatorio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSellers();
    void fetchReport();
  }, [fetchReport, fetchSellers]);

  const totalRows = rows.length;

  const sellersMap = useMemo(() => {
    const map = new Map<string, Seller>();
    sellers.forEach((s) => map.set(s.id, s));
    return map;
  }, [sellers]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((r) => values.add(r.appointment.status));
    return Array.from(values).sort();
  }, [rows]);

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    filtersRef.current = next;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Calls por vendedor</h1>
          <p className="text-sm text-gray-500">Relatorio de video chamadas, com status e notas por vendedor.</p>
        </div>
        <button
          onClick={() => void fetchReport(filters)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
        >
          Atualizar
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-gray-600">
            Inicio
            <input
              type="date"
              value={filters.start ?? ''}
              onChange={(e) => handleFilterChange('start', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Fim
            <input
              type="date"
              value={filters.end ?? ''}
              onChange={(e) => handleFilterChange('end', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="min-w-[220px] flex-1 text-xs font-semibold text-gray-600">
            Vendedor
            <select
              value={filters.sellerId ?? ''}
              onChange={(e) => handleFilterChange('sellerId', e.target.value)}
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
          <label className="min-w-[220px] text-xs font-semibold text-gray-600">
            Status
            <select
              value={filters.status ?? ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Todos</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-10">
          <Loading />
        </div>
      ) : totalRows === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum registro encontrado para os filtros aplicados.
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow">
          <div className="block xl:hidden divide-y divide-gray-100">
            {rows.map((row) => (
              <div key={`${row.sellerId}-${row.appointment.id}`} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {sellersMap.get(row.sellerId)?.name ?? row.sellerName}
                    </p>
                    <p className="truncate text-xs text-gray-500">{row.sellerEmail ?? '--'}</p>
                  </div>
                  <StatusBadge value={row.appointment.status} />
                </div>
                <div className="grid gap-1 text-xs text-gray-600">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-500">Lead</span>
                    <span className="truncate">{row.appointment.lead?.name ?? row.appointment.lead?.email ?? 'Lead'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-500">Inicio</span>
                    <span className="whitespace-nowrap">{formatDateTime(row.appointment.start)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-500">Fim</span>
                    <span className="whitespace-nowrap">{formatDateTime(row.appointment.end)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-500">Notas</span>
                    <span className="whitespace-nowrap">{row.notesCount}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  {row.appointment.meetLink ? (
                    <a
                      className="truncate text-xs font-semibold text-primary underline"
                      href={row.appointment.meetLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir link
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Sem link</span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    Ultima nota: {row.lastNoteUpdatedAt ? formatDateTime(row.lastNoteUpdatedAt) : '--'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden xl:block">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3">Vendedor</th>
                  <th className="px-6 py-3">Lead</th>
                  <th className="px-6 py-3">Inicio</th>
                  <th className="px-6 py-3">Fim</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Notas</th>
                  <th className="px-6 py-3">Ultima nota</th>
                  <th className="px-6 py-3">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {rows.map((row) => (
                  <tr key={`${row.sellerId}-${row.appointment.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{sellersMap.get(row.sellerId)?.name ?? row.sellerName}</p>
                      <p className="text-xs text-gray-500">{row.sellerEmail ?? '--'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="max-w-[260px] truncate font-semibold text-gray-900">
                        {row.appointment.lead?.name ?? row.appointment.lead?.email ?? 'Lead'}
                      </p>
                      <p className="max-w-[260px] truncate text-xs text-gray-500">{row.appointment.lead?.contact ?? '--'}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(row.appointment.start)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(row.appointment.end)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge value={row.appointment.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{row.notesCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {row.lastNoteUpdatedAt ? formatDateTime(row.lastNoteUpdatedAt) : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {row.appointment.meetLink ? (
                        <a href={row.appointment.meetLink} target="_blank" rel="noreferrer" className="text-primary underline">
                          Abrir link
                        </a>
                      ) : (
                        '--'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={clsx('text-sm text-gray-500', loading && 'opacity-60')}>{totalRows} registro(s)</div>
    </div>
  );
}

