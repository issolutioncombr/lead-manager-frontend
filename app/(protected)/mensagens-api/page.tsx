 'use client';
 
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import { useSearchParams } from 'next/navigation';
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
  updatedAt?: string;
   pushName?: string | null;
   phoneRaw?: string | null;
 };
 
 type ChatItem = { id: string; name: string | null; contact: string; lastMessage?: { text: string; timestamp: string; fromMe: boolean } | null };
 
 export default function MensagensApiPage() {
   const searchParams = useSearchParams();
   const [instanceId, setInstanceId] = useState<string>('');
   const [instances, setInstances] = useState<Array<{ id: string; name?: string | null }>>([]);
   const [chats, setChats] = useState<ChatItem[]>([]);
   const [chatSearch, setChatSearch] = useState('');
   const [phoneInput, setPhoneInput] = useState('');
   const [selectedContact, setSelectedContact] = useState<string | null>(null);
   const [messages, setMessages] = useState<Message[]>([]);
   const [isLoadingChats, setIsLoadingChats] = useState(false);
   const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferLocal, setPreferLocal] = useState(false);
  const [conversationLimit, setConversationLimit] = useState<number>(50);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [unreadByContact, setUnreadByContact] = useState<Record<string, number>>({});
   const [text, setText] = useState('');
   const [mediaUrl, setMediaUrl] = useState('');
   const [caption, setCaption] = useState('');
   const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
   const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const scrollToBottomNextRef = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const conversationLimitRef = useRef<number>(50);
  const lastCursorRef = useRef<{ lastTimestamp: string; lastUpdatedAt: string }>({
    lastTimestamp: new Date(0).toISOString(),
    lastUpdatedAt: new Date(0).toISOString()
  });
 
   const normalizedPhone = useMemo(() => (selectedContact ?? '').replace(/\D+/g, ''), [selectedContact]);
 
  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const messageKey = useCallback((m: Message) => m.wamid ?? m.id, []);

  const mergeMessages = useCallback((current: Message[], incoming: Message[]) => {
    if (!incoming.length) return current;
    const byKey = new Map<string, Message>();
    for (const m of current) byKey.set(messageKey(m), m);
    for (const m of incoming) {
      const key = messageKey(m);
      const prev = byKey.get(key);
      byKey.set(key, prev ? { ...prev, ...m } : m);
    }
    const out = Array.from(byKey.values());
    out.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return out;
  }, [messageKey]);
 
   useEffect(() => {
     const loadInstances = async () => {
       try {
         const resp = await api.get('/integrations/evolution/instances/list');
         const list = Array.isArray(resp.data) ? resp.data : [];
        setInstances(
          list
            .map((x: any) => ({
              id: x.instanceId ?? x.id ?? x.instanceName ?? x.name ?? 'unknown',
              name: x.name ?? x.instanceId ?? x.id ?? null
            }))
            .filter((x: any) => typeof x.id === 'string' && x.id.length > 0)
        );
       } catch {}
     };
     loadInstances();
   }, []);
 
  const loadChats = useCallback(async () => {
     try {
       setIsLoadingChats(true);
       setError(null);
       const params: Record<string, any> = {};
       if (instanceId) params.instanceId = instanceId;
      const resp = await api.get<{ data: ChatItem[] }>('/integrations/evolution/messages/chats', { params: { ...params, source: preferLocal ? 'local' : 'provider' } });
       const data = Array.isArray(resp.data.data) ? resp.data.data : [];
       data.sort((a, b) => {
         const at = a.lastMessage?.timestamp ?? null;
         const bt = b.lastMessage?.timestamp ?? null;
         if (at && bt) return new Date(bt).getTime() - new Date(at).getTime();
         if (at && !bt) return -1;
         if (!at && bt) return 1;
         return 0;
       });
       setChats(data);
     } catch (e) {
       const status = (e as any)?.response?.status;
      setError(`Não foi possível carregar as conversas${status ? ` (código ${status})` : ''}.`);
     } finally {
       setIsLoadingChats(false);
     }
  }, [instanceId, preferLocal]);
 
   useEffect(() => {
    void loadChats();
  }, [loadChats]);
 
   const filteredChats = useMemo(() => {
     const q = chatSearch.trim().toLowerCase();
     if (!q) return chats;
     return chats.filter((c) => (c.name ?? '').toLowerCase().includes(q) || c.contact.includes(q));
   }, [chats, chatSearch]);
 
  const getConversation = useCallback(async (contact: string, limit: number, sourceOverride?: 'provider' | 'local') => {
     const phone = contact.replace(/\D+/g, '');
     if (!phone || phone.length < 7) return;
     try {
       const params: Record<string, any> = { phone };
       if (instanceId) params.instanceId = instanceId;
       if (directionFilter !== 'all') params.direction = directionFilter;
      params.limit = limit;
      const resp = await api.get<{ data: Message[] }>(
         '/integrations/evolution/messages/conversation',
        { params: { ...params, source: sourceOverride ?? (preferLocal ? 'local' : 'provider') } }
       );
      return resp.data.data;
     } catch (e) {
       const status = (e as any)?.response?.status;
      setError(`Não foi possível carregar a conversa${status ? ` (código ${status})` : ''}.`);
     } finally {
     }
  }, [directionFilter, instanceId, preferLocal]);

  const applyConversation = useCallback(async (contact: string, limit: number, opts?: { preserveScroll?: boolean; allowRetryLocal?: boolean }) => {
    const el = messagesContainerRef.current;
    const prevScrollHeight = opts?.preserveScroll ? (el?.scrollHeight ?? 0) : 0;
    const prevScrollTop = opts?.preserveScroll ? (el?.scrollTop ?? 0) : 0;

    setIsLoadingMessages(true);
    setError(null);
    let data = await getConversation(contact, limit);
    if (!Array.isArray(data) && !preferLocal && opts?.allowRetryLocal !== false) {
      setPreferLocal(true);
      data = await getConversation(contact, limit, 'local');
    }
    if (!Array.isArray(data)) {
      setIsLoadingMessages(false);
      return;
    }
    setMessages(data);
    lastMessageIdRef.current = data.length ? (data[data.length - 1]?.id ?? null) : null;
    setHasNewMessages(false);
    setUnreadByContact((prev) => {
      const phone = contact.replace(/\D+/g, '');
      if (!phone) return prev;
      if (!prev[phone]) return prev;
      const copy = { ...prev };
      delete copy[phone];
      return copy;
    });

    const lastTs = data.length ? data[data.length - 1]?.timestamp : null;
    lastCursorRef.current = {
      lastTimestamp: lastTs ? new Date(lastTs).toISOString() : new Date(0).toISOString(),
      lastUpdatedAt: new Date().toISOString()
    };

    requestAnimationFrame(() => {
      const target = messagesContainerRef.current;
      if (!target) return;
      if (scrollToBottomNextRef.current || isAtBottomRef.current) {
        scrollToBottomNextRef.current = false;
        scrollToBottom();
        return;
      }
      if (opts?.preserveScroll) {
        const newScrollHeight = target.scrollHeight;
        target.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
      }
    });

    setIsLoadingMessages(false);
  }, [getConversation, preferLocal, scrollToBottom]);

  useEffect(() => {
    conversationLimitRef.current = conversationLimit;
  }, [conversationLimit]);

  useEffect(() => {
    if (!selectedContact) return;
    void applyConversation(selectedContact, conversationLimitRef.current);
  }, [applyConversation, selectedContact]);
 
   useEffect(() => {
     const phoneParam = searchParams.get('phone');
     const directionParam = searchParams.get('direction');
     if (directionParam === 'inbound' || directionParam === 'outbound') {
       setDirectionFilter(directionParam as any);
     }
    if (phoneParam && typeof phoneParam === 'string') {
      const n = phoneParam.replace(/\D+/g, '');
      if (n && n.length >= 7) {
        setSelectedContact(n);
      }
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
 
  const sendMessage = useCallback(async () => {
     if (!normalizedPhone || (!text && !mediaUrl)) return;
     const clientMessageId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
     const clientWamid = `client-${clientMessageId}`;
     try {
       setError(null);
      scrollToBottomNextRef.current = true;
      const now = new Date();
      const optimistic: Message = {
        id: clientWamid,
        wamid: clientWamid,
        fromMe: true,
        direction: 'OUTBOUND',
        conversation: text || null,
        caption: caption || null,
        mediaUrl: mediaUrl || null,
        messageType: mediaUrl ? 'media' : 'text',
        deliveryStatus: 'QUEUED',
        timestamp: now.toISOString(),
        updatedAt: now.toISOString(),
        pushName: null,
        phoneRaw: normalizedPhone
      };
      setMessages((curr) => mergeMessages(curr, [optimistic]));
      setChats((curr) => {
        const contact = normalizedPhone;
        const lastText = mediaUrl ? (caption || 'Anexo') : (text || '');
        const updated = curr.map((c) =>
          c.contact === contact
            ? { ...c, lastMessage: { text: lastText || 'Mensagem', timestamp: now.toISOString(), fromMe: true } }
            : c
        );
        if (!updated.some((c) => c.contact === contact)) {
          updated.unshift({ id: contact, name: null, contact, lastMessage: { text: lastText || 'Mensagem', timestamp: now.toISOString(), fromMe: true } });
        }
        updated.sort((a, b) => {
          const at = a.lastMessage?.timestamp ?? null;
          const bt = b.lastMessage?.timestamp ?? null;
          if (at && bt) return new Date(bt).getTime() - new Date(at).getTime();
          if (at && !bt) return -1;
          if (!at && bt) return 1;
          return 0;
        });
        return updated;
      });
       await api.post('/integrations/evolution/messages/send', {
         phone: `+${normalizedPhone}`,
         text: text || undefined,
         mediaUrl: mediaUrl || undefined,
         caption: caption || undefined,
        clientMessageId,
         instanceId: instanceId || undefined
       });
       setText('');
       setCaption('');
       setMediaUrl('');
     } catch (e) {
       setMessages((curr) =>
         curr.map((m) =>
           (m.wamid ?? m.id) === clientWamid
             ? { ...m, deliveryStatus: 'FAILED', updatedAt: new Date().toISOString() }
             : m
         )
       );
       setError('Falha ao enviar mensagem.');
     }
 }, [caption, instanceId, mediaUrl, mergeMessages, normalizedPhone, text]);
 
   useEffect(() => {
    if (!selectedContact) return;
     const id = window.setInterval(() => {
      const phone = selectedContact.replace(/\D+/g, '');
      const cursor = lastCursorRef.current;
      void (async () => {
        try {
          const params: Record<string, any> = {
            phone,
            limit: 50,
            source: 'local',
            afterTimestamp: cursor.lastTimestamp,
            afterUpdatedAt: cursor.lastUpdatedAt
          };
          const resp = await api.get<{ data: Message[]; cursor?: { lastTimestamp?: string; lastUpdatedAt?: string } }>(
            '/integrations/evolution/messages/updates',
            { params }
          );
          const incoming = Array.isArray(resp.data.data) ? resp.data.data : [];
          if (!incoming.length) return;

          const newLastTimestamp = resp.data.cursor?.lastTimestamp ?? incoming[incoming.length - 1]?.timestamp ?? cursor.lastTimestamp;
          const newLastUpdatedAt = resp.data.cursor?.lastUpdatedAt ?? cursor.lastUpdatedAt;
          lastCursorRef.current = {
            lastTimestamp: new Date(newLastTimestamp).toISOString(),
            lastUpdatedAt: new Date(newLastUpdatedAt).toISOString()
          };

          const lastId = incoming.length ? (incoming[incoming.length - 1]?.id ?? null) : null;
          if (lastId && lastId !== lastMessageIdRef.current) {
            lastMessageIdRef.current = lastId;
          }

          setMessages((curr) => mergeMessages(curr, incoming));

          const newest = incoming[incoming.length - 1];
          const newestText = newest.mediaUrl ? (newest.caption || 'Anexo') : (newest.conversation || '');
          setChats((curr) => {
            const updated = curr.map((c) =>
              c.contact === phone
                ? { ...c, lastMessage: { text: newestText || 'Mensagem', timestamp: newest.timestamp, fromMe: !!newest.fromMe } }
                : c
            );
            if (!updated.some((c) => c.contact === phone)) {
              updated.unshift({
                id: phone,
                name: newest.pushName ?? null,
                contact: phone,
                lastMessage: { text: newestText || 'Mensagem', timestamp: newest.timestamp, fromMe: !!newest.fromMe }
              });
            }
            updated.sort((a, b) => {
              const at = a.lastMessage?.timestamp ?? null;
              const bt = b.lastMessage?.timestamp ?? null;
              if (at && bt) return new Date(bt).getTime() - new Date(at).getTime();
              if (at && !bt) return -1;
              if (!at && bt) return 1;
              return 0;
            });
            return updated;
          });

          const inboundCount = incoming.filter((m) => !(m.direction === 'OUTBOUND' || m.fromMe)).length;

          if (isAtBottomRef.current) {
            scrollToBottomNextRef.current = true;
            requestAnimationFrame(() => scrollToBottom());
          } else {
            if (inboundCount > 0) {
              setHasNewMessages(true);
              setUnreadByContact((prev) => ({ ...prev, [phone]: (prev[phone] ?? 0) + inboundCount }));
            }
          }
        } catch {
          setHasNewMessages(false);
        }
      })();
    }, 2000);
     return () => {
       window.clearInterval(id);
     };
 }, [mergeMessages, scrollToBottom, selectedContact]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 80;

    if (el.scrollTop < 60 && !isLoadingMessages && conversationLimit < 200 && selectedContact) {
      const next = Math.min(200, conversationLimit + 50);
      if (next !== conversationLimit) {
        setConversationLimit(next);
        void applyConversation(selectedContact, next, { preserveScroll: true });
      }
    }
  }, [applyConversation, conversationLimit, isLoadingMessages, selectedContact]);
 
   const formatPhone = (raw?: string | null) => {
     if (!raw) return '';
     const d = raw.replace(/\D+/g, '');
     if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
     if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
     return raw;
   };

  const formatChatTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  const dateLabel = useCallback((iso: string) => {
    const dt = new Date(iso);
    const now = new Date();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (dt.toDateString() === now.toDateString()) return 'Hoje';
    if (dt.toDateString() === y.toDateString()) return 'Ontem';
    return dt.toLocaleDateString();
  }, []);

  const statusGlyph = (s?: Message['deliveryStatus'] | null) => {
    if (!s) return '';
    if (s === 'QUEUED') return '🕘';
    if (s === 'SENT') return '✓';
    if (s === 'DELIVERED') return '✓✓';
    if (s === 'READ') return '✓✓';
    if (s === 'FAILED') return '!';
    return '';
  };

  const statusColor = (s?: Message['deliveryStatus'] | null) => {
    if (s === 'READ') return 'text-sky-300';
    if (s === 'FAILED') return 'text-red-300';
    return 'text-white/70';
  };

  const renderedMessages = useMemo(() => {
    const items: Array<{ type: 'date'; id: string; label: string } | { type: 'msg'; id: string; msg: Message }> = [];
    let lastDay: string | null = null;
    for (const m of messages) {
      const day = new Date(m.timestamp).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        items.push({ type: 'date', id: `d-${day}`, label: dateLabel(m.timestamp) });
      }
      items.push({ type: 'msg', id: messageKey(m), msg: m });
    }
    return items;
  }, [dateLabel, messageKey, messages]);
 
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
                <li key={`${chat.id}-${chat.contact}`}>
                   <button
                     onClick={() => {
                       setSelectedContact(chat.contact);
                       setMessages([]);
                       setConversationLimit(50);
                       setHasNewMessages(false);
                       lastMessageIdRef.current = null;
                      lastCursorRef.current = { lastTimestamp: new Date(0).toISOString(), lastUpdatedAt: new Date(0).toISOString() };
                     }}
                     className={[
                       'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                       selectedContact === chat.contact ? 'bg-gray-50' : 'hover:bg-gray-50'
                     ].join(' ')}
                   >
                     <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                       {(chat.name ?? chat.contact ?? 'C')[0]}
                     </div>
                     <div className="min-w-0">
                       <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{chat.name ?? (formatPhone(chat.contact) || 'Sem nome')}</p>
                         <span className="ml-auto text-[11px] text-gray-400">{formatChatTime(chat.lastMessage?.timestamp ?? null)}</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <p className="truncate text-xs text-gray-500">{formatPhone(chat.contact)}</p>
                         {!!unreadByContact[chat.contact] && (
                           <span className="ml-auto rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                             {unreadByContact[chat.contact]}
                           </span>
                         )}
                       </div>
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
           <div className="border-t p-3">
             <div className="space-y-2">
               <label className="block text-xs text-gray-500">Abrir conversa por número</label>
               <div className="flex gap-2">
                 <input
                   value={phoneInput}
                   onChange={(e) => setPhoneInput(e.target.value)}
                   placeholder="Ex.: 5511999999999"
                   className="w-full rounded-md border px-3 py-2 text-sm"
                 />
                 <button
                   onClick={() => {
                     const n = phoneInput.replace(/\D+/g, '');
                     if (n) {
                       setSelectedContact(n);
                       setMessages([]);
                       setConversationLimit(50);
                       setHasNewMessages(false);
                       lastMessageIdRef.current = null;
                     }
                   }}
                   className="rounded-md border px-3 py-2 text-sm"
                 >
                   Abrir
                 </button>
               </div>
             </div>
           </div>
         </div>
       </aside>
 
      <section className="flex-1 rounded-lg border bg-[#0b141a]">
        <div className="border-b border-[#202c33] px-4 py-3 text-[#e9edef]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
              {(selectedContact ? formatPhone(selectedContact) : 'C')[0]}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{selectedContact ? formatPhone(selectedContact) : 'Selecione uma conversa'}</h2>
              <p className="truncate text-xs text-[#8696a0]">{selectedContact ? `+${normalizedPhone}` : '—'}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => {
                  if (!selectedContact) return;
                  scrollToBottomNextRef.current = true;
                  void applyConversation(selectedContact, conversationLimitRef.current, { allowRetryLocal: true });
                }}
                className="rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
        <div className="flex h-full flex-col">
          <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto p-6">
             {!selectedContact && <div className="text-sm text-gray-500">Selecione uma conversa para visualizar.</div>}
             {selectedContact && isLoadingMessages && (
               <div className="space-y-2">
                 {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-start">
                    <div className="h-14 w-64 animate-pulse rounded-2xl bg-[#202c33]" />
                   </div>
                 ))}
               </div>
             )}
            {selectedContact && !isLoadingMessages && renderedMessages.map((it) => {
              if (it.type === 'date') {
                return (
                  <div key={it.id} className="my-3 flex justify-center">
                    <span className="rounded-full bg-[#202c33] px-3 py-1 text-[11px] text-[#e9edef]">{it.label}</span>
                  </div>
                );
              }
              const msg = it.msg;
              const isMine = (msg.direction === 'OUTBOUND') || !!msg.fromMe;
              return (
                <div key={it.id} className={`mb-2 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={[
                      'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                      isMine ? 'bg-[#005c4b] text-white rounded-br-md' : 'bg-[#202c33] text-[#e9edef] rounded-bl-md'
                    ].join(' ')}
                  >
                    {msg.mediaUrl ? (
                      <div>
                        <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="underline">
                          Anexo
                        </a>
                        {msg.caption && <div className="mt-1 whitespace-pre-wrap">{msg.caption}</div>}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.conversation ?? `[${msg.messageType ?? 'mensagem'}]`}</p>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-2 text-[11px]">
                      <span className={isMine ? 'text-white/70' : 'text-[#8696a0]'}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMine && (
                        <span className={statusColor(msg.deliveryStatus ?? null)}>{statusGlyph(msg.deliveryStatus ?? null)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
             {selectedContact && !isLoadingMessages && messages.length === 0 && (
              <div className="text-sm text-[#8696a0]">Nenhuma mensagem.</div>
             )}
           </div>
          <div className="border-t border-[#202c33] p-3 text-[#e9edef]">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-[#8696a0]">{selectedContact ? formatPhone(selectedContact) : '—'}</span>
              <div className="ml-auto flex items-center gap-2">
                {hasNewMessages && (
                  <button
                    onClick={() => {
                      if (selectedContact) {
                        scrollToBottomNextRef.current = true;
                        scrollToBottom();
                        setHasNewMessages(false);
                        setUnreadByContact((prev) => {
                          const phone = selectedContact.replace(/\D+/g, '');
                          if (!phone || !prev[phone]) return prev;
                          const copy = { ...prev };
                          delete copy[phone];
                          return copy;
                        });
                      }
                    }}
                    className="rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
                  >
                    Novas mensagens
                  </button>
                )}
                <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as any)} className="rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]">
                  <option value="all">Todas</option>
                  <option value="inbound">Recebidas</option>
                  <option value="outbound">Enviadas</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite uma mensagem"
                className="flex-1 rounded-2xl border border-[#202c33] bg-[#202c33] px-4 py-2 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none"
                aria-label="Mensagem"
              />
              <button onClick={sendMessage} className="rounded-full bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white" aria-label="Enviar">
                Enviar
              </button>
            </div>
          {error && (
            <div className="mt-2 text-sm text-red-400">
              {error}
              <button
                onClick={() => { setPreferLocal(true); setError(null); }}
                className="ml-2 rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
              >
                Ler fonte local
              </button>
            </div>
          )}
          </div>
         </div>
       </section>
 
      
     </div>
   );
 }
