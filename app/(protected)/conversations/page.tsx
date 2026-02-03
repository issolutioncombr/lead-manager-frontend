'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
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
          params: { page: leadsPage, limit: leadsLimit, search: leadSearch || undefined }
        });
        setLeads(resp.data.data);
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

  const leadsTo = useMemo(() => {
    if (leadsTotal === 0) return 0;
    return Math.min(leadsPage * leadsLimit, leadsTotal);
  }, [leadsPage, leadsLimit, leadsTotal]);

  const openLead = async (lead: Lead) => {
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
  };

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
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Total: {leadsTotal}</span>
            <span>
              Mostrando {leadsFrom}–{leadsTo}
            </span>
          </div>
        </div>
        <div className="h-full overflow-y-auto">
          {isLoadingLeads ? (
            <div className="p-4 text-sm text-gray-500">Carregando leads...</div>
          ) : (
            <ul className="divide-y">
              {sortedLeads.map((lead) => (
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
                    </div>
                  </button>
                </li>
              ))}
            </ul>
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
            {selectedLead ? selectedLead.contact ?? '' : 'Clique em um lead para abrir a conversa'}
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
          </div>
        </div>
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {!selectedLead && <div className="text-sm text-gray-500">Selecione um lead para visualizar a conversa.</div>}
            {selectedLead && isLoadingMessages && <div className="text-sm text-gray-500">Carregando conversa...</div>}
            {selectedLead &&
              !isLoadingMessages &&
              messages.map((msg) => {
                const isMine = !!msg.fromMe;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        isMine ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.conversation ?? `[${msg.messageType ?? 'mensagem'}]`}</p>
                      <div className={`mt-1 text-[11px] ${isMine ? 'text-white/90' : 'text-gray-500'}`}>
                        {new Date(msg.timestamp).toLocaleString()}
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
