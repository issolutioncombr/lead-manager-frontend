'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import api from '../lib/api';
import { Modal } from './Modal';
import { LeadStatus, MetaAdsConfigResponse, MetaAdsEvent, MetaAdsIntegration, MetaAdsStatusMapping } from '../types';

type MappingDraft = Record<string, { eventId: string; enabled: boolean }>;

export function MetaAdsIntegrationCard() {
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [creatingIntegration, setCreatingIntegration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<MetaAdsConfigResponse | null>(null);

  const [integrations, setIntegrations] = useState<MetaAdsIntegration[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [isCreateIntegrationOpen, setIsCreateIntegrationOpen] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [defaultContentName, setDefaultContentName] = useState('');
  const [defaultContentCategory, setDefaultContentCategory] = useState('');

  const [newIntegrationName, setNewIntegrationName] = useState('');
  const [newIntegrationWebhookUrl, setNewIntegrationWebhookUrl] = useState('');
  const [newIntegrationPixelId, setNewIntegrationPixelId] = useState('');
  const [newIntegrationAccessToken, setNewIntegrationAccessToken] = useState('');
  const [newIntegrationTestEventCode, setNewIntegrationTestEventCode] = useState('');
  const [newIntegrationContentName, setNewIntegrationContentName] = useState('');
  const [newIntegrationContentCategory, setNewIntegrationContentCategory] = useState('');

  const [eventName, setEventName] = useState('');
  const [metaEventName, setMetaEventName] = useState('');

  const [mappingDraft, setMappingDraft] = useState<MappingDraft>({});

  const fetchIntegrations = useCallback(async () => {
    try {
      const { data } = await api.get<MetaAdsIntegration[]>('/integrations/meta-ads/integrations');
      const next = Array.isArray(data) ? data : [];
      setIntegrations(next);
      if (!selectedIntegrationId && next.length) {
        setSelectedIntegrationId(next[0].id);
      }
    } catch {
      setIntegrations([]);
    }
  }, [selectedIntegrationId]);

  const fetchConfig = useCallback(async (integrationId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<MetaAdsConfigResponse>('/integrations/meta-ads', {
        params: { integrationId: integrationId || undefined }
      });
      setConfig(data);
      setEnabled(Boolean(data.integration.enabled));
      setN8nWebhookUrl(data.integration.n8nWebhookUrl ?? '');
      setPixelId(data.integration.pixelId ?? '');
      setAccessToken(data.integration.accessToken ?? '');
      setTestEventCode(data.integration.testEventCode ?? '');
      setDefaultContentName(data.integration.defaultContentName ?? '');
      setDefaultContentCategory(data.integration.defaultContentCategory ?? '');

      const nextDraft: MappingDraft = {};
      (data.mappings ?? []).forEach((m) => {
        nextDraft[m.statusSlug] = { eventId: m.eventId, enabled: m.enabled };
      });
      setMappingDraft(nextDraft);
    } catch {
      setError('Nao foi possivel carregar a integracao Meta ADS.');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    void fetchConfig(selectedIntegrationId || undefined);
  }, [fetchConfig, selectedIntegrationId]);

  const events = useMemo(() => config?.events ?? [], [config?.events]);
  const statuses = useMemo(() => config?.statuses ?? [], [config?.statuses]);

  const eventOptions = useMemo(() => {
    return events.map((e) => ({ id: e.id, label: `${e.name} (${e.metaEventName})` }));
  }, [events]);

  const statusRows = useMemo(() => {
    const rows = statuses.map((s) => {
      const draft = mappingDraft[s.slug];
      const mapping = (config?.mappings ?? []).find((m) => m.statusSlug === s.slug) ?? null;
      return {
        status: s,
        mapping,
        draft: draft ?? (mapping ? { eventId: mapping.eventId, enabled: mapping.enabled } : null)
      };
    });
    return rows.sort((a, b) => a.status.sortOrder - b.status.sortOrder);
  }, [config?.mappings, mappingDraft, statuses]);

  const saveConfig = async (event: FormEvent) => {
    event.preventDefault();
    setSavingConfig(true);
    setError(null);
    try {
      await api.patch(
        '/integrations/meta-ads',
        {
          enabled,
          n8nWebhookUrl: n8nWebhookUrl || null,
          pixelId: pixelId || null,
          accessToken: accessToken || null,
          testEventCode: testEventCode || null,
          defaultContentName: defaultContentName || null,
          defaultContentCategory: defaultContentCategory || null
        },
        { params: { integrationId: selectedIntegrationId || undefined } }
      );
      await fetchConfig(selectedIntegrationId || undefined);
      await fetchIntegrations();
    } catch {
      setError('Nao foi possivel salvar a configuracao.');
    } finally {
      setSavingConfig(false);
    }
  };

  const createEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !metaEventName.trim()) return;
    setCreatingEvent(true);
    setError(null);
    try {
      await api.post(
        '/integrations/meta-ads/events',
        { name: eventName.trim(), metaEventName: metaEventName.trim() },
        { params: { integrationId: selectedIntegrationId || undefined } }
      );
      setEventName('');
      setMetaEventName('');
      await fetchConfig(selectedIntegrationId || undefined);
    } catch {
      setError('Nao foi possivel criar o evento.');
    } finally {
      setCreatingEvent(false);
    }
  };

  const removeEvent = async (ev: MetaAdsEvent) => {
    setError(null);
    try {
      await api.delete(`/integrations/meta-ads/events/${ev.id}`, { params: { integrationId: selectedIntegrationId || undefined } });
      await fetchConfig(selectedIntegrationId || undefined);
    } catch {
      setError('Nao foi possivel remover o evento.');
    }
  };

  const saveMappings = async () => {
    setSavingMappings(true);
    setError(null);
    try {
      const items = Object.entries(mappingDraft)
        .filter(([, v]) => Boolean(v?.eventId))
        .map(([statusSlug, v]) => ({ statusSlug, eventId: v.eventId, enabled: v.enabled }));

      await api.post('/integrations/meta-ads/mappings', { items }, { params: { integrationId: selectedIntegrationId || undefined } });
      await fetchConfig(selectedIntegrationId || undefined);
    } catch {
      setError('Nao foi possivel salvar os vinculos.');
    } finally {
      setSavingMappings(false);
    }
  };

  const createIntegration = async (event: FormEvent) => {
    event.preventDefault();
    if (!newIntegrationName.trim()) return;
    setCreatingIntegration(true);
    setError(null);
    try {
      const { data } = await api.post<MetaAdsIntegration>('/integrations/meta-ads/integrations', {
        name: newIntegrationName.trim(),
        enabled: true,
        n8nWebhookUrl: newIntegrationWebhookUrl.trim() || null,
        pixelId: newIntegrationPixelId.trim() || null,
        accessToken: newIntegrationAccessToken.trim() || null,
        testEventCode: newIntegrationTestEventCode.trim() || null,
        defaultContentName: newIntegrationContentName.trim() || null,
        defaultContentCategory: newIntegrationContentCategory.trim() || null
      });
      setIsCreateIntegrationOpen(false);
      setNewIntegrationName('');
      setNewIntegrationWebhookUrl('');
      setNewIntegrationPixelId('');
      setNewIntegrationAccessToken('');
      setNewIntegrationTestEventCode('');
      setNewIntegrationContentName('');
      setNewIntegrationContentCategory('');
      await fetchIntegrations();
      setSelectedIntegrationId(data.id);
    } catch {
      setError('Nao foi possivel criar a integracao.');
    } finally {
      setCreatingIntegration(false);
    }
  };

  const removeIntegration = async () => {
    if (!selectedIntegrationId) return;
    if (integrations.length <= 1) return;
    if (!window.confirm('Deseja remover esta integracao Meta ADS? Essa acao nao pode ser desfeita.')) return;
    setError(null);
    try {
      await api.delete(`/integrations/meta-ads/integrations/${selectedIntegrationId}`);
      await fetchIntegrations();
      const next = integrations.filter((i) => i.id !== selectedIntegrationId);
      setSelectedIntegrationId(next[0]?.id ?? '');
    } catch {
      setError('Nao foi possivel remover a integracao.');
    }
  };

  const upsertDraft = (status: LeadStatus, value: { eventId: string; enabled: boolean } | null) => {
    setMappingDraft((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[status.slug];
      } else {
        next[status.slug] = value;
      }
      return next;
    });
  };

  const getMappedLabel = (m: MetaAdsStatusMapping | null) => {
    if (!m) return '--';
    const ev = m.event;
    return ev ? `${ev.name} (${ev.metaEventName})` : m.eventId;
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Meta ADS</h2>
          <p className="text-sm text-gray-500">Configure token/pixel, eventos e vincule eventos a status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedIntegrationId}
            onChange={(e) => setSelectedIntegrationId(e.target.value)}
            className="h-10 min-w-[14rem] rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-primary focus:outline-none"
          >
            {integrations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsCreateIntegrationOpen(true)}
            className="h-10 rounded-lg border border-primary px-4 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            Nova integracao
          </button>
          <button
            type="button"
            disabled={integrations.length <= 1}
            onClick={() => void removeIntegration()}
            className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
          >
            Remover
          </button>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

      {loading || !config ? (
        <div className="py-10 text-center text-sm text-gray-500">Carregando...</div>
      ) : (
        <div className="grid gap-6">
          <form onSubmit={saveConfig} className="grid gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Ativar envio para Meta ADS
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Webhook
                <input
                  value={n8nWebhookUrl}
                  onChange={(e) => setN8nWebhookUrl(e.target.value)}
                  placeholder="https://.../webhook/..."
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>

              <label className="text-sm">
                Pixel ID
                <input
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder="1297769298779390"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>

              <label className="text-sm md:col-span-2">
                Access Token
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAB..."
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>

              <label className="text-sm">
                Test Event Code (opcional)
                <input
                  value={testEventCode}
                  onChange={(e) => setTestEventCode(e.target.value)}
                  placeholder="TEST123"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>

              <label className="text-sm">
                Content name (padrao)
                <input
                  value={defaultContentName}
                  onChange={(e) => setDefaultContentName(e.target.value)}
                  placeholder="Call Avaliacao"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>

              <label className="text-sm md:col-span-2">
                Content category (padrao)
                <input
                  value={defaultContentCategory}
                  onChange={(e) => setDefaultContentCategory(e.target.value)}
                  placeholder="High Ticket Service"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingConfig ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </form>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-700">Eventos de conversão</h3>
            </div>

            <form onSubmit={createEvent} className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                Nome (interno)
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ex: Compra"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>

              <label className="text-sm">
                Nome do evento (Meta)
                <input
                  value={metaEventName}
                  onChange={(e) => setMetaEventName(e.target.value)}
                  placeholder="Purchase"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={creatingEvent || !eventName.trim() || !metaEventName.trim()}
                className="mt-6 h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingEvent ? 'Criando...' : 'Adicionar evento'}
              </button>
            </form>

            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Nenhum evento cadastrado.</div>
            ) : (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{ev.name}</p>
                      <p className="truncate text-xs text-gray-500">{ev.metaEventName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeEvent(ev)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-700">Vincular status → evento</h3>
              <button
                type="button"
                disabled={savingMappings}
                onClick={() => void saveMappings()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingMappings ? 'Salvando...' : 'Salvar vínculos'}
              </button>
            </div>

            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {statusRows.map(({ status, mapping, draft }) => (
                <div key={status.id} className="grid gap-2 p-3 md:grid-cols-3 md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{status.name}</p>
                    <p className="truncate text-xs text-gray-500">{status.slug}</p>
                  </div>

                  <div className="text-xs text-gray-500 md:text-sm">{getMappedLabel(mapping)}</div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={draft?.eventId ?? ''}
                      onChange={(e) =>
                        upsertDraft(status, e.target.value ? { eventId: e.target.value, enabled: draft?.enabled ?? true } : null)
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none md:w-auto"
                    >
                      <option value="">Sem evento</option>
                      {eventOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <input
                        type="checkbox"
                        checked={draft?.enabled ?? false}
                        disabled={!draft?.eventId}
                        onChange={(e) => upsertDraft(status, draft ? { ...draft, enabled: e.target.checked } : null)}
                      />
                      Ativo
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500">
              O envio ocorre quando o lead muda para um status vinculado e a integração está ativa.
            </div>
          </div>
        </div>
      )}

      <Modal
        title="Nova integracao Meta ADS"
        isOpen={isCreateIntegrationOpen}
        onClose={() => setIsCreateIntegrationOpen(false)}
      >
        <form onSubmit={createIntegration} className="grid gap-3">
          <label className="text-sm">
            Nome
            <input
              value={newIntegrationName}
              onChange={(e) => setNewIntegrationName(e.target.value)}
              placeholder="Ex: Pixel Clinica A"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>

          <label className="text-sm">
            Webhook
            <input
              value={newIntegrationWebhookUrl}
              onChange={(e) => setNewIntegrationWebhookUrl(e.target.value)}
              placeholder="https://.../webhook/..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>

          <label className="text-sm">
            Pixel ID
            <input
              value={newIntegrationPixelId}
              onChange={(e) => setNewIntegrationPixelId(e.target.value)}
              placeholder="1297769298779390"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>

          <label className="text-sm">
            Access Token
            <input
              type="password"
              value={newIntegrationAccessToken}
              onChange={(e) => setNewIntegrationAccessToken(e.target.value)}
              placeholder="EAAB..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>

          <label className="text-sm">
            Test Event Code (opcional)
            <input
              value={newIntegrationTestEventCode}
              onChange={(e) => setNewIntegrationTestEventCode(e.target.value)}
              placeholder="TEST123"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>

          <label className="text-sm">
            Content name (padrao)
            <input
              value={newIntegrationContentName}
              onChange={(e) => setNewIntegrationContentName(e.target.value)}
              placeholder="Call Avaliacao"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>

          <label className="text-sm">
            Content category (padrao)
            <input
              value={newIntegrationContentCategory}
              onChange={(e) => setNewIntegrationContentCategory(e.target.value)}
              placeholder="High Ticket Service"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={creatingIntegration || !newIntegrationName.trim()}
            className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingIntegration ? 'Criando...' : 'Criar integracao'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
