'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

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
        const resp = await api.get<LeadsResponse>('/leads', { params: { page: 1, limit: 200 } });
        setLeads(resp.data.data);
      } catch (e) {
        setError('Não foi possível carregar os leads.');
      } finally {
        setIsLoadingLeads(false);
      }
    };
    fetchLeads();
  }, []);

  const openLead = async (lead: Lead) => {
    setSelectedLead(lead);
    const reqId = ++latestRequestRef.current;
    try {
      setIsLoadingMessages(true);
      setError(null);
      const resp = await api.get<Message[]>(`/leads/${lead.id}/messages`);
      if (reqId !== latestRequestRef.current) return;
      setMessages(resp.data);
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

  return (
    <div className="flex h-[calc(100vh-100px)] gap-4">
      <aside className="w-80 shrink-0 rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <p className="text-xs text-gray-500">Selecione um lead para abrir o chat</p>
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
      </aside>

      <section className="flex-1 rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">
            {selectedLead ? selectedLead.name ?? selectedLead.contact ?? 'Lead' : 'Nenhum lead selecionado'}
          </h2>
          <p className="text-xs text-gray-500">
            {selectedLead ? selectedLead.contact ?? '' : 'Clique em um lead para abrir a conversa'}
          </p>
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
          {error && <div className="border-t p-3 text-sm text-red-600">{error}</div>}
        </div>
      </section>
    </div>
  );
}
