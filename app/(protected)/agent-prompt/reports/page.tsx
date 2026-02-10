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

export default function PromptReportsPage() {
  const router = useRouter();
  const { seller, loading: authLoading } = useAuth();
  const [instances, setInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [instanceId, setInstanceId] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [phoneRaw, setPhoneRaw] = useState<string>('');
  const [rows, setRows] = useState<ReportRow[]>([]);
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

  const totals = useMemo(() => {
    const totalEvents = rows.reduce((acc, r) => acc + (Number(r.events) || 0), 0);
    const totalDestinations = rows.reduce((acc, r) => acc + (Number(r.destinations) || 0), 0);
    return { totalEvents, totalDestinations };
  }, [rows]);

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
      const resp = await api.get<{ data: ReportRow[] }>('/agent-prompt/reports/dispatches', {
        params: {
          instanceId,
          from,
          to,
          phoneRaw: phoneRaw.trim() || undefined
        }
      });
      const data = Array.isArray((resp.data as any).data) ? ((resp.data as any).data as ReportRow[]) : [];
      setRows(data);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      const m = typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : null;
      setError(m ? `${m}${status ? ` (HTTP ${status})` : ''}` : 'Não foi possível gerar o relatório.');
      setRows([]);
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

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Total envios: <span className="font-semibold">{totals.totalEvents}</span> • Destinos (soma por linha):{' '}
            <span className="font-semibold">{totals.totalDestinations}</span>
          </div>
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

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm font-semibold text-slate-900">Resultados</div>
        {rows.length === 0 ? (
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
                {rows.map((r, idx) => (
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

