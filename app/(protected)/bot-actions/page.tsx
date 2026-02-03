'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { Lead } from '../../../types';

type BotButton = { id: string; name: string; variable: string };

export default function BotActionsPage() {
  const [phone, setPhone] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [buttons, setButtons] = useState<BotButton[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = useMemo(() => phone.replace(/\D+/g, ''), [phone]);

  const loadButtons = useCallback(async () => {
    try {
      const resp = await api.get<BotButton[]>('/bot-buttons', { params: { active: true } });
      setButtons(resp.data.map((b: any) => ({ id: b.id, name: b.name, variable: b.variable })));
    } catch {}
  }, []);

  const searchLeads = useCallback(async () => {
    if (!digits) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await api.get<{ data: Lead[] }>('/leads', { params: { page: 1, limit: 20, search: digits } });
      setLeads(resp.data.data);
    } catch {
      setError('Falha ao buscar leads');
    } finally {
      setLoading(false);
    }
  }, [digits]);

  useEffect(() => {
    loadButtons();
  }, [loadButtons]);

  const triggerByPhone = async (buttonId: string) => {
    try {
      setError(null);
      await api.post(`/bot-buttons/${buttonId}/trigger-by-phone`, { phoneRaw: digits });
    } catch {
      setError('Falha ao acionar botão');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Acionar Botões por Número</h1>
        <p className="text-sm text-gray-500">Informe um telefone para localizar o lead e acionar um botão.</p>
      </div>
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500">Número</label>
          <input
            value={phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="(xx) xxxxx-xxxx"
          />
        </div>
        <button
          onClick={searchLeads}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
        >
          Buscar
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <section className="rounded border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="text-lg font-semibold">Leads encontrados</h2>
            </div>
            <ul className="divide-y">
              {leads.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setSelectedLead(l)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <span className="truncate text-sm font-semibold">{l.name ?? 'Sem nome'}</span>
                    <span className="truncate text-xs text-gray-500">{l.contact ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="text-lg font-semibold">Botões</h2>
              {selectedLead && (
                <p className="text-xs text-gray-500">
                  Lead: {selectedLead.name ?? ''} • {selectedLead.contact ?? ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {buttons.map((b) => (
                <button
                  key={b.id}
                  onClick={() => triggerByPhone(b.id)}
                  className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                  disabled={!digits}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
