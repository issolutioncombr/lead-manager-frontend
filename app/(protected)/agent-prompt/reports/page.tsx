'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';

type ReportRow = {
  evolutionInstanceId: string;
  agentPromptId: string | null;
  promptName: string | null;
  assignedBy: string;
  events: number;
  destinations: number;
};

type DailyRow = ReportRow & { day: string };

export default function PromptReportsPage() {
  const router = useRouter();
  const { seller, loading: authLoading } = useAuth();
  const [instances, setInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [instanceId, setInstanceId] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [phoneRaw, setPhoneRaw] = useState<string>('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [assignedByFilter, setAssignedByFilter] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (seller) {
      router.replace('/dashboard');
      return;
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setFrom((v) => v || weekAgo);
    setTo((v) => v || today);
  }, [authLoading, seller, router]);

  useEffect(() => {
    if (authLoading || seller) return;
    let mounted = true;
    api
      .get('/integrations/evolution/instances/list')
      .then((resp) => {
        const list = Array.isArray(resp.data) ? resp.data : [];
        const mapped = list
          .map((x: any) => ({
            id: (x.providerInstanceId ?? x.instanceId ?? '').toString(),
            name: (x.number ?? x.name ?? x.instanceId ?? 'Instância').toString()
          }))
          .filter((x: any) => typeof x.id === 'string' && x.id.length > 0);
        if (!mounted) return;
        setInstances(mapped);
        if (mapped.length) setInstanceId((prev) => prev || mapped[0].id);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Não foi possível carregar as instâncias.');
      });
    return () => {
      mounted = false;
    };
  }, [authLoading, seller]);

  const assignedByOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.assignedBy);
    for (const r of dailyRows) set.add(r.assignedBy);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dailyRows, rows]);

  useEffect(() => {
    if (!assignedByOptions.length) return;
    setAssignedByFilter((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of assignedByOptions) {
        if (next[k] === undefined) {
          next[k] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [assignedByOptions]);

  const activeAssignedBy = useMemo(() => {
    const selected = Object.entries(assignedByFilter)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
    const set = new Set(selected);
    return { list: selected, set, hasFilter: selected.length > 0 };
  }, [assignedByFilter]);

  const filteredRows = useMemo(() => {
    if (!activeAssignedBy.hasFilter) return rows;
    return rows.filter((r) => activeAssignedBy.set.has(r.assignedBy));
  }, [activeAssignedBy, rows]);

  const filteredDailyRows = useMemo(() => {
    if (!activeAssignedBy.hasFilter) return dailyRows;
    return dailyRows.filter((r) => activeAssignedBy.set.has(r.assignedBy));
  }, [activeAssignedBy, dailyRows]);

  const totals = useMemo(() => {
    const totalEvents = filteredRows.reduce((acc, r) => acc + (Number(r.events) || 0), 0);
    const totalDestinations = filteredRows.reduce((acc, r) => acc + (Number(r.destinations) || 0), 0);
    return { totalEvents, totalDestinations };
  }, [filteredRows]);

  const dailyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredDailyRows) {
      map.set(r.day, (map.get(r.day) ?? 0) + (Number(r.events) || 0));
    }
    const days = Array.from(map.keys()).sort();
    const series = days.map((day) => ({ day, events: map.get(day) ?? 0 }));
    const max = series.reduce((m, s) => Math.max(m, s.events), 0);
    return { series, max };
  }, [filteredDailyRows]);

  const downloadCsv = (filename: string, headers: string[], lines: Array<Array<string | number | null>>) => {
    const esc = (v: string | number | null) => {
      const s = v === null || v === undefined ? '' : String(v);
      const needs = /[",\n]/.test(s);
      const out = s.replace(/"/g, '""');
      return needs ? `"${out}"` : out;
    };
    const content = [headers.map(esc).join(','), ...lines.map((l) => l.map(esc).join(','))].join('\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const runReport = async () => {
    if (!instanceId) {
      setError('Selecione uma instância.');
      return;
    }
    if (!from || !to) {
      setError('Selecione o período (de/até).');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [summaryResp, dailyResp] = await Promise.all([
        api.get<{ data: ReportRow[] }>('/agent-prompt/reports/dispatches', {
          params: {
            instanceId,
            from,
            to,
            phoneRaw: phoneRaw.trim() || undefined
          }
        }),
        api.get<{ data: DailyRow[] }>('/agent-prompt/reports/dispatches/daily', {
          params: {
            instanceId,
            from,
            to,
            phoneRaw: phoneRaw.trim() || undefined
          }
        })
      ]);
      const summaryData = Array.isArray((summaryResp.data as any).data) ? ((summaryResp.data as any).data as ReportRow[]) : [];
      const dailyData = Array.isArray((dailyResp.data as any).data) ? ((dailyResp.data as any).data as DailyRow[]) : [];
      setRows(summaryData);
      setDailyRows(dailyData);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      const m = typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : null;
      setError(m ? `${m}${status ? ` (HTTP ${status})` : ''}` : 'Não foi possível gerar o relatório.');
      setRows([]);
      setDailyRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || seller) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Relatórios Prompt</h1>
        <p className="text-sm text-gray-500">Resumo de envios por prompt (origem + destino) no período.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <div className="space-y-4 rounded-lg border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="block text-sm font-medium text-gray-700">
            Instância
            <select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
              disabled={isLoading || instances.length === 0}
            >
              {instances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            De
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
              disabled={isLoading}
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
              disabled={isLoading}
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Destino (opcional)
            <input
              value={phoneRaw}
              onChange={(e) => setPhoneRaw(e.target.value)}
              placeholder="5511999999999"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
              disabled={isLoading}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-600">
            Total envios: <span className="font-semibold">{totals.totalEvents}</span> • Destinos (soma por linha):{' '}
            <span className="font-semibold">{totals.totalDestinations}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const lines = filteredRows.map((r) => [
                  r.promptName ?? (r.agentPromptId ? 'Sem nome' : 'Legado'),
                  r.agentPromptId ?? '',
                  r.assignedBy,
                  r.events,
                  r.destinations
                ]);
                downloadCsv(`relatorio-prompts-resumo-${from}-a-${to}.csv`, ['prompt', 'prompt_id', 'assigned_by', 'envios', 'destinos'], lines);
              }}
              disabled={isLoading || filteredRows.length === 0}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Exportar CSV (resumo)
            </button>
            <button
              type="button"
              onClick={() => {
                const lines = filteredDailyRows.map((r) => [
                  r.day,
                  r.promptName ?? (r.agentPromptId ? 'Sem nome' : 'Legado'),
                  r.agentPromptId ?? '',
                  r.assignedBy,
                  r.events,
                  r.destinations
                ]);
                downloadCsv(`relatorio-prompts-diario-${from}-a-${to}.csv`, ['dia', 'prompt', 'prompt_id', 'assigned_by', 'envios', 'destinos'], lines);
              }}
              disabled={isLoading || filteredDailyRows.length === 0}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Exportar CSV (diário)
            </button>
            <button
              type="button"
              onClick={runReport}
              disabled={isLoading || !instanceId}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {isLoading ? 'Gerando...' : 'Gerar relatório'}
            </button>
          </div>
        </div>

        {assignedByOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <span className="text-xs font-semibold uppercase text-gray-500">Filtro de atribuição</span>
            {assignedByOptions.map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={assignedByFilter[k] !== false}
                  onChange={(e) => setAssignedByFilter((prev) => ({ ...prev, [k]: e.target.checked }))}
                />
                <span className="rounded-full border px-2 py-0.5 text-xs">{k}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900">Envios por dia</div>
        {dailyTotals.series.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhum dado diário para o período selecionado.</div>
        ) : (
          <div className="flex items-end gap-1 overflow-x-auto pb-2">
            {dailyTotals.series.map((p) => {
              const h = dailyTotals.max > 0 ? Math.round((p.events / dailyTotals.max) * 120) : 0;
              return (
                <div key={p.day} className="flex w-10 flex-col items-center justify-end">
                  <div
                    title={`${p.day}: ${p.events} envios`}
                    className="w-8 rounded-md bg-primary/70"
                    style={{ height: `${h}px` }}
                  />
                  <div className="mt-1 text-[10px] text-gray-500">{p.day.slice(5)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm font-semibold text-slate-900">Resultados</div>
        {filteredRows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">Nenhum dado para o período selecionado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Prompt</th>
                  <th className="px-4 py-3">Atribuição</th>
                  <th className="px-4 py-3">Envios</th>
                  <th className="px-4 py-3">Destinos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((r, idx) => (
                  <tr key={`${r.evolutionInstanceId}:${r.agentPromptId ?? 'null'}:${r.assignedBy}:${idx}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{r.promptName ?? (r.agentPromptId ? 'Sem nome' : 'Legado')}</div>
                      <div className="text-xs text-gray-500">{r.agentPromptId ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border px-2 py-1 text-xs">{r.assignedBy}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.events}</td>
                    <td className="px-4 py-3 font-semibold">{r.destinations}</td>
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
