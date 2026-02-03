'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../lib/api';

type Message = {
  id: string;
  wamid: string | null;
  fromMe: boolean;
  direction?: 'INBOUND' | 'OUTBOUND' | null;
  conversation?: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  messageType?: string | null;
  deliveryStatus?: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null;
  timestamp: string;
  pushName?: string | null;
  phoneRaw?: string | null;
};

type ChatItem = { id: string; name: string | null; contact: string; lastMessage?: { text: string; timestamp: string; fromMe: boolean } | null };

export default function MensagensApiPage() {
  const [instanceId, setInstanceId] = useState<string>('');
  const [instances, setInstances] = useState<Array<{ id: string; name?: string | null }>>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatSearch, setChatSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const normalizedPhone = useMemo(() => (selectedContact ?? '').replace(/\D+/g, ''), [selectedContact]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const loadInstances = async () => {
      try {
        const resp = await api.get('/integrations/evolution/instances/list');
        const list = Array.isArray(resp.data) ? resp.data : [];
        setInstances(list.map((x: any) => ({ id: x.instanceName ?? x.id ?? x.name ?? 'unknown', name: x.name ?? x.instanceName ?? x.id })));
      } catch {}
    };
    loadInstances();
  }, []);

  const loadChats = async () => {
    try {
      setIsLoadingChats(true);
      setError(null);
      const params: Record<string, any> = {};
      if (instanceId) params.instanceId = instanceId;
      const resp = await api.get<{ data: ChatItem[] }>('/integrations/evolution/messages/chats', { params });
      setChats(resp.data.data);
    } catch (e) {
      const status = (e as any)?.response?.status;
      setError(`Não foi possível carregar as conversas${status ? ` (código ${status})` : ''}.`);
    } finally {
      setIsLoadingChats(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, [instanceId]);

  const filteredChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => (c.name ?? '').toLowerCase().includes(q) || c.contact.includes(q));
  }, [chats, chatSearch]);

  const fetchConversation = async (contact: string) => {
    const phone = contact.replace(/\D+/g, '');
    if (!phone || phone.length < 7) return;
    try {
      setIsLoadingMessages(true);
      setError(null);
      const params: Record<string, any> = { phone };
      if (instanceId) params.instanceId = instanceId;
      if (directionFilter !== 'all') params.direction = directionFilter;
      const resp = await api.get<{ data: Message[] }>(
        '/integrations/evolution/messages/conversation',
        { params }
      );
      setMessages(resp.data.data);
    } catch (e) {
      const status = (e as any)?.response?.status;
      setError(`Não foi possível carregar a conversa${status ? ` (código ${status})` : ''}.`);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!normalizedPhone || (!text && !mediaUrl)) return;
    try {
      setError(null);
      await api.post('/integrations/evolution/messages/send', {
        phone: `+${normalizedPhone}`,
        text: text || undefined,
        mediaUrl: mediaUrl || undefined,
        caption: caption || undefined,
        instanceId: instanceId || undefined
      });
      setText('');
      setCaption('');
      setMediaUrl('');
      await fetchConversation(normalizedPhone);
    } catch (e) {
      setError('Falha ao enviar mensagem.');
    }
  };

  useEffect(() => {
    if (!normalizedPhone) return;
    const id = window.setInterval(() => {
      fetchConversation(normalizedPhone);
    }, 5000);
    return () => {
      window.clearInterval(id);
    };
  }, [normalizedPhone, directionFilter]);

  const formatPhone = (raw?: string | null) => {
    if (!raw) return '';
    const d = raw.replace(/\D+/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return raw;
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-4">
      <aside className="w-80 shrink-0 rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Conversas (Evolution)</h2>
          <div className="mt-2 flex items-center gap-2">
            <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)} className="rounded-md border px-2 py-1 text-xs" aria-label="Instância">
              <option value="">Todas instâncias</option>
              {instances.map((i) => (
                <option key={i.id} value={i.id}>{i.name ?? i.id}</option>
              ))}
            </select>
            <input
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Buscar por número ou nome"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Direção:</span>
            <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as any)} className="rounded-md border px-2 py-1 text-xs">
              <option value="all">Todas</option>
              <option value="inbound">Recebidas</option>
              <option value="outbound">Enviadas</option>
            </select>
          </div>
        </div>
        <div className="h-full overflow-y-auto">
          {isLoadingChats ? (
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
              {filteredChats.map((chat) => (
                <li key={chat.id}>
                  <button
                    onClick={() => { setSelectedContact(chat.contact); fetchConversation(chat.contact); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {(chat.name ?? chat.contact ?? 'C')[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{chat.name ?? 'Sem nome'}</p>
                      <p className="truncate text-xs text-gray-500">{chat.contact}</p>
                      {chat.lastMessage && (
                        <p className="truncate text-xs text-gray-400">
                          <span>{chat.lastMessage.fromMe ? '↗' : '↙'}</span>{' '}
                          {chat.lastMessage.text}{' '}•{' '}
                          {new Date(chat.lastMessage.timestamp).toLocaleString()}
                        </p>
                      )}
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
          <h2 className="text-lg font-semibold">{selectedContact ? formatPhone(selectedContact) : 'Selecione uma conversa'}</h2>
        </div>
        <div className="flex h-full flex-col">
          <div ref={messagesContainerRef} className="flex-1 space-y-2 overflow-y-auto p-4">
            {!selectedContact && <div className="text-sm text-gray-500">Selecione uma conversa para visualizar.</div>}
            {selectedContact && isLoadingMessages && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-start">
                    <div className="h-14 w-64 animate-pulse rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            )}
            {selectedContact && !isLoadingMessages && messages.map((msg) => {
              const isMine = !!msg.fromMe;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mt-2`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${isMine ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    <div className="flex items-center gap-2 text-[11px] opacity-80">
                      <span>{isMine ? '↗' : '↙'}</span>
                      {!isMine && msg.pushName && <span>{msg.pushName}</span>}
                    </div>
                    {msg.mediaUrl ? (
                      <div className="mt-1">
                        <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="underline">Anexo</a>
                        {msg.caption && <div className="mt-1 whitespace-pre-wrap">{msg.caption}</div>}
                      </div>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap">{msg.conversation ?? `[${msg.messageType ?? 'mensagem'}]`}</p>
                    )}
                    <div className={`mt-1 text-[11px] ${isMine ? 'text-white/90' : 'text-gray-500'}`}>
                      {new Date(msg.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedContact && !isLoadingMessages && messages.length === 0 && (
              <div className="text-sm text-gray-500">Nenhuma mensagem.</div>
            )}
          </div>
          <div className="flex items-center justify-between border-t p-3">
            <div className="text-xs text-gray-500">{selectedContact ? formatPhone(selectedContact) : '—'}</div>
            <div className="flex items-center gap-2">
              <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as any)} className="rounded-md border px-2 py-1 text-xs">
                <option value="all">Todas</option>
                <option value="inbound">Recebidas</option>
                <option value="outbound">Enviadas</option>
              </select>
            </div>
          </div>
          {error && <div className="border-t p-3 text-sm text-red-600">{error}</div>}
        </div>
      </section>

      <aside className="w-96 shrink-0 rounded-lg border bg-white p-4">
        <h3 className="text-base font-semibold">Enviar</h3>
        <div className="mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensagem de texto"
            className="h-28 w-full rounded-md border px-3 py-2 text-sm"
            aria-label="Mensagem"
          />
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="URL de mídia (opcional)"
            className="w-full rounded-md border px-3 py-2 text-sm"
            aria-label="URL de mídia"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Legenda (opcional)"
            className="w-full rounded-md border px-3 py-2 text-sm"
            aria-label="Legenda"
          />
          <button onClick={sendMessage} className="w-full rounded-md border px-3 py-2 text-sm" aria-label="Enviar">
            Enviar
          </button>
        </div>
      </aside>
    </div>
  );
}
