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

export default function AdminPage() {
  useProtectedRoute();
  const { isAuthorized } = useRoleGuard(['Super-Admin'], '/dashboard');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [promptActive, setPromptActive] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);

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

  useEffect(() => {
    if (isAuthorized) {
      void loadUsers();
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

  const canCreatePrompt = useMemo(() => targetUserId.trim() && agentName.trim() && promptText.trim(), [targetUserId, agentName, promptText]);

  const submitPrompt = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreatePrompt) return;
    setSavingPrompt(true);
    setError(null);
    try {
      await api.post('/admin/prompts', {
        targetUserId: targetUserId.trim(),
        agentName: agentName.trim(),
        prompt: promptText.trim(),
        active: promptActive
      });
      setIsPromptOpen(false);
      setTargetUserId('');
      setAgentName('');
      setPromptText('');
      setPromptActive(true);
    } catch {
      setError('Não foi possível criar o prompt.');
    } finally {
      setSavingPrompt(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Admin (Super-Admin)</h1>
          <p className="text-sm text-gray-500">Aprovação de usuários e criação de agentes estratégicos.</p>
        </div>
        <button onClick={() => setIsPromptOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
          Criar Prompt (Super)
        </button>
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
    </div>
  );
}

