'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';

type PhoneInstance = {
  id: string;
  phoneRaw: string;
  instanceId: string;
  providerInstanceId?: string | null;
  botStatus?: 'ATIVO' | 'PAUSADO' | 'TRAVADO' | null;
  botTravarAt?: string | null;
  botPausarAt?: string | null;
  botReativarAt?: string | null;
  botWebhookConfigId?: string | null;
};

type WebhookConfig = {
  id: string;
  origin: string;
  url: string;
  active: boolean;
};

export default function PhoneInstancesPage() {
  const [items, setItems] = useState<PhoneInstance[]>([]);
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatPhone = (raw?: string | null) => {
    if (!raw) return '';
    const d = raw.replace(/\D+/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return raw;
  };

  const groupByStatus = useMemo(() => {
    const g: Record<string, PhoneInstance[]> = { ATIVO: [], PAUSADO: [], TRAVADO: [], UNKNOWN: [] };
    items.forEach((it) => {
      const s = it.botStatus ?? 'UNKNOWN';
      (g[s] ?? (g[s] = [])).push(it);
    });
    return g;
  }, [items]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await api.get<PhoneInstance[]>('/phone-instances');
      setItems(resp.data);
      const cfg = await api.get<WebhookConfig[]>('/webhook-configs', { params: { origin: 'bot-control' } });
      setConfigs(cfg.data);
    } catch (e) {
      setError('Falha ao carregar instâncias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const perform = async (id: string, action: 'travar' | 'pausar' | 'reativar') => {
    try {
      setError(null);
      await api.post(`/phone-instances/${id}/bot/action`, { action });
      await load();
    } catch {
      setError('Falha ao executar ação');
    }
  };

  const linkConfig = async (id: string, botWebhookConfigId: string | null) => {
    try {
      setError(null);
      await api.patch(`/phone-instances/${id}`, { botWebhookConfigId });
      await load();
    } catch {
      setError('Falha ao vincular webhook');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Instâncias WhatsApp</h1>
        <p className="text-sm text-gray-500">Controle do bot e vinculação de webhooks.</p>
      </div>
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {['ATIVO', 'PAUSADO', 'TRAVADO', 'UNKNOWN'].map((status) => (
            <div key={status}>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">{status}</h2>
              <div className="divide-y rounded border bg-white">
                {groupByStatus[status]?.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{formatPhone(it.phoneRaw)}</p>
                      <p className="truncate text-xs text-gray-500">{it.instanceId}</p>
                      <p className="truncate text-xs text-gray-400">
                        Vinculado:{' '}
                        {it.botWebhookConfigId
                          ? configs.find((c) => c.id === it.botWebhookConfigId)?.url ?? it.botWebhookConfigId
                          : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => perform(it.id, 'travar')}
                        className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                      >
                        Travar bot
                      </button>
                      <button
                        onClick={() => perform(it.id, 'pausar')}
                        className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                      >
                        Pausar bot
                      </button>
                      <button
                        onClick={() => perform(it.id, 'reativar')}
                        className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                      >
                        Reativar bot
                      </button>
                      <select
                        value={it.botWebhookConfigId ?? ''}
                        onChange={(e) => linkConfig(it.id, e.target.value || null)}
                        className="rounded-md border px-2 py-1 text-xs"
                      >
                        <option value="">Webhook (bot-control)</option>
                        {configs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.url}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
