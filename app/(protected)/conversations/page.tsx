'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { Lead } from '../../../types';

type Message = {
  id: string;
  wamid: string;
  fromMe: boolean;
  conversation?: string | null;
  messageType?: string | null;
  timestamp: string;
  pushName?: string | null;
  phoneRaw?: string | null;
};

type LeadsResponse = {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
};

export default function ConversationsPage() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsLimit, setLeadsLimit] = useState(30);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagePage, setMessagePage] = useState(1);
  const [messageLimit, setMessageLimit] = useState(50);
  const [textOnly, setTextOnly] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);
  const [leadSearch, setLeadSearch] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const aName = (a.name ?? a.contact ?? '').toLowerCase();
      const bName = (b.name ?? b.contact ?? '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [leads]);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setIsLoadingLeads(true);
        setError(null);
        const resp = await api.get<LeadsResponse>('/leads', {
          params: {
            page: leadsPage,
            limit: leadsLimit,
            search: leadSearch || undefined,
            includeLastMessage: true
          }
        });
        setLeads(resp.data.data as any);
        setLeadsTotal(resp.data.total);
        setLeadsPage(resp.data.page);
      } catch (e) {
        setError('Não foi possível carregar os leads.');
      } finally {
        setIsLoadingLeads(false);
      }
    };
    fetchLeads();
  }, [leadSearch, leadsLimit, leadsPage]);

  const handleLeadsPrev = () => {
    if (isLoadingLeads || leadsPage <= 1) return;
    setLeadsPage((p) => Math.max(1, p - 1));
  };

  const handleLeadsNext = () => {
    const maxPage = Math.max(1, Math.ceil(leadsTotal / leadsLimit));
    if (isLoadingLeads || leadsPage >= maxPage) return;
    setLeadsPage((p) => Math.min(maxPage, p + 1));
  };

  const leadsFrom = useMemo(() => {
    if (leadsTotal === 0) return 0;
    return (leadsPage - 1) * leadsLimit + 1;
  }, [leadsPage, leadsLimit, leadsTotal]);

  

  const handleRetryLeads = () => {
    setError(null);
    setIsLoadingLeads(true);
    setLeadsPage((p) => p);
  };

  const handleRetryMessages = () => {
    setError(null);
    if (selectedLead) {
      loadMessagesPage(messagePage);
    }
  };

  const formatPhone = (raw?: string | null) => {
    if (!raw) return '';
    const d = raw.replace(/\D+/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return raw;
  };

  const dateLabel = (iso: string) => {
    const dt = new Date(iso);
    const now = new Date();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (dt.toDateString() === now.toDateString()) return 'Hoje';
    if (dt.toDateString() === y.toDateString()) return 'Ontem';
    return dt.toLocaleDateString();
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, selectedLead]);

  const leadsTo = useMemo(() => {
    if (leadsTotal === 0) return 0;
    return Math.min(leadsPage * leadsLimit, leadsTotal);
  }, [leadsPage, leadsLimit, leadsTotal]);

  const openLead = useCallback(async (lead: Lead) => {
    setSelectedLead(lead);
    setMessagePage(1);
    const reqId = ++latestRequestRef.current;
    try {
      setIsLoadingMessages(true);
      setError(null);
      const resp = await api.get<{ data: Message[]; total: number; page: number; limit: number }>(
        `/leads/${lead.id}/messages`,
        { params: { page: 1, limit: messageLimit, textOnly } }
      );
      if (reqId !== latestRequestRef.current) return;
      setMessages(resp.data.data);
      setMessagesTotal(resp.data.total);
    } catch (e) {
      if (reqId === latestRequestRef.current) {
        setError('Não foi possível carregar a conversa.');
      }
    } finally {
      if (reqId === latestRequestRef.current) {
        setIsLoadingMessages(false);
      }
    }
  }, [messageLimit, textOnly]);

  // Deep link ?leadId=
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId || leads.length === 0) return;
    const found = leads.find((l) => l.id === leadId);
    if (found) {
      openLead(found);
    }
  }, [searchParams, leads, openLead]);
  const loadMessagesPage = async (page: number) => {
    if (!selectedLead) return;
    const reqId = ++latestRequestRef.current;
    try {
      setIsLoadingMessages(true);
      setError(null);
      const resp = await api.get<{ data: Message[]; total: number; page: number; limit: number }>(
        `/leads/${selectedLead.id}/messages`,
        { params: { page, limit: messageLimit, textOnly } }
      );
      if (reqId !== latestRequestRef.current) return;
      setMessages(resp.data.data);
      setMessagesTotal(resp.data.total);
      setMessagePage(resp.data.page);
    } catch (e) {
      if (reqId === latestRequestRef.current) {
        setError('Não foi possível carregar a conversa.');
      }
    } finally {
      if (reqId === latestRequestRef.current) {
        setIsLoadingMessages(false);
      }
    }
  };

  const handleToggleTextOnly = async () => {
    const next = !textOnly;
    setTextOnly(next);
    setMessagePage(1);
    if (selectedLead) {
      await loadMessagesPage(1);
    }
  };

  const handleLeadsSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = value.replace(/\D+/g, '');
    setLeadSearch(digits);
  };
  const [orderMode, setOrderMode] = useState<'alpha' | 'recent' | 'active'>('alpha');
  const orderedLeads = useMemo(() => {
    if (orderMode === 'alpha') return sortedLeads;
    const copy = [...leads] as any[];
    if (orderMode === 'recent') {
      copy.sort((a: any, b: any) => {
        const at = a.lastMessage?.timestamp ?? a.updatedAt ?? a.createdAt;
        const bt = b.lastMessage?.timestamp ?? b.updatedAt ?? b.createdAt;
        return new Date(bt).getTime() - new Date(at).getTime();
      });
      return copy;
    }
    // active: com última mensagem primeiro; sem mensagem por último; dentro de cada grupo, ordenar por recência
    copy.sort((a: any, b: any) => {
      const ahas = !!a.lastMessage?.timestamp;
      const bhas = !!b.lastMessage?.timestamp;
      if (ahas && !bhas) return -1;
      if (!ahas && bhas) return 1;
      const at = a.lastMessage?.timestamp ?? a.updatedAt ?? a.createdAt;
      const bt = b.lastMessage?.timestamp ?? b.updatedAt ?? b.createdAt;
      return new Date(bt).getTime() - new Date(at).getTime();
    });
    return copy;
  }, [orderMode, sortedLeads, leads]);

  const messagesFrom = useMemo(() => {
    if (messagesTotal === 0) return 0;
    return (messagePage - 1) * messageLimit + 1;
  }, [messagePage, messageLimit, messagesTotal]);

  const messagesTo = useMemo(() => {
    if (messagesTotal === 0) return 0;
    return Math.min(messagePage * messageLimit, messagesTotal);
  }, [messagePage, messageLimit, messagesTotal]);

  return (
    <div className="flex h-[calc(100vh-100px)] gap-4">
      <aside className="w-80 shrink-0 rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <div className="mt-2">
            <input
              value={leadSearch}
              onChange={handleLeadsSearchChange}
              placeholder="Buscar por número"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Ordenação:</span>
            <button
              onClick={() => setOrderMode('alpha')}
              className={`rounded-md px-2 py-1 text-xs ${orderMode === 'alpha' ? 'bg-primary/10 text-primary' : 'border'}`}
            >
              A–Z
            </button>
            <button
              onClick={() => setOrderMode('recent')}
              className={`rounded-md px-2 py-1 text-xs ${orderMode === 'recent' ? 'bg-primary/10 text-primary' : 'border'}`}
            >
              Recentes
            </button>
            <button
              onClick={() => setOrderMode('active')}
              className={`rounded-md px-2 py-1 text-xs ${orderMode === 'active' ? 'bg-primary/10 text-primary' : 'border'}`}
            >
              Ativos
            </button>
            <span className="ml-auto text-xs text-gray-500">Itens/página:</span>
            <select
              value={leadsLimit}
              onChange={(e) => setLeadsLimit(Math.max(10, Math.min(100, parseInt(e.target.value, 10) || 30)))}
              className="rounded-md border px-2 py-1 text-xs"
            >
              {[10, 20, 30, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Total: {leadsTotal}</span>
            <span>
              Mostrando {leadsFrom}–{leadsTo}
            </span>
          </div>
        </div>
        <div className="h-full overflow-y-auto">
          {isLoadingLeads ? (
            <div className="p-4">
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                    <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ul className="divide-y">
              {orderedLeads.map((lead: any) => (
                <li key={lead.id}>
                  <button
                    onClick={() => openLead(lead)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {(lead.name ?? lead.contact ?? 'L')[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{lead.name ?? 'Sem nome'}</p>
                      <p className="truncate text-xs text-gray-500">{lead.contact ?? 'Sem contato'}</p>
                      {lead.lastMessage && (
                        <p className="truncate text-xs text-gray-400">
                          <span>{lead.lastMessage.fromMe ? '↗' : '↙'}</span>{' '}
                          {lead.lastMessage.text ?? `[${lead.lastMessage.messageType ?? 'mensagem'}]`} •{' '}
                          {new Date(lead.lastMessage.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && !isLoadingLeads && (
            <div className="p-3 text-xs text-red-600">
              {error}{' '}
              <button onClick={handleRetryLeads} className="underline">
                Tentar novamente
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="text-xs text-gray-500">Página {leadsPage}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLeadsPrev}
              disabled={isLoadingLeads || leadsPage <= 1}
              className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={handleLeadsNext}
              disabled={isLoadingLeads || leadsTo >= leadsTotal}
              className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </aside>

      <section className="flex-1 rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">
            {selectedLead ? selectedLead.name ?? selectedLead.contact ?? 'Lead' : 'Nenhum lead selecionado'}
          </h2>
          <p className="text-xs text-gray-500">
            {selectedLead ? formatPhone(selectedLead.contact ?? '') : 'Clique em um lead para abrir a conversa'}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={textOnly} onChange={handleToggleTextOnly} />
              Apenas mensagens com texto
            </label>
            {selectedLead && (
              <div className="text-xs text-gray-500">
                Mostrando {messagesFrom}–{messagesTo} de {messagesTotal}
              </div>
            )}
            {error && !isLoadingMessages && selectedLead && (
              <button onClick={handleRetryMessages} className="text-xs underline">
                Tentar novamente
              </button>
            )}
          </div>
        </div>
        <div className="flex h-full flex-col">
          <div ref={messagesContainerRef} className="flex-1 space-y-2 overflow-y-auto p-4">
            {!selectedLead && <div className="text-sm text-gray-500">Selecione um lead para visualizar a conversa.</div>}
            {selectedLead && isLoadingMessages && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-start">
                    <div className="h-14 w-64 animate-pulse rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            )}
            {selectedLead &&
              !isLoadingMessages &&
              messages.map((msg, idx) => {
                const isMine = !!msg.fromMe;
                const prev = messages[idx - 1];
                const showDateSeparator =
                  idx === 0 ||
                  new Date(msg.timestamp).toDateString() !== new Date(prev?.timestamp ?? '').toDateString();
                const compactWithPrev = prev && prev.fromMe === msg.fromMe;
                return (
                  <div key={msg.id}>
                    {showDateSeparator && (
                      <div className="mb-2 mt-2 flex justify-center">
                        <span className="rounded bg-gray-200 px-2 py-1 text-[11px] text-gray-600">
                          {dateLabel(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${compactWithPrev ? 'mt-1' : 'mt-3'}`}>
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          isMine ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-[11px] opacity-80">
                          <span>{isMine ? '↗' : '↙'}</span>
                          {msg.pushName && !isMine && <span>{msg.pushName}</span>}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">
                          {msg.conversation ?? `[${msg.messageType ?? 'mensagem'}]`}
                        </p>
                        <div className={`mt-1 text-[11px] ${isMine ? 'text-white/90' : 'text-gray-500'}`}>
                          {new Date(msg.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            {selectedLead && !isLoadingMessages && messages.length === 0 && (
              <div className="text-sm text-gray-500">Não há mensagens para este lead.</div>
            )}
          </div>
          <div className="flex items-center justify-between border-t p-3">
            <div className="text-xs text-gray-500">
              Página {messagePage}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadMessagesPage(Math.max(1, messagePage - 1))}
                disabled={isLoadingMessages || messagePage <= 1}
                className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => loadMessagesPage(messagesTo < messagesTotal ? messagePage + 1 : messagePage)}
                disabled={isLoadingMessages || messagesTo >= messagesTotal}
                className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
          {error && <div className="border-t p-3 text-sm text-red-600">{error}</div>}
        </div>
      </section>
    </div>
  );
}
