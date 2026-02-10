'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

interface AgentPromptResponse {
  prompt: string;
}

export default function AgentPromptPage() {
  const router = useRouter();
  const { seller, loading: authLoading } = useAuth();
  const [instances, setInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [savedPrompt, setSavedPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (seller) {
      router.replace('/dashboard');
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    api
      .get('/integrations/evolution/instances/list')
      .then((resp) => {
        const list = Array.isArray(resp.data) ? resp.data : [];
        const mapped = list
          .map((x: any) => ({
            id: (x.providerInstanceId ?? x.instanceId ?? '').toString(),
            name: (x.number ?? x.name ?? x.instanceId ?? 'Instância').toString()
          }))
          .filter((x: any) => typeof x.id === 'string' && x.id.length > 0);
        if (!isMounted) return;
        setInstances(mapped);
        if (mapped.length) {
          setSelectedInstanceId((prev) => prev || mapped[0].id);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!isMounted) return;
        setError('Nao foi possivel carregar as instancias.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, seller, router]);

  useEffect(() => {
    if (authLoading || seller) return;
    if (!selectedInstanceId) return;
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    api
      .get<AgentPromptResponse>('/agent-prompt', { params: { instanceId: selectedInstanceId } })
      .then((response) => {
        if (!isMounted) return;
        setPrompt(response.data.prompt ?? '');
        setSavedPrompt(response.data.prompt ?? '');
      })
      .catch((err) => {
        console.error(err);
        if (!isMounted) return;
        setError('Nao foi possivel carregar o prompt do agente.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [authLoading, seller, selectedInstanceId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    if (!selectedInstanceId) {
      setError('Selecione uma instancia.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await api.put<AgentPromptResponse>('/agent-prompt', { prompt }, { params: { instanceId: selectedInstanceId } });
      setPrompt(response.data.prompt ?? '');
      setSavedPrompt(response.data.prompt ?? '');
      setSuccessMessage('Prompt salvo com sucesso.');
    } catch (err) {
      console.error(err);
      setError('Nao foi possivel salvar o prompt.');
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = prompt !== savedPrompt;

  if (authLoading || seller) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Prompt do agente</h1>
        <p className="text-sm text-gray-500">
          Configure o prompt do seu agente de IA para personalizar o atendimento.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-600">{successMessage}</div>
      )}

      <label className="block text-sm font-medium text-gray-700">
        Instancia
        <select
          value={selectedInstanceId}
          onChange={(e) => {
            setSelectedInstanceId(e.target.value);
            setError(null);
            setSuccessMessage(null);
          }}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
          disabled={isLoading || instances.length === 0}
        >
          {instances.length === 0 ? (
            <option value="">Nenhuma instancia encontrada</option>
          ) : (
            instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))
          )}
        </select>
      </label>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Prompt
          <textarea
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              setError(null);
              setSuccessMessage(null);
            }}
            rows={12}
            placeholder="Descreva o comportamento desejado do agente..."
            className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow focus:border-primary focus:outline-none"
            disabled={isLoading}
          />
        </label>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{prompt.length} caracteres</span>
          <button
            type="submit"
            disabled={isLoading || isSaving || !isDirty || !selectedInstanceId}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isSaving ? 'Salvando...' : 'Salvar prompt'}
          </button>
        </div>
      </form>
    </div>
  );
}
