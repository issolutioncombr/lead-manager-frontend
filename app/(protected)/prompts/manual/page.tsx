'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import api from '../../../../lib/api';
import { useProtectedRoute } from '../../../../hooks/useProtectedRoute';
import { Modal } from '../../../../components/Modal';

type ManualPromptListItem = {
  id: string;
  name: string | null;
  active: boolean;
  promptType: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  manualConfig?: any;
};

type ManualPromptDetail = {
  id: string;
  agentName: string | null;
  active: boolean;
  version: number;
  config: any;
};

type FaqItem = { question: string; answer: string };

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export default function ManualPromptsPage() {
  useProtectedRoute();

  const [items, setItems] = useState<ManualPromptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [agentName, setAgentName] = useState('');
  const [active, setActive] = useState(true);
  const [language, setLanguage] = useState('');
  const [strategy, setStrategy] = useState('');
  const [businessRules, setBusinessRules] = useState('');
  const [serviceParameters, setServiceParameters] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [minLeadTimeMinutes, setMinLeadTimeMinutes] = useState('');
  const [variablesJson, setVariablesJson] = useState('{}');
  const [faqs, setFaqs] = useState<FaqItem[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ManualPromptListItem[]>('/prompts/manual');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
      setError('Não foi possível carregar os prompts manuais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setAgentName('');
    setActive(true);
    setLanguage('');
    setStrategy('');
    setBusinessRules('');
    setServiceParameters('');
    setTimezone('America/Sao_Paulo');
    setWindowStart('');
    setWindowEnd('');
    setMinLeadTimeMinutes('');
    setVariablesJson('{}');
    setFaqs([]);
  };

  const openCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEdit = async (id: string) => {
    setError(null);
    try {
      const { data } = await api.get<ManualPromptDetail>(`/prompts/manual/${encodeURIComponent(id)}`);
      setEditingId(data.id);
      setAgentName(data.agentName ?? '');
      setActive(Boolean(data.active));
      const cfg = data.config ?? {};
      setLanguage(cfg.language ?? '');
      setStrategy(cfg.strategy ?? '');
      setBusinessRules(cfg.businessRules ?? '');
      setServiceParameters(cfg.serviceParameters ?? '');
      setTimezone(cfg.scheduling?.timezone ?? 'America/Sao_Paulo');
      setWindowStart(cfg.scheduling?.windowStart ?? '');
      setWindowEnd(cfg.scheduling?.windowEnd ?? '');
      setMinLeadTimeMinutes(cfg.scheduling?.minLeadTimeMinutes ?? '');
      setVariablesJson(JSON.stringify(cfg.variables ?? {}, null, 2));
      setFaqs(Array.isArray(cfg.faqs) ? cfg.faqs : []);
      setIsOpen(true);
    } catch {
      setError('Não foi possível carregar o prompt.');
    }
  };

  const canSave = useMemo(() => agentName.trim().length > 0, [agentName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const vars = variablesJson.trim() ? safeJsonParse(variablesJson) : {};
    if (vars === null) {
      setError('Variáveis: JSON inválido.');
      return;
    }

    const payload: any = {
      agentName: agentName.trim(),
      active,
      language: language.trim() || undefined,
      strategy: strategy.trim() || undefined,
      businessRules: businessRules.trim() || undefined,
      serviceParameters: serviceParameters.trim() || undefined,
      faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
      variables: vars,
      scheduling: {
        timezone: timezone.trim() || undefined,
        windowStart: windowStart.trim() || undefined,
        windowEnd: windowEnd.trim() || undefined,
        minLeadTimeMinutes: minLeadTimeMinutes.trim() || undefined
      }
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.put(`/prompts/manual/${encodeURIComponent(editingId)}`, payload);
      } else {
        await api.post('/prompts/manual', payload);
      }
      setIsOpen(false);
      resetForm();
      await load();
    } catch {
      setError('Não foi possível salvar o prompt.');
    } finally {
      setSaving(false);
    }
  };

  const addFaq = () => setFaqs((prev) => [...prev, { question: '', answer: '' }]);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Prompt Manual</h1>
          <p className="text-sm text-gray-500">Configure estratégia e variáveis. A base técnica permanece fixa no N8N.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
          Novo Prompt Manual
        </button>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">Nenhum prompt manual criado.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Agente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Versão</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Atualizado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2 text-sm font-semibold text-slate-900">{it.name ?? '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{it.version ?? 1}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={it.active ? 'text-green-700' : 'text-gray-500'}>{it.active ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{new Date(it.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm">
                    <button onClick={() => void openEdit(it.id)} className="rounded-md border border-gray-200 px-3 py-1 hover:bg-gray-50">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal title={editingId ? 'Editar Prompt Manual' : 'Novo Prompt Manual'} isOpen={isOpen} onClose={() => setIsOpen(false)} size="xl">
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Nome do agente
              <input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Ativo
            </label>
          </div>

          <label className="text-sm">
            Linguagem
            <textarea value={language} onChange={(e) => setLanguage(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
          </label>

          <label className="text-sm">
            Estratégia
            <textarea value={strategy} onChange={(e) => setStrategy(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
          </label>

          <label className="text-sm">
            Regras comerciais
            <textarea value={businessRules} onChange={(e) => setBusinessRules(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
          </label>

          <label className="text-sm">
            Parâmetros de atendimento
            <textarea value={serviceParameters} onChange={(e) => setServiceParameters(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Timezone
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
            </label>
            <label className="text-sm">
              Antecedência mínima (min)
              <input value={minLeadTimeMinutes} onChange={(e) => setMinLeadTimeMinutes(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
            </label>
            <label className="text-sm">
              Janela início
              <input value={windowStart} onChange={(e) => setWindowStart(e.target.value)} placeholder="09:00" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
            </label>
            <label className="text-sm">
              Janela fim
              <input value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} placeholder="18:00" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
            </label>
          </div>

          <label className="text-sm">
            Variáveis específicas (JSON)
            <textarea value={variablesJson} onChange={(e) => setVariablesJson(e.target.value)} rows={6} className="mt-1 w-full font-mono rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
          </label>

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">FAQ</div>
              <button type="button" onClick={addFaq} className="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50">
                Adicionar FAQ
              </button>
            </div>
            <div className="grid gap-3">
              {faqs.map((f, idx) => (
                <div key={idx} className="grid gap-2 rounded-lg border border-gray-100 p-3">
                  <input
                    value={f.question}
                    onChange={(e) => setFaqs((prev) => prev.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x)))}
                    placeholder="Pergunta"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <textarea
                    value={f.answer}
                    onChange={(e) => setFaqs((prev) => prev.map((x, i) => (i === idx ? { ...x, answer: e.target.value } : x)))}
                    placeholder="Resposta"
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => setFaqs((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded-md border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              {faqs.length === 0 ? <div className="text-sm text-gray-500">Nenhuma FAQ adicionada.</div> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!canSave || saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
