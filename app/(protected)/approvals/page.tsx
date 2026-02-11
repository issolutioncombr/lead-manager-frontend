'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useProtectedRoute } from '../../../hooks/useProtectedRoute';
import { useRoleGuard } from '../../../hooks/useRoleGuard';

type PendingUser = {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  createdAt: string;
};

export default function ApprovalsPage() {
  useProtectedRoute();
  const { isAuthorized } = useRoleGuard(['Super-Admin']);

  const [items, setItems] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<PendingUser[]>('/users/pending');
      setItems(data);
    } catch {
      setError('Não foi possível carregar os usuários pendentes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      load();
    }
  }, [isAuthorized]);

  const approve = async (id: string) => {
    try {
      await api.patch(`/users/${id}/approve`);
      setItems((prev) => prev.filter((u) => u.id !== id));
    } catch {
      setError('Falha ao aprovar usuário.');
    }
  };

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Aprovação de usuários</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200 bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">E-mail</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Criado em</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.companyName ?? '—'}</td>
                  <td className="px-4 py-2">{new Date(u.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => approve(u.id)}
                      className="rounded-md bg-primary px-3 py-1 text-white hover:bg-primary-dark"
                    >
                      Aprovar
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={5}>
                    Nenhum usuário pendente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
