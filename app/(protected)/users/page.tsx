'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useProtectedRoute } from '../../../hooks/useProtectedRoute';
import { useRoleGuard } from '../../../hooks/useRoleGuard';

type ListedUser = {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  role: string;
  isApproved: boolean;
  isAdmin: boolean;
  createdAt: string;
};

export default function UsersPage() {
  useProtectedRoute();
  const { isAuthorized } = useRoleGuard(['admin']);

  const [items, setItems] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ListedUser[]>('/users');
      setItems(data);
    } catch {
      setError('Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      load();
    }
  }, [isAuthorized]);

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    try {
      await api.patch(`/users/${id}/admin`, { isAdmin });
      setItems((prev) => prev.map((u) => (u.id === id ? { ...u, isAdmin } : u)));
    } catch {
      setError('Falha ao alterar admin.');
    }
  };

  const approve = async (id: string) => {
    try {
      await api.patch(`/users/${id}/approve`);
      setItems((prev) => prev.map((u) => (u.id === id ? { ...u, isApproved: true } : u)));
    } catch {
      setError('Falha ao aprovar usuário.');
    }
  };

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Usuários</h1>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Papel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Aprovado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.companyName ?? '—'}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={u.isAdmin}
                        onChange={(e) => toggleAdmin(u.id, e.target.checked)}
                      />
                      <span>{u.isAdmin ? 'Sim' : 'Não'}</span>
                    </label>
                  </td>
                  <td className="px-4 py-2">{u.isApproved ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">
                    {!u.isApproved && (
                      <button
                        onClick={() => approve(u.id)}
                        className="rounded-md bg-primary px-3 py-1 text-white hover:bg-primary-dark"
                      >
                        Aprovar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={7}>
                    Nenhum usuário encontrado.
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
