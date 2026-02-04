import { RenderedMessageItem } from './types';

export function MessagesList(props: {
  selectedContact: string | null;
  isLoadingMessages: boolean;
  renderedMessages: RenderedMessageItem[];
  onScroll: () => void;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  statusGlyph: (s?: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null) => string;
  statusColor: (s?: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null) => string;
}) {
  const safeHref = (url: string) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') return url;
      return null;
    } catch {
      return null;
    }
  };

  return (
    <div ref={props.messagesContainerRef} onScroll={props.onScroll} className="flex-1 overflow-y-auto p-6">
      {!props.selectedContact && <div className="text-sm text-gray-500">Selecione uma conversa para visualizar.</div>}
      {props.selectedContact && props.isLoadingMessages && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex justify-start">
              <div className="h-14 w-64 animate-pulse rounded-2xl bg-[#202c33]" />
            </div>
          ))}
        </div>
      )}
      {props.selectedContact &&
        !props.isLoadingMessages &&
        props.renderedMessages.map((it) => {
          if (it.type === 'date') {
            return (
              <div key={it.id} className="my-3 flex justify-center">
                <span className="rounded-full bg-[#202c33] px-3 py-1 text-[11px] text-[#e9edef]">{it.label}</span>
              </div>
            );
          }
          const msg = it.msg;
          const isMine = msg.direction === 'OUTBOUND' || !!msg.fromMe;
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
                    {safeHref(msg.mediaUrl) ? (
                      <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="underline">
                        Anexo
                      </a>
                    ) : (
                      <span>Anexo</span>
                    )}
                    {msg.caption && <div className="mt-1 whitespace-pre-wrap">{msg.caption}</div>}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.conversation ?? `[${msg.messageType ?? 'mensagem'}]`}</p>
                )}
                <div className="mt-1 flex items-center justify-end gap-2 text-[11px]">
                  <span className={isMine ? 'text-white/70' : 'text-[#8696a0]'}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMine && <span className={props.statusColor(msg.deliveryStatus ?? null)}>{props.statusGlyph(msg.deliveryStatus ?? null)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      {props.selectedContact && !props.isLoadingMessages && props.renderedMessages.length === 0 && (
        <div className="text-sm text-[#8696a0]">Nenhuma mensagem.</div>
      )}
    </div>
  );
}
