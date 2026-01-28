'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import api from '../../../lib/api';
import { MetricCard } from '../../../components/MetricCard';
import { Loading } from '../../../components/Loading';
import { DashboardResponse, DashboardSeriesResponse } from '../../../types';

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

const stageColors: Record<string, string> = {
  NOVO: '#94a3b8',
  AGENDOU_CALL: '#d4b26e',
  ENTROU_CALL: '#6366f1',
  COMPROU: '#10b981',
  NO_SHOW: '#f43f5e'
};

const formatShortDate = (date: string) => {
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) {
    return date;
  }
  return `${d}/${m}`;
};

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayInSaoPaulo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [series, setSeries] = useState<DashboardSeriesResponse | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashboardRes, seriesRes] = await Promise.all([
        api.get<DashboardResponse>('/reports/dashboard', {
          params: {
            date: selectedDate
          }
        }),
        api.get<DashboardSeriesResponse>('/reports/dashboard/series', {
          params: {
            endDate: selectedDate,
            days: 7
          }
        })
      ]);
      setDashboard(dashboardRes.data);
      setSeries(seriesRes.data);
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

  const chartData = useMemo(() => {
    return (series?.series ?? []).map((day) => {
      const counts = day.statuses.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {});

      return {
        label: formatShortDate(day.date),
        totalLeads: day.totalLeads,
        ...counts
      };
    });
  }, [series]);

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
            <h2 className="text-lg font-semibold text-slate-900">Conversao por canal</h2>
            <p className="text-xs text-gray-500">Compare o funil de WhatsApp vs Instagram no dia selecionado.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(dashboard?.sourceFunnels ?? []).map((funnel) => (
            <div key={funnel.source} className="rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{funnel.source}</p>
                  <p className="mt-1 text-xs text-gray-500">Total de leads: {funnel.totalLeads}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Comprou / Novo</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{funnel.conversion.comprouFromNovo}%</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Etapa</th>
                      <th className="w-20 px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Qtd</th>
                      <th className="w-20 px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {funnel.stages.map((item) => (
                      <tr key={item.stage} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-700">
                          {stageLabels[item.stage] ?? item.stage}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900">{item.count}</td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">{item.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Agendou / Novo</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{funnel.conversion.agendouFromNovo}%</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Entrou / Agendou</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{funnel.conversion.entrouFromAgendou}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Comparativo por dia</h2>
            <p className="text-xs text-gray-500">Ultimos {series?.days ?? 7} dias ate a data selecionada.</p>
          </div>
        </div>

        {!chartData.length ? (
          <p className="mt-4 text-sm text-gray-500">Sem dados para o periodo.</p>
        ) : (
          <div className="mt-6">
            <div className="mt-4 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip
                    formatter={(value: unknown, name: string) => [value as number, stageLabels[name] ?? name]}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <Legend
                    formatter={(value: string) => stageLabels[value] ?? value}
                    wrapperStyle={{ fontSize: 12, color: '#475569' }}
                  />
                  <Bar dataKey="NOVO" stackId="a" fill={stageColors.NOVO} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="AGENDOU_CALL" stackId="a" fill={stageColors.AGENDOU_CALL} />
                  <Bar dataKey="ENTROU_CALL" stackId="a" fill={stageColors.ENTROU_CALL} />
                  <Bar dataKey="COMPROU" stackId="a" fill={stageColors.COMPROU} />
                  <Bar dataKey="NO_SHOW" stackId="a" fill={stageColors.NO_SHOW} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
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
