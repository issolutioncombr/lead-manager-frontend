'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';

type BotButton = {
  id: string;
  name: string;
  variable: string;
  url: string;
  active: boolean;
};
type WebhookConfig = { id: string; url: string; origin: string; active: boolean };

const DEFAULTS: Array<Pick<BotButton, 'name' | 'variable'>> = [
  { name: 'Travar Bot', variable: 'TRAVAR' },
  { name: 'Pausar Bot', variable: 'PAUSAR' },
  { name: 'Reativar Bot', variable: 'REATIVAR' },
  { name: 'Ativar Bot', variable: 'ATIVAR' }
];

export default function BotButtonsPage() {
  const [items, setItems] = useState<BotButton[]>([]);
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [form, setForm] = useState<BotButton | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [btnResp, cfgBotResp, cfgManResp] = await Promise.all([
        api.get<BotButton[]>('/bot-buttons', { params: { active: activeOnly } }),
        api.get<WebhookConfig[]>('/webhook-configs', { params: { origin: 'bot-control' } }),
        api.get<WebhookConfig[]>('/webhook-configs', { params: { origin: 'manual' } })
      ]);
      setItems(btnResp.data);
      setConfigs([...cfgBotResp.data, ...cfgManResp.data].filter((c) => c.active));
    } catch {
      setError('Falha ao carregar botões');
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (form?.id) {
        await api.patch(`/bot-buttons/${form.id}`, {
          name: form.name,
          variable: form.variable,
          url: form.url,
          active: form.active
        });
      } else {
        await api.post('/bot-buttons', {
          name: form?.name,
          variable: form?.variable,
          url: form?.url,
          active: form?.active ?? true
        });
      }
      setForm(null);
      await load();
    } catch {
      setError('Falha ao salvar botão');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/bot-buttons/${id}`);
      await load();
    } catch {
      setError('Falha ao remover botão');
    }
  };

  const missingDefaults = useMemo(() => {
    const set = new Set(items.map((i) => i.variable));
    return DEFAULTS.filter((d) => !set.has(d.variable));
  }, [items]);

  const createDefault = async (d: { name: string; variable: string }) => {
    setForm({ id: '', name: d.name, variable: d.variable, url: '', active: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Botões</h1>
        <p className="text-sm text-gray-500">Cadastre botões com nome, variável e URL do webhook (N8N).</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Mostrar apenas ativos
        </label>
        <button
          onClick={() => setForm({ id: '', name: '', variable: '', url: '', active: true })}
          className="ml-auto rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
        >
          Novo botão
        </button>
      </div>

      {missingDefaults.length > 0 && (
        <div className="rounded border bg-white p-3">
          <p className="text-xs text-gray-600">Criar padrões rapidamente:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingDefaults.map((d) => (
              <button
                key={d.variable}
                onClick={() => createDefault(d)}
                className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="divide-y rounded border bg-white">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{it.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {it.variable} • {it.active ? 'ativo' : 'inativo'}
                </p>
                <p className="truncate text-xs text-gray-400">{it.url}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setForm(it)}
                  className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(it.id)}
                  className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded border bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Nome</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Travar Bot"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Variável</label>
              <input
                value={form.variable}
                onChange={(e) => setForm({ ...form, variable: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="TRAVAR"
              />
            </div>
          </div>
              <div>
                <label className="text-xs text-gray-500">Usar webhook existente</label>
                <select
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      const found = configs.find((c) => c.id === v);
                      if (found) setForm({ ...form, url: found.url });
                    }
                  }}
                  className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                >
                  <option value="">— selecione (opcional) —</option>
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.url} ({c.origin})
                    </option>
                  ))}
                </select>
              </div>
          <div>
            <label className="text-xs text-gray-500">URL do Webhook (N8N)</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="https://n8n.example/webhook/..."
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Ativo</label>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
            >
              Salvar
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-md border px-3 py-2 text-xs">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
