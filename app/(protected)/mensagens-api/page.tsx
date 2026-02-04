 'use client';
 
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import { useSearchParams } from 'next/navigation';
 import api from '../../../lib/api';
import { getStoredAuth } from '../../../lib/auth-storage';
import { ChatHeader } from '../../../components/mensagens-api/ChatHeader';
import { ChatList } from '../../../components/mensagens-api/ChatList';
import { Composer } from '../../../components/mensagens-api/Composer';
import { MessagesList } from '../../../components/mensagens-api/MessagesList';
import type { ChatItem, Message, RenderedMessageItem } from '../../../components/mensagens-api/types';
 
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
  const [streamConnected, setStreamConnected] = useState(false);
  const [realtimeMode, setRealtimeMode] = useState<'stream' | 'poll'>(() =>
    process.env.NEXT_PUBLIC_MESSAGES_REALTIME_MODE === 'poll' ? 'poll' : 'stream'
  );
   const [text, setText] = useState('');
   const [mediaUrl, setMediaUrl] = useState('');
   const [caption, setCaption] = useState('');
   const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
   const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const scrollToBottomNextRef = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const conversationLimitRef = useRef<number>(50);
  const selectedContactRef = useRef<string | null>(null);
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
      if (!prev) {
        byKey.set(key, m);
        continue;
      }
      const merged: Message = { ...prev, ...m };
      const preserveIfNull: Array<keyof Message> = [
        'conversation',
        'caption',
        'mediaUrl',
        'messageType',
        'pushName',
        'direction',
        'phoneRaw',
        'timestamp',
        'updatedAt'
      ];
      for (const field of preserveIfNull) {
        const nextValue = (m as any)[field];
        if (nextValue === null || nextValue === undefined || nextValue === '') {
          (merged as any)[field] = (prev as any)[field];
        }
      }
      byKey.set(key, merged);
    }
    const out = Array.from(byKey.values());
    out.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return out;
  }, [messageKey]);

  const buildApiUrl = useCallback((path: string, params?: Record<string, string>) => {
    const base = (api.defaults.baseURL ?? '').replace(/\/+$/, '');
    const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }, []);

  const applyIncomingMessages = useCallback((phone: string, incoming: Message[]) => {
    if (!incoming.length) return;
    const maxIso = (a: string, b: string) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b);
    setMessages((curr) => mergeMessages(curr, incoming));

    const newest = incoming[incoming.length - 1];
    lastCursorRef.current = {
      lastTimestamp: maxIso(lastCursorRef.current.lastTimestamp, newest.timestamp),
      lastUpdatedAt: newest.updatedAt ? maxIso(lastCursorRef.current.lastUpdatedAt, newest.updatedAt) : lastCursorRef.current.lastUpdatedAt
    };
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
    } else if (inboundCount > 0) {
      setHasNewMessages(true);
      setUnreadByContact((prev) => ({ ...prev, [phone]: (prev[phone] ?? 0) + inboundCount }));
    }
  }, [mergeMessages, scrollToBottom]);

  const startMessageStream = useCallback(async (phone: string, signal: AbortSignal) => {
    const stored = getStoredAuth();
    const token = stored?.token ?? '';
    if (!token) throw new Error('no_token');

    const cursor = lastCursorRef.current;
    const url = buildApiUrl('/integrations/evolution/messages/stream', {
      phone: `+${phone}`,
      afterTimestamp: cursor.lastTimestamp,
      afterUpdatedAt: cursor.lastUpdatedAt,
      limit: '200'
    });

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (stored?.user?.apiKey) headers['x-tenant-key'] = stored.user.apiKey;

    const resp = await fetch(url, { headers, signal });
    if (!resp.ok || !resp.body) {
      throw new Error(`stream_http_${resp.status}`);
    }
    setStreamConnected(true);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType: string | null = null;
    let dataLines: string[] = [];

    const flush = () => {
      if (!dataLines.length) return;
      const raw = dataLines.join('\n');
      dataLines = [];
      const type = eventType ?? 'message';
      eventType = null;
      if (type === 'keepalive') return;
      try {
        const parsed = JSON.parse(raw) as any;
        applyIncomingMessages(phone, [parsed]);
      } catch {
        return;
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const rawLine of parts) {
        const line = rawLine.replace(/\r$/, '');
        if (line.length === 0) {
          flush();
          continue;
        }
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim() || null;
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
          continue;
        }
      }
    }
    setStreamConnected(false);
  }, [applyIncomingMessages, buildApiUrl]);
 
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
    setMessages((curr) => {
      const phone = contact.replace(/\D+/g, '');
      const isClient = (m: Message) => String(m.wamid ?? m.id ?? '').startsWith('client-');
      const matchesDirection = (m: Message) => {
        if (directionFilter === 'all') return true;
        const isOut = m.direction === 'OUTBOUND' || !!m.fromMe;
        return directionFilter === 'outbound' ? isOut : !isOut;
      };
      const optimistic = curr.filter((m) => isClient(m) && (m.phoneRaw ?? '') === phone && matchesDirection(m));
      return mergeMessages(data as Message[], optimistic);
    });
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
    const lastUpdatedAt = (() => {
      let maxIso = lastTs ? new Date(lastTs).toISOString() : new Date(0).toISOString();
      for (const m of data as any[]) {
        const u = m?.updatedAt ?? null;
        if (!u) continue;
        const a = new Date(maxIso).getTime();
        const b = new Date(u).getTime();
        if (!Number.isNaN(b) && b >= a) maxIso = new Date(u).toISOString();
      }
      return maxIso;
    })();
    lastCursorRef.current = {
      lastTimestamp: lastTs ? new Date(lastTs).toISOString() : new Date(0).toISOString(),
      lastUpdatedAt
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
  }, [directionFilter, getConversation, mergeMessages, preferLocal, scrollToBottom]);

  const openContact = useCallback(
    async (contact: string) => {
      const n = (contact ?? '').replace(/\D+/g, '');
      if (!n) return;
      if (n.length < 7 || n.length > 15) {
        setError('Esse contato não é um número suportado (somente telefones E.164).');
        return;
      }
      setSelectedContact(n);
      setMessages([]);
      setConversationLimit(50);
      setHasNewMessages(false);
      lastMessageIdRef.current = null;
      lastCursorRef.current = { lastTimestamp: new Date(0).toISOString(), lastUpdatedAt: new Date(0).toISOString() };
      setUnreadByContact((prev) => {
        if (!prev[n]) return prev;
        const copy = { ...prev };
        delete copy[n];
        return copy;
      });
      await applyConversation(n, 50, { allowRetryLocal: true });
    },
    [applyConversation]
  );

  useEffect(() => {
    conversationLimitRef.current = conversationLimit;
  }, [conversationLimit]);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  useEffect(() => {
    const c = selectedContactRef.current;
    if (!c) return;
    void applyConversation(c, conversationLimitRef.current, { allowRetryLocal: true });
  }, [applyConversation, directionFilter, instanceId]);
 
   useEffect(() => {
     const phoneParam = searchParams.get('phone');
     const directionParam = searchParams.get('direction');
     if (directionParam === 'inbound' || directionParam === 'outbound') {
       setDirectionFilter(directionParam as any);
     }
    if (phoneParam && typeof phoneParam === 'string') {
      const n = phoneParam.replace(/\D+/g, '');
      if (n && n.length >= 7) {
        void openContact(n);
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
    if (realtimeMode !== 'stream') return;
    const phone = selectedContact.replace(/\D+/g, '');
    if (!phone) return;
    const ac = new AbortController();
    setStreamConnected(false);
    void startMessageStream(phone, ac.signal).catch(() => {
      setStreamConnected(false);
      setRealtimeMode('poll');
    });
    return () => {
      ac.abort();
    };
  }, [realtimeMode, selectedContact, startMessageStream]);

  useEffect(() => {
    if (!selectedContact) return;
    if (realtimeMode === 'stream' && streamConnected) return;
    const phone = selectedContact.replace(/\D+/g, '');
    if (!phone) return;
    const intervalMs = realtimeMode === 'poll' ? 2000 : 10000;
    const id = window.setInterval(() => {
      const cursor = lastCursorRef.current;
      void (async () => {
        try {
          const params: Record<string, any> = {
            phone,
            limit: 200,
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

          const lastId = incoming.length ? (incoming[incoming.length - 1]?.id ?? null) : null;
          if (lastId) lastMessageIdRef.current = lastId;

          const c = resp.data.cursor;
          if (c?.lastTimestamp || c?.lastUpdatedAt) {
            lastCursorRef.current = {
              lastTimestamp: c?.lastTimestamp ? new Date(c.lastTimestamp).toISOString() : cursor.lastTimestamp,
              lastUpdatedAt: c?.lastUpdatedAt ? new Date(c.lastUpdatedAt).toISOString() : cursor.lastUpdatedAt
            };
          }

          applyIncomingMessages(phone, incoming);
        } catch {
          setHasNewMessages(false);
        }
      })();
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [applyIncomingMessages, realtimeMode, selectedContact, streamConnected]);

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
    const items: RenderedMessageItem[] = [];
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

  const canSend = !!selectedContact && normalizedPhone.length >= 7 && (text.trim().length > 0 || mediaUrl.trim().length > 0);
 
  return (
    <div className="flex h-[calc(100vh-100px)] gap-4">
      <ChatList
        instances={instances}
        instanceId={instanceId}
        onInstanceChange={setInstanceId}
        chatSearch={chatSearch}
        onChatSearchChange={setChatSearch}
        directionFilter={directionFilter}
        onDirectionFilterChange={setDirectionFilter}
        isLoadingChats={isLoadingChats}
        filteredChats={filteredChats}
        selectedContact={selectedContact}
        unreadByContact={unreadByContact}
        formatPhone={formatPhone}
        formatChatTime={formatChatTime}
        onSelectChat={openContact}
        phoneInput={phoneInput}
        onPhoneInputChange={setPhoneInput}
        onOpenNumber={() => openContact(phoneInput)}
      />

      <section className="flex-1 rounded-lg border bg-[#0b141a]">
        <ChatHeader
          selectedContact={selectedContact}
          normalizedPhone={normalizedPhone}
          formatPhone={formatPhone}
          realtimeMode={realtimeMode}
          streamConnected={streamConnected}
          onRefresh={() => {
            if (!selectedContact) return;
            scrollToBottomNextRef.current = true;
            void applyConversation(selectedContact, conversationLimitRef.current, { allowRetryLocal: true });
          }}
          onForcePolling={() => {
            setRealtimeMode('poll');
            setStreamConnected(false);
          }}
          onRetryStream={() => {
            setRealtimeMode('stream');
          }}
        />
        <div className="flex h-full flex-col">
          <MessagesList
            selectedContact={selectedContact}
            isLoadingMessages={isLoadingMessages}
            renderedMessages={selectedContact ? renderedMessages : []}
            onScroll={handleMessagesScroll}
            messagesContainerRef={messagesContainerRef}
            statusGlyph={statusGlyph}
            statusColor={statusColor}
          />
          <Composer
            selectedContact={selectedContact}
            displayPhone={formatPhone(selectedContact)}
            text={text}
            onTextChange={setText}
            canSend={canSend}
            onSend={sendMessage}
            hasNewMessages={hasNewMessages}
            onJumpToLatest={() => {
              if (!selectedContact) return;
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
            }}
          />
          {error && (
            <div className="-mt-2 px-3 pb-3 text-sm text-red-400">
              {error}
              <button
                onClick={() => {
                  setPreferLocal(true);
                  setError(null);
                }}
                className="ml-2 rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
              >
                Ler fonte local
              </button>
            </div>
          )}
        </div>
      </section>
     </div>
   );
 }
