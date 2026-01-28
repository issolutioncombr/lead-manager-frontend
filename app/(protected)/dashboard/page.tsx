'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../../../lib/api';
import { MetricCard } from '../../../components/MetricCard';
import { Loading } from '../../../components/Loading';
import { DashboardResponse } from '../../../types';

const getTodayInSaoPaulo = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

const stageLabels: Record<string, string> = {
  NOVO: 'Novo',
  AGENDOU_CALL: 'Agendou uma call',
  ENTROU_CALL: 'Entrou na call',
  COMPROU: 'Comprou',
  NO_SHOW: 'Nao compareceu'
};

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayInSaoPaulo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<DashboardResponse>('/reports/dashboard', {
        params: {
          date: selectedDate
        }
      });
      setDashboard(res.data);
    } catch (e) {
      console.error(e);
      setError('Nao foi possivel carregar os dados do dashboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const statusCards = useMemo(() => {
    return (dashboard?.top5Statuses ?? []).map((item) => ({
      key: item.status,
      label: stageLabels[item.status] ?? item.status,
      value: item.count,
      helper:
        dashboard?.totalLeads && typeof item.percent === 'number'
          ? `${item.percent}% do total`
          : undefined
    }));
  }, [dashboard]);

  const topOrigins = useMemo(() => (dashboard?.origins ?? []).slice(0, 10), [dashboard]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Visao do dia selecionado.</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filtro por data</h2>
            <p className="text-xs text-gray-500">Padrao: hoje.</p>
          </div>

          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Data</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-primary"
              />
            </label>

            <button
              type="button"
              onClick={() => void fetchDashboard()}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        {statusCards.map((card) => (
          <MetricCard
            key={card.key}
            label={card.label}
            value={card.value}
            helper={card.helper}
            accent={card.value ? 'green' : 'gray'}
          />
        ))}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Origem dos leads</h2>
            <p className="text-xs text-gray-500">Ranking por volume no dia selecionado.</p>
          </div>
          <MetricCard label="Total de leads" value={dashboard?.totalLeads ?? 0} accent="gray" />
        </div>

        {topOrigins.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Sem leads para a data selecionada.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Origem</th>
                  <th className="w-32 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Quantidade</th>
                  <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topOrigins.map((item) => (
                  <tr key={item.origin} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{item.origin}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{item.count}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{item.percent ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
