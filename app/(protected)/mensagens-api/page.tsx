'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../lib/api';

type Message = {
  id: string;
  wamid: string;
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

export default function MensagensApiPage() {
  const [phone, setPhone] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const normalizedPhone = useMemo(() => phone.replace(/\D+/g, ''), [phone]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const fetchConversation = async () => {
    if (!normalizedPhone || normalizedPhone.length < 7) return;
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, any> = { phone: normalizedPhone };
      if (directionFilter !== 'all') params.direction = directionFilter;
      const resp = await api.get<{ data: Message[]; total: number; page: number; limit: number }>(
        '/integrations/evolution/messages/conversation',
        { params }
      );
      setMessages(resp.data.data);
    } catch (e) {
      setError('Não foi possível carregar a conversa.');
    } finally {
      setIsLoading(false);
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
        caption: caption || undefined
      });
      setText('');
      setCaption('');
      setMediaUrl('');
      await fetchConversation();
    } catch (e) {
      setError('Falha ao enviar mensagem.');
    }
  };

  const formatPhone = (raw?: string | null) => {
    if (!raw) return '';
    const d = raw.replace(/\D+/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return raw;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Mensagens API</h2>
        <p className="text-sm text-gray-500">Enviar e visualizar mensagens por número</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex.: +5511999998888"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={fetchConversation} className="rounded-md border px-3 py-2 text-sm">
              Carregar conversa
            </button>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
              className="rounded-md border px-2 py-2 text-sm"
            >
              <option value="all">Todas</option>
              <option value="inbound">Recebidas</option>
              <option value="outbound">Enviadas</option>
            </select>
          </div>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      <div className="flex gap-4">
        <section className="flex-1 rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <div className="text-sm text-gray-500">{formatPhone(normalizedPhone)}</div>
          </div>
          <div ref={messagesContainerRef} className="h-[60vh] space-y-2 overflow-y-auto p-4">
            {isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-start">
                    <div className="h-14 w-64 animate-pulse rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            )}
            {!isLoading && messages.length === 0 && (
              <div className="text-sm text-gray-500">Nenhuma mensagem.</div>
            )}
            {!isLoading &&
              messages.map((msg) => {
                const isMine = !!msg.fromMe;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mt-2`}>
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        isMine ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[11px] opacity-80">
                        <span>{isMine ? '↗' : '↙'}</span>
                        {!isMine && msg.pushName && <span>{msg.pushName}</span>}
                      </div>
                      {msg.mediaUrl && (
                        <div className="mt-1">
                          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="underline">
                            Anexo
                          </a>
                          {msg.caption && <div className="mt-1 whitespace-pre-wrap">{msg.caption}</div>}
                        </div>
                      )}
                      {!msg.mediaUrl && (
                        <p className="mt-1 whitespace-pre-wrap">{msg.conversation ?? `[${msg.messageType ?? 'mensagem'}]`}</p>
                      )}
                      <div className={`mt-1 text-[11px] ${isMine ? 'text-white/90' : 'text-gray-500'}`}>
                        {new Date(msg.timestamp).toLocaleString()}
                      </div>
                      {typeof msg.deliveryStatus === 'string' && (
                        <div className={`mt-1 text-[11px] ${isMine ? 'text-white/90' : 'text-gray-500'}`}>
                          {msg.deliveryStatus}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
            />
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="URL de mídia (opcional)"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Legenda (opcional)"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <button onClick={sendMessage} className="w-full rounded-md border px-3 py-2 text-sm">
              Enviar
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
