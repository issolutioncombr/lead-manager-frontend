'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { useProtectedRoute } from '../../../hooks/useProtectedRoute';
import { useRoleGuard } from '../../../hooks/useRoleGuard';
import { Modal } from '../../../components/Modal';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isApproved: boolean;
  companyName: string | null;
  createdAt: string;
};

type PromptCategory = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  basePrompt: string;
  adminRules?: string | null;
  tools?: any;
  requiredVariables?: any;
  variables?: any;
};

type AdminCreatedPromptRow = {
  id: string;
  user: { id: string; name: string; email: string };
  createdBy: { id: string; role: string; email: string; name: string };
  category: { id: string; name: string } | null;
  promptType: string;
  name: string | null;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  previewPrompt: string;
};

type FaqItem = { question: string; answer: string };

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export default function AdminPage() {
  useProtectedRoute();
  const { isAuthorized } = useRoleGuard(['Super-Admin'], '/dashboard');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [promptCategoryId, setPromptCategoryId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [promptActive, setPromptActive] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualTargetUserId, setManualTargetUserId] = useState('');
  const [manualCategoryId, setManualCategoryId] = useState('');
  const [manualAgentName, setManualAgentName] = useState('');
  const [manualActive, setManualActive] = useState(true);
  const [manualLanguage, setManualLanguage] = useState('');
  const [manualStrategy, setManualStrategy] = useState('');
  const [manualBusinessRules, setManualBusinessRules] = useState('');
  const [manualServiceParameters, setManualServiceParameters] = useState('');
  const [manualFaqs, setManualFaqs] = useState<FaqItem[]>([]);
  const [savingManual, setSavingManual] = useState(false);
  const [manualPreview, setManualPreview] = useState<string | null>(null);

  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryActive, setCategoryActive] = useState(true);
  const [categoryBasePrompt, setCategoryBasePrompt] = useState('');
  const [categoryAdminRules, setCategoryAdminRules] = useState('');
  const [categoryToolsText, setCategoryToolsText] = useState('');
  const [categoryRequiredVarsText, setCategoryRequiredVarsText] = useState('');
  const [categoryVariablesJson, setCategoryVariablesJson] = useState('{}');
  const [savingCategory, setSavingCategory] = useState(false);

  const [isAdminPromptsOpen, setIsAdminPromptsOpen] = useState(false);
  const [adminCreatedPrompts, setAdminCreatedPrompts] = useState<AdminCreatedPromptRow[]>([]);
  const [loadingAdminPrompts, setLoadingAdminPrompts] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<AdminUser[]>('/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
      setError('Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const resp = await api.get<{ data: PromptCategory[] }>('/admin/prompt-categories');
      setCategories(Array.isArray(resp.data?.data) ? resp.data.data : []);
    } catch {
      setCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      void loadUsers();
      void loadCategories();
    }
  }, [isAuthorized]);

  const toggleApprove = async (id: string, isApproved: boolean) => {
    setError(null);
    try {
      await api.patch(`/admin/users/${encodeURIComponent(id)}/approve`, { isApproved });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isApproved } : u)));
    } catch {
      setError('Falha ao atualizar aprovação.');
    }
  };

  const canCreatePrompt = useMemo(
    () => targetUserId.trim() && promptCategoryId.trim() && agentName.trim() && promptText.trim(),
    [targetUserId, promptCategoryId, agentName, promptText]
  );

  const submitPrompt = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreatePrompt) return;
    setSavingPrompt(true);
    setError(null);
    try {
      await api.post('/admin/prompts', {
        targetUserId: targetUserId.trim(),
        categoryId: promptCategoryId.trim(),
        agentName: agentName.trim(),
        prompt: promptText.trim(),
        active: promptActive
      });
      setIsPromptOpen(false);
      setTargetUserId('');
      setPromptCategoryId('');
      setAgentName('');
      setPromptText('');
      setPromptActive(true);
    } catch {
      setError('Não foi possível criar o prompt.');
    } finally {
      setSavingPrompt(false);
    }
  };

  const resetManualForm = () => {
    setManualTargetUserId('');
    setManualCategoryId('');
    setManualAgentName('');
    setManualActive(true);
    setManualLanguage('');
    setManualStrategy('');
    setManualBusinessRules('');
    setManualServiceParameters('');
    setManualFaqs([]);
    setManualPreview(null);
  };

  const openManual = () => {
    resetManualForm();
    setIsManualOpen(true);
  };

  const canCreateManual = useMemo(
    () => manualTargetUserId.trim() && manualCategoryId.trim() && manualAgentName.trim(),
    [manualTargetUserId, manualCategoryId, manualAgentName]
  );

  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateManual) return;
    if (savingManual) return;
    setSavingManual(true);
    setError(null);
    try {
      const resp = await api.post<{ previewPrompt?: string }>('/admin/manual-prompts', {
        targetUserId: manualTargetUserId.trim(),
        categoryId: manualCategoryId.trim(),
        agentName: manualAgentName.trim(),
        active: manualActive,
        userConfig: {
          language: manualLanguage.trim() || undefined,
          strategy: manualStrategy.trim() || undefined,
          businessRules: manualBusinessRules.trim() || undefined,
          serviceParameters: manualServiceParameters.trim() || undefined,
          faqs: manualFaqs.filter((f) => f.question.trim() && f.answer.trim())
        }
      });
      setManualPreview(String((resp.data as any)?.previewPrompt ?? ''));
    } catch {
      setError('Não foi possível criar o prompt manual.');
    } finally {
      setSavingManual(false);
    }
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategoryDescription('');
    setCategoryActive(true);
    setCategoryBasePrompt('');
    setCategoryAdminRules('');
    setCategoryToolsText('');
    setCategoryRequiredVarsText('');
    setCategoryVariablesJson('{}');
  };

  const openCategories = () => {
    resetCategoryForm();
    setIsCategoriesOpen(true);
  };

  const startEditCategory = (c: PromptCategory) => {
    setEditingCategoryId(c.id);
    setCategoryName(c.name ?? '');
    setCategoryDescription(c.description ?? '');
    setCategoryActive(c.active !== false);
    setCategoryBasePrompt(c.basePrompt ?? '');
    setCategoryAdminRules(c.adminRules ?? '');
    setCategoryToolsText(Array.isArray(c.tools) ? c.tools.map(String).join(', ') : '');
    setCategoryRequiredVarsText(Array.isArray(c.requiredVariables) ? c.requiredVariables.map(String).join('\n') : '');
    setCategoryVariablesJson(JSON.stringify(c.variables ?? {}, null, 2));
    setIsCategoriesOpen(true);
  };

  const saveCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (savingCategory) return;
    const name = categoryName.trim();
    if (!name) {
      setError('Categoria: nome é obrigatório.');
      return;
    }
    const variables = categoryVariablesJson.trim() ? safeJsonParse(categoryVariablesJson) : {};
    if (variables === null) {
      setError('Categoria: variáveis JSON inválido.');
      return;
    }
    const tools = categoryToolsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const requiredVariables = categoryRequiredVarsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    setSavingCategory(true);
    setError(null);
    try {
      const payload = {
        name,
        description: categoryDescription.trim() || null,
        active: categoryActive,
        basePrompt: categoryBasePrompt,
        adminRules: categoryAdminRules.trim() || null,
        tools: tools.length ? tools : [],
        requiredVariables: requiredVariables.length ? requiredVariables : [],
        variables
      };
      if (editingCategoryId) {
        await api.put(`/admin/prompt-categories/${encodeURIComponent(editingCategoryId)}`, payload);
      } else {
        await api.post('/admin/prompt-categories', payload);
      }
      await loadCategories();
      setIsCategoriesOpen(false);
      resetCategoryForm();
    } catch {
      setError('Não foi possível salvar a categoria.');
    } finally {
      setSavingCategory(false);
    }
  };

  const openAdminPrompts = async () => {
    setIsAdminPromptsOpen(true);
    setLoadingAdminPrompts(true);
    setError(null);
    try {
      const resp = await api.get<{ data: AdminCreatedPromptRow[] }>('/admin/agent-prompts/admin-created');
      setAdminCreatedPrompts(Array.isArray(resp.data?.data) ? resp.data.data : []);
    } catch {
      setAdminCreatedPrompts([]);
      setError('Não foi possível carregar os prompts do admin.');
    } finally {
      setLoadingAdminPrompts(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Admin (Super-Admin)</h1>
          <p className="text-sm text-gray-500">Aprovação de usuários e criação de agentes estratégicos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setIsPromptOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            Criar Prompt (Super)
          </button>
          <button onClick={openManual} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-gray-50">
            Criar Prompt Manual (Super)
          </button>
          <button onClick={openCategories} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-gray-50">
            Categorias
          </button>
          <button onClick={() => void openAdminPrompts()} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-gray-50">
            Previews (Admin)
          </button>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Carregando...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">E-mail</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Aprovado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-sm font-semibold text-slate-900">{u.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{u.email}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{u.companyName ?? '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{u.role}</td>
                  <td className="px-4 py-2 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={u.isApproved} onChange={(e) => void toggleApprove(u.id, e.target.checked)} />
                      <span className={u.isApproved ? 'text-green-700' : 'text-gray-500'}>{u.isApproved ? 'Sim' : 'Não'}</span>
                    </label>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{new Date(u.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={6}>
                    Nenhum usuário.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <Modal title="Criar Prompt do Super-Admin" isOpen={isPromptOpen} onClose={() => setIsPromptOpen(false)} size="xl">
        <form onSubmit={submitPrompt} className="grid gap-4">
          <label className="text-sm">
            Usuário destinatário
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus:border-primary focus:outline-none"
            >
              <option value="">Selecione...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Categoria do agente
            <select
              value={promptCategoryId}
              onChange={(e) => setPromptCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus:border-primary focus:outline-none"
              disabled={isLoadingCategories}
            >
              <option value="">Selecione...</option>
              {categories
                .filter((c) => c.active !== false)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm">
            Nome do agente (visível para o usuário)
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>

          <label className="text-sm">
            Conteúdo do prompt (oculto para o usuário final)
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono focus:border-primary focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={promptActive} onChange={(e) => setPromptActive(e.target.checked)} />
            Ativo
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!canCreatePrompt || savingPrompt}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPrompt ? 'Criando...' : 'Criar'}
            </button>
            <button type="button" onClick={() => setIsPromptOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Criar Prompt Manual (Super-Admin)" isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} size="xl">
        <form onSubmit={submitManual} className="grid gap-4">
          <label className="text-sm">
            Usuário destinatário
            <select
              value={manualTargetUserId}
              onChange={(e) => setManualTargetUserId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus:border-primary focus:outline-none"
            >
              <option value="">Selecione...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Categoria do agente
              <select
                value={manualCategoryId}
                onChange={(e) => setManualCategoryId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus:border-primary focus:outline-none"
                disabled={isLoadingCategories}
              >
                <option value="">Selecione...</option>
                {categories
                  .filter((c) => c.active !== false)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Nome do agente
              <input
                value={manualAgentName}
                onChange={(e) => setManualAgentName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={manualActive} onChange={(e) => setManualActive(e.target.checked)} />
              Ativo
            </label>
          </div>

          <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Config do User (negócio / comportamento)</div>
              <label className="text-sm">
                Linguagem
                <textarea value={manualLanguage} onChange={(e) => setManualLanguage(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
              </label>
              <label className="text-sm">
                Estratégia
                <textarea value={manualStrategy} onChange={(e) => setManualStrategy(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
              </label>
              <label className="text-sm">
                Regras comerciais
                <textarea value={manualBusinessRules} onChange={(e) => setManualBusinessRules(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
              </label>
              <label className="text-sm">
                Parâmetros de atendimento
                <textarea value={manualServiceParameters} onChange={(e) => setManualServiceParameters(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
              </label>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">FAQ</div>
                  <button
                    type="button"
                    onClick={() => setManualFaqs((prev) => [...prev, { question: '', answer: '' }])}
                    className="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="grid gap-2">
                  {manualFaqs.map((f, idx) => (
                    <div key={idx} className="grid gap-2 rounded-lg border border-gray-100 p-3">
                      <input
                        value={f.question}
                        onChange={(e) => setManualFaqs((prev) => prev.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x)))}
                        placeholder="Pergunta"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                      <textarea
                        value={f.answer}
                        onChange={(e) => setManualFaqs((prev) => prev.map((x, i) => (i === idx ? { ...x, answer: e.target.value } : x)))}
                        placeholder="Resposta"
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => setManualFaqs((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded-md border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                  {manualFaqs.length === 0 ? <div className="text-sm text-gray-500">Nenhuma FAQ adicionada.</div> : null}
                </div>
              </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!canCreateManual || savingManual}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingManual ? 'Salvando...' : 'Salvar e gerar preview'}
            </button>
            <button type="button" onClick={() => setIsManualOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">
              Fechar
            </button>
          </div>

          {manualPreview ? (
            <div className="grid gap-2 rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Preview (como será enviado ao N8N)</div>
              <textarea value={manualPreview} readOnly rows={14} className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs" />
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal title="Categorias de Prompt" isOpen={isCategoriesOpen} onClose={() => setIsCategoriesOpen(false)} size="xl">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-gray-600">
              Use {'{{AGENT_NAME}}'} e {'{{USER_CONTEXT}}'} no template.
            </div>
            <button
              type="button"
              onClick={() => {
                resetCategoryForm();
                setIsCategoriesOpen(true);
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Nova categoria
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-sm font-semibold text-slate-900">{c.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{c.active ? 'Ativa' : 'Inativa'}</td>
                    <td className="px-4 py-2 text-sm">
                      <button
                        type="button"
                        onClick={() => startEditCategory(c)}
                        className="rounded-md border border-gray-200 px-3 py-1 hover:bg-gray-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={3}>
                      Nenhuma categoria.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <form onSubmit={saveCategory} className="grid gap-3 rounded-lg border bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">{editingCategoryId ? 'Editar categoria' : 'Nova categoria'}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Nome
                <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input type="checkbox" checked={categoryActive} onChange={(e) => setCategoryActive(e.target.checked)} />
                Ativa
              </label>
            </div>
            <label className="text-sm">
              Descrição
              <input value={categoryDescription} onChange={(e) => setCategoryDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
            </label>
            <label className="text-sm">
              Template (basePrompt)
              <textarea value={categoryBasePrompt} onChange={(e) => setCategoryBasePrompt(e.target.value)} rows={10} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none" />
            </label>
            <label className="text-sm">
              Regras do Admin (opcional)
              <textarea value={categoryAdminRules} onChange={(e) => setCategoryAdminRules(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Ferramentas (vírgula)
                <input value={categoryToolsText} onChange={(e) => setCategoryToolsText(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none" />
              </label>
              <label className="text-sm">
                Variáveis obrigatórias (1 por linha)
                <textarea value={categoryRequiredVarsText} onChange={(e) => setCategoryRequiredVarsText(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none" />
              </label>
            </div>
            <label className="text-sm">
              Variáveis (JSON)
              <textarea value={categoryVariablesJson} onChange={(e) => setCategoryVariablesJson(e.target.value)} rows={6} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={savingCategory}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingCategory ? 'Salvando...' : 'Salvar categoria'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal title="Previews (Prompts criados pelo Admin)" isOpen={isAdminPromptsOpen} onClose={() => setIsAdminPromptsOpen(false)} size="xl">
        {loadingAdminPrompts ? (
          <div className="py-10 text-center text-sm text-gray-500">Carregando...</div>
        ) : (
          <div className="grid gap-3">
            {adminCreatedPrompts.map((p) => (
              <div key={p.id} className="rounded-lg border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{p.name ?? '—'}</div>
                    <div className="text-xs text-gray-500">
                      {p.user?.name} ({p.user?.email}) • {p.category?.name ?? 'Sem categoria'} • {p.promptType}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{new Date(p.updatedAt).toLocaleString()}</div>
                </div>
                <textarea value={p.previewPrompt} readOnly rows={10} className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs" />
              </div>
            ))}
            {adminCreatedPrompts.length === 0 ? <div className="text-sm text-gray-500">Nenhum prompt encontrado.</div> : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
