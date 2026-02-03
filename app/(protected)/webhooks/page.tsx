'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';

type WebhookConfig = {
  id: string;
  origin: string;
  url: string;
  headers?: Record<string, unknown> | null;
  active: boolean;
};

export default function WebhooksPage() {
  const [items, setItems] = useState<WebhookConfig[]>([]);
  const [origin, setOrigin] = useState('bot-control');
  const [form, setForm] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await api.get<WebhookConfig[]>('/webhook-configs', { params: { origin } });
      setItems(resp.data);
    } catch {
      setError('Falha ao carregar webhooks');
    } finally {
      setLoading(false);
    }
  }, [origin]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (form?.id) {
        await api.patch(`/webhook-configs/${form.id}`, {
          origin: form.origin,
          url: form.url,
          headers: form.headers ?? null,
          active: form.active
        });
      } else {
        await api.post('/webhook-configs', {
          origin,
          url: form?.url,
          headers: form?.headers ?? null,
          active: form?.active ?? true
        });
      }
      setForm(null);
      await load();
    } catch {
      setError('Falha ao salvar webhook');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/webhook-configs/${id}`);
      await load();
    } catch {
      setError('Falha ao remover webhook');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Webhooks</h1>
        <p className="text-sm text-gray-500">Cadastre endpoints e vincule às instâncias.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Origin:</span>
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="rounded-md border px-2 py-1 text-sm"
        >
          <option value="bot-control">bot-control</option>
          <option value="manual">manual</option>
        </select>
        <button
          onClick={() => setForm({ id: '', origin, url: '', headers: null, active: true })}
          className="ml-auto rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
        >
          Novo webhook
        </button>
      </div>
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="divide-y rounded border bg-white">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{it.url}</p>
                <p className="truncate text-xs text-gray-500">
                  {it.origin} • {it.active ? 'ativo' : 'inativo'}
                </p>
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
          <div>
            <label className="text-xs text-gray-500">URL</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="https://seu-webhook"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Headers (JSON)</label>
            <textarea
              value={form.headers ? JSON.stringify(form.headers) : ''}
              onChange={(e) => {
                try {
                  const v = e.target.value.trim();
                  setForm({ ...form, headers: v ? JSON.parse(v) : null });
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
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
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
