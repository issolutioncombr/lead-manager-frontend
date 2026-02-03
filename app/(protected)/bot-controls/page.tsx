'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';

type BotButton = { id: string; name: string; variable: string; url: string; active: boolean };
type WebhookConfig = { id: string; origin: string; url: string; headers?: Record<string, unknown> | null; active: boolean };

const DEFAULTS: Array<Pick<BotButton, 'name' | 'variable'>> = [
  { name: 'Travar Bot', variable: 'TRAVAR' },
  { name: 'Pausar Bot', variable: 'PAUSAR' },
  { name: 'Reativar Bot', variable: 'REATIVAR' },
  { name: 'Ativar Bot', variable: 'ATIVAR' }
];

export default function BotControlsPage() {
  const [buttons, setButtons] = useState<BotButton[]>([]);
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [origin, setOrigin] = useState('bot-control');
  const [activeOnly, setActiveOnly] = useState(true);
  const [btnForm, setBtnForm] = useState<BotButton | null>(null);
  const [cfgForm, setCfgForm] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [btnResp, cfgResp] = await Promise.all([
        api.get<BotButton[]>('/bot-buttons', { params: { active: activeOnly } }),
        api.get<WebhookConfig[]>('/webhook-configs', { params: { origin } })
      ]);
      setButtons(btnResp.data);
      setConfigs(cfgResp.data);
    } catch {
      setError('Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [activeOnly, origin]);

  useEffect(() => {
    load();
  }, [load]);

  const missingDefaults = useMemo(() => {
    const set = new Set(buttons.map((i) => i.variable));
    return DEFAULTS.filter((d) => !set.has(d.variable));
  }, [buttons]);

  const submitButton = async (e: FormEvent) => {
    e.preventDefault();
    if (!btnForm?.url || !btnForm.name || !btnForm.variable) {
      setError('Preencha nome, variável e URL do webhook');
      return;
    }
    try {
      setError(null);
      if (btnForm.id) {
        await api.patch(`/bot-buttons/${btnForm.id}`, {
          name: btnForm.name,
          variable: btnForm.variable,
          url: btnForm.url,
          active: btnForm.active
        });
      } else {
        await api.post('/bot-buttons', {
          name: btnForm.name,
          variable: btnForm.variable,
          url: btnForm.url,
          active: btnForm.active ?? true
        });
      }
      setBtnForm(null);
      await load();
    } catch {
      setError('Falha ao salvar botão');
    }
  };

  const deleteButton = async (id: string) => {
    try {
      await api.delete(`/bot-buttons/${id}`);
      await load();
    } catch {
      setError('Falha ao remover botão');
    }
  };

  const submitConfig = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (cfgForm?.id) {
        await api.patch(`/webhook-configs/${cfgForm.id}`, {
          origin: cfgForm.origin,
          url: cfgForm.url,
          headers: cfgForm.headers ?? null,
          active: cfgForm.active
        });
      } else {
        await api.post('/webhook-configs', {
          origin,
          url: cfgForm?.url,
          headers: cfgForm?.headers ?? null,
          active: cfgForm?.active ?? true
        });
      }
      setCfgForm(null);
      await load();
    } catch {
      setError('Falha ao salvar webhook');
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      await api.delete(`/webhook-configs/${id}`);
      await load();
    } catch {
      setError('Falha ao remover webhook');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Botões e Webhooks</h1>
          <p className="text-sm text-gray-500">Gerencie botões (com URL obrigatória) e cadastre webhooks independentes.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Mostrar apenas botões ativos
        </label>
      </div>

      {missingDefaults.length > 0 && (
        <div className="rounded border bg-white p-3">
          <p className="text-xs text-gray-600">Criar padrões rapidamente:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingDefaults.map((d) => (
              <button
                key={d.variable}
                onClick={() => setBtnForm({ id: '', name: d.name, variable: d.variable, url: '', active: true })}
                className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-6">
        {/* Botões */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Botões</h2>
            <button
              onClick={() => setBtnForm({ id: '', name: '', variable: '', url: '', active: true })}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
            >
              Novo botão
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded bg-gray-200" />
              ))}
            </div>
          ) : (
            <div className="divide-y rounded border bg-white">
              {buttons.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{it.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {it.variable} • {it.active ? 'ativo' : 'inativo'}
                    </p>
                    <p className="truncate text-xs text-gray-400">{it.url}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setBtnForm(it)} className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50">
                      Editar
                    </button>
                    <button
                      onClick={() => deleteButton(it.id)}
                      className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {btnForm && (
            <form onSubmit={submitButton} className="space-y-3 rounded border bg-white p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Nome</label>
                  <input
                    value={btnForm.name}
                    onChange={(e) => setBtnForm({ ...btnForm, name: e.target.value })}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Travar Bot"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Variável</label>
                  <input
                    value={btnForm.variable}
                    onChange={(e) => setBtnForm({ ...btnForm, variable: e.target.value })}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="TRAVAR"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">URL do Webhook (N8N)</label>
                <input
                  value={btnForm.url}
                  onChange={(e) => setBtnForm({ ...btnForm, url: e.target.value })}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="https://n8n.example/webhook/..."
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Ativo</label>
                <input
                  type="checkbox"
                  checked={btnForm.active}
                  onChange={(e) => setBtnForm({ ...btnForm, active: e.target.checked })}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
                >
                  Salvar
                </button>
                <button type="button" onClick={() => setBtnForm(null)} className="rounded-md border px-3 py-2 text-xs">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Webhooks */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Webhooks independentes</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Origin:</span>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="rounded-md border px-2 py-1 text-xs"
              >
                <option value="bot-control">bot-control</option>
                <option value="manual">manual</option>
              </select>
              <button
                onClick={() => setCfgForm({ id: '', origin, url: '', headers: null, active: true })}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
              >
                Novo webhook
              </button>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded bg-gray-200" />
              ))}
            </div>
          ) : (
            <div className="divide-y rounded border bg-white">
              {configs.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{it.url}</p>
                    <p className="truncate text-xs text-gray-500">
                      {it.origin} • {it.active ? 'ativo' : 'inativo'}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setCfgForm(it)} className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50">
                      Editar
                    </button>
                    <button
                      onClick={() => deleteConfig(it.id)}
                      className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cfgForm && (
            <form onSubmit={submitConfig} className="space-y-3 rounded border bg-white p-4">
              <div>
                <label className="text-xs text-gray-500">URL</label>
                <input
                  value={cfgForm.url}
                  onChange={(e) => setCfgForm({ ...cfgForm, url: e.target.value })}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="https://seu-webhook"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Headers (JSON)</label>
                <textarea
                  value={cfgForm.headers ? JSON.stringify(cfgForm.headers) : ''}
                  onChange={(e) => {
                    try {
                      const v = e.target.value.trim();
                      setCfgForm({ ...cfgForm, headers: v ? JSON.parse(v) : null });
                      setError(null);
                    } catch {
                      setError('Headers precisam ser JSON válido');
                    }
                  }}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder='{"Authorization":"Bearer ..."}'
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Ativo</label>
                <input
                  type="checkbox"
                  checked={cfgForm.active}
                  onChange={(e) => setCfgForm({ ...cfgForm, active: e.target.checked })}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
                >
                  Salvar
                </button>
                <button type="button" onClick={() => setCfgForm(null)} className="rounded-md border px-3 py-2 text-xs">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
