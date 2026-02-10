'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

type PromptItem = {
  id: string;
  name: string | null;
  prompt: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type InstancePromptLinkItem = {
  promptId: string;
  percent: number;
  active: boolean;
  prompt: PromptItem;
};

export default function AgentPromptPage() {
  const maxStoredPromptLength = 100000;
  const router = useRouter();
  const { seller, loading: authLoading } = useAuth();
  const [instances, setInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoadingInstances, setIsLoadingInstances] = useState(true);

  const [library, setLibrary] = useState<PromptItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isSavingLibrary, setIsSavingLibrary] = useState(false);
  const [isDeletingPromptId, setIsDeletingPromptId] = useState<string | null>(null);

  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptName, setPromptName] = useState<string>('');
  const [promptText, setPromptText] = useState<string>('');

  const [links, setLinks] = useState<InstancePromptLinkItem[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [addPromptId, setAddPromptId] = useState<string>('');
  const [linksSaved, setLinksSaved] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (seller) {
      router.replace('/dashboard');
      return;
    }
    let isMounted = true;
    setIsLoadingInstances(true);
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
        setIsLoadingInstances(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, seller, router]);

  useEffect(() => {
    if (authLoading || seller) {
      return;
    }
    let isMounted = true;
    setIsLoadingLibrary(true);
    setError(null);
    api
      .get<{ data: PromptItem[] }>('/agent-prompt/prompts')
      .then((resp) => {
        if (!isMounted) return;
        setLibrary(Array.isArray(resp.data.data) ? resp.data.data : []);
      })
      .catch((err) => {
        console.error(err);
        if (!isMounted) return;
        setError('Nao foi possivel carregar a biblioteca de prompts.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingLibrary(false);
      });
    return () => {
      isMounted = false;
    };
  }, [authLoading, seller]);

  useEffect(() => {
    if (authLoading || seller) return;
    if (!selectedInstanceId) return;
    let isMounted = true;
    setIsLoadingLinks(true);
    setError(null);
    api
      .get<{ links: InstancePromptLinkItem[] }>(`/agent-prompt/instances/${encodeURIComponent(selectedInstanceId)}/prompts`)
      .then((resp) => {
        if (!isMounted) return;
        const next = Array.isArray((resp.data as any).links) ? ((resp.data as any).links as InstancePromptLinkItem[]) : [];
        setLinks(
          next.map((l) => ({
            promptId: l.promptId,
            percent: Number(l.percent ?? 0),
            active: l.active !== false,
            prompt: l.prompt
          }))
        );
        setLinksSaved(true);
      })
      .catch((err) => {
        console.error(err);
        if (!isMounted) return;
        setError('Nao foi possivel carregar os vinculos da instancia.');
        setLinks([]);
        setLinksSaved(false);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingLinks(false);
      });
    return () => {
      isMounted = false;
    };
  }, [authLoading, seller, selectedInstanceId]);

  const totalPercent = useMemo(() => links.reduce((acc, l) => acc + (l.active ? Number(l.percent || 0) : 0), 0), [links]);
  const canSaveLinks = links.length === 0 || Math.abs(totalPercent - 100) < 0.0001;
  const percentDelta = useMemo(() => 100 - totalPercent, [totalPercent]);
  const fmtPercent = (v: number) => v.toFixed(2).replace(/\.00$/, '');

  const redistributeActivePercents = (items: InstancePromptLinkItem[]) => {
    const active = items.filter((l) => l.active !== false);
    if (active.length <= 0) return items;
    const base = Math.floor(10000 / active.length);
    const remainder = 10000 - base * active.length;
    const assigned = new Map<string, number>();
    for (let i = 0; i < active.length; i += 1) {
      const bps = base + (i < remainder ? 1 : 0);
      assigned.set(active[i].promptId, bps);
    }
    return items.map((l) => {
      if (l.active === false) return { ...l, percent: 0 };
      const bps = assigned.get(l.promptId) ?? 0;
      return { ...l, percent: Math.round((bps / 100) * 100) / 100 };
    });
  };

  const availableToAdd = useMemo(() => {
    const linked = new Set(links.map((l) => l.promptId));
    return library.filter((p) => p.active && !linked.has(p.id));
  }, [library, links]);

  const duplicatePromptNameMessage = useMemo(() => {
    const normalizedName = promptName.trim();
    if (!normalizedName) return null;
    const dup = library.find((p) => {
      const pName = (p.name ?? '').trim();
      if (!pName) return false;
      if (editingPromptId && p.id === editingPromptId) return false;
      return pName.toLowerCase() === normalizedName.toLowerCase();
    });
    return dup ? 'Este nome já existe. Escolha outro para facilitar a visualização.' : null;
  }, [editingPromptId, library, promptName]);

  const startNewPrompt = () => {
    setEditingPromptId(null);
    setPromptName('');
    setPromptText('');
    setError(null);
    setSuccessMessage(null);
  };

  const startEditPrompt = (p: PromptItem) => {
    setEditingPromptId(p.id);
    setPromptName(p.name ?? '');
    setPromptText(p.prompt ?? '');
    setError(null);
    setSuccessMessage(null);
  };

  const errorMessageFromAxios = (err: any) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = typeof data?.message === 'string' ? data.message : Array.isArray(data?.message) ? data.message.join(', ') : null;
    if (msg && status) return `${msg} (HTTP ${status})`;
    if (msg) return msg;
    if (status) return `Falha na requisição (HTTP ${status}).`;
    return 'Falha na requisição.';
  };

  const savePrompt = async (event: FormEvent) => {
    event.preventDefault();
    if (isSavingLibrary) return;
    setIsSavingLibrary(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (duplicatePromptNameMessage) {
        setError(duplicatePromptNameMessage);
        return;
      }
      if (promptText.trim().length > maxStoredPromptLength) {
        setError(`Prompt muito grande (máx. ${maxStoredPromptLength} caracteres).`);
        return;
      }
      if (editingPromptId) {
        const resp = await api.put<{ data: PromptItem }>(`/agent-prompt/prompts/${encodeURIComponent(editingPromptId)}`, {
          name: promptName,
          prompt: promptText
        });
        const updated = resp.data.data;
        setLibrary((curr) => curr.map((x) => (x.id === updated.id ? updated : x)));
        setSuccessMessage('Prompt atualizado com sucesso.');
      } else {
        const resp = await api.post<{ data: PromptItem }>('/agent-prompt/prompts', {
          name: promptName,
          prompt: promptText
        });
        const created = resp.data.data;
        setLibrary((curr) => [created, ...curr]);
        startNewPrompt();
        setSuccessMessage('Prompt criado com sucesso.');
      }
    } catch (err) {
      console.error(err);
      setError(errorMessageFromAxios(err));
    } finally {
      setIsSavingLibrary(false);
    }
  };

  const deletePrompt = async (id: string) => {
    if (isDeletingPromptId) return;
    setIsDeletingPromptId(id);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.delete(`/agent-prompt/prompts/${encodeURIComponent(id)}`);
      setLibrary((curr) => curr.filter((p) => p.id !== id));
      if (selectedInstanceId) {
        try {
          const resp = await api.get(`/agent-prompt/instances/${encodeURIComponent(selectedInstanceId)}/prompts`);
          const next = Array.isArray((resp.data as any).links) ? (resp.data as any).links : [];
          setLinks(
            next.map((l: any) => ({
              promptId: l.promptId,
              percent: Number(l.percent ?? 0),
              active: l.active !== false,
              prompt: l.prompt
            }))
          );
          setLinksSaved(true);
        } catch {
          setLinks((curr) => curr.filter((l) => l.promptId !== id));
          setLinksSaved(false);
        }
      } else {
        setLinks((curr) => curr.filter((l) => l.promptId !== id));
        setLinksSaved(false);
      }
      if (editingPromptId === id) {
        startNewPrompt();
      }
      setSuccessMessage('Prompt excluido com sucesso.');
    } catch (err) {
      console.error(err);
      setError(errorMessageFromAxios(err));
    } finally {
      setIsDeletingPromptId(null);
    }
  };

  const addLink = () => {
    const pid = addPromptId.trim();
    if (!pid) return;
    const p = library.find((x) => x.id === pid);
    if (!p) return;
    setLinks((curr) => [...curr, { promptId: p.id, percent: 0, active: true, prompt: p }]);
    setLinksSaved(false);
    setAddPromptId('');
    setSuccessMessage(null);
    setError(null);
  };

  const saveLinks = async () => {
    if (!selectedInstanceId) return;
    if (!canSaveLinks) {
      setError(`Para salvar os vínculos, o total ativo deve ser 100%. Atualmente: ${totalPercent}%.`);
      return;
    }
    if (isSavingLinks) return;
    setIsSavingLinks(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.put(`/agent-prompt/instances/${encodeURIComponent(selectedInstanceId)}/prompts`, {
        items: links.map((l) => ({
          promptId: l.promptId,
          percent: Number(l.percent || 0),
          active: l.active !== false
        }))
      });
      setSuccessMessage('Vinculos salvos com sucesso.');
      setLinksSaved(true);
    } catch (err) {
      console.error(err);
      setError(errorMessageFromAxios(err));
    } finally {
      setIsSavingLinks(false);
    }
  };

  if (authLoading || seller) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Prompts do agente</h1>
        <p className="text-sm text-gray-500">
          Crie prompts e vincule por instância com percentuais.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-600">{successMessage}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Vínculos por instância</h2>
          </div>

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
              disabled={isLoadingInstances || instances.length === 0}
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

          <div className="flex items-end gap-2">
            <label className="block flex-1 text-sm font-medium text-gray-700">
              Adicionar prompt
              <select
                value={addPromptId}
                onChange={(e) => setAddPromptId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
                disabled={isLoadingLinks || isLoadingLibrary || availableToAdd.length === 0}
              >
                <option value="">Selecione...</option>
                {availableToAdd.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.name ?? `Prompt ${p.id.slice(0, 6)}`).toString()}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addLink}
              disabled={!addPromptId}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              Adicionar
            </button>
          </div>

          <div className="text-sm text-gray-600">
            Total ativo:{' '}
            <span className={canSaveLinks ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>{totalPercent}%</span>
            {links.length > 0 && !canSaveLinks && (
              <span className="ml-2 text-xs text-red-700">
                {percentDelta > 0 ? `Faltam ${fmtPercent(percentDelta)}% para chegar em 100%.` : `Excedeu ${fmtPercent(Math.abs(percentDelta))}% (precisa ser 100%).`}
              </span>
            )}
            {links.length > 0 && canSaveLinks && (
              <span className="ml-2 text-xs text-green-700">{linksSaved ? 'Salvo.' : 'Pronto para salvar.'}</span>
            )}
          </div>

          <div className="space-y-2">
            {isLoadingLinks ? (
              <div className="text-sm text-gray-500">Carregando vínculos...</div>
            ) : links.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum prompt vinculado.</div>
            ) : (
              links.map((l) => (
                <div key={l.promptId} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{l.prompt.name ?? `Prompt ${l.promptId.slice(0, 6)}`}</div>
                    <div className="truncate text-xs text-gray-500">{l.promptId}</div>
                  </div>
                  <label className="text-xs text-gray-600">
                    %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={String(l.percent ?? 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setLinks((curr) =>
                          curr.map((x) =>
                            x.promptId === l.promptId
                              ? { ...x, percent: Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v * 100) / 100)) : 0 }
                              : x
                          )
                        );
                        setLinksSaved(false);
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="ml-1 w-20 rounded-md border px-2 py-1 text-sm"
                      disabled={isSavingLinks}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={l.active !== false}
                      onChange={(e) => {
                        setLinks((curr) => curr.map((x) => (x.promptId === l.promptId ? { ...x, active: e.target.checked } : x)));
                        setLinksSaved(false);
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      disabled={isSavingLinks}
                    />
                    Ativo
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setLinks((curr) => redistributeActivePercents(curr.filter((x) => x.promptId !== l.promptId)));
                      setLinksSaved(false);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="rounded-md border px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    disabled={isSavingLinks}
                  >
                    Remover
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={saveLinks}
            disabled={isLoadingLinks || isSavingLinks || !selectedInstanceId || !canSaveLinks}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isSavingLinks ? 'Salvando...' : 'Salvar vínculos'}
          </button>
          {links.length > 0 && !canSaveLinks && (
            <div className="text-xs text-red-700">
              Ajuste os percentuais para que a soma dos vínculos ativos fique exatamente em 100%.
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Biblioteca de prompts</h2>
            <button
              type="button"
              onClick={startNewPrompt}
              className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Novo prompt
            </button>
          </div>

          {isLoadingLibrary ? (
            <div className="text-sm text-gray-500">Carregando prompts...</div>
          ) : library.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhum prompt criado ainda.</div>
          ) : (
            <div className="divide-y rounded-lg border">
              {library.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => startEditPrompt(p)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-semibold text-slate-900">{p.name ?? `Prompt ${p.id.slice(0, 6)}`}</div>
                    <div className="truncate text-xs text-gray-500">{p.prompt}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePrompt(p.id)}
                    disabled={isDeletingPromptId === p.id}
                    className="rounded-md border px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingPromptId === p.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={savePrompt} className="space-y-3 rounded-lg border p-3">
            <div className="text-sm font-semibold text-slate-900">
              {editingPromptId ? 'Editar prompt' : 'Criar prompt'}
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Nome (opcional)
              <input
                value={promptName}
                onChange={(e) => {
                  setPromptName(e.target.value);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
                disabled={isSavingLibrary}
              />
              {duplicatePromptNameMessage && <div className="mt-1 text-xs text-red-700">{duplicatePromptNameMessage}</div>}
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Prompt
              <textarea
                value={promptText}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  setError(null);
                  setSuccessMessage(null);
                }}
                rows={8}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow focus:border-primary focus:outline-none"
                disabled={isSavingLibrary}
              />
            </label>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {promptText.length} / {maxStoredPromptLength} caracteres
              </span>
              <div className="flex items-center gap-2">
                {editingPromptId && (
                  <button
                    type="button"
                    onClick={startNewPrompt}
                    disabled={isSavingLibrary}
                    className="rounded-lg border px-4 py-2 font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={
                    isSavingLibrary ||
                    !promptText.trim() ||
                    promptText.trim().length > maxStoredPromptLength ||
                    !!duplicatePromptNameMessage
                  }
                  className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {isSavingLibrary ? 'Salvando...' : editingPromptId ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
