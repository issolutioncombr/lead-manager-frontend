import { ChatItem } from './types';

export function ChatList(props: {
  instances: Array<{ id: string; name?: string | null }>;
  instanceId: string;
  onInstanceChange: (id: string) => void;
  chatSearch: string;
  onChatSearchChange: (value: string) => void;
  directionFilter: 'all' | 'inbound' | 'outbound';
  onDirectionFilterChange: (value: 'all' | 'inbound' | 'outbound') => void;
  isLoadingChats: boolean;
  filteredChats: ChatItem[];
  selectedContact: string | null;
  unreadByContact: Record<string, number>;
  formatPhone: (raw?: string | null) => string;
  formatChatTime: (iso?: string | null) => string;
  onSelectChat: (contact: string, remoteJid?: string | null) => void;
  phoneInput: string;
  onPhoneInputChange: (value: string) => void;
  onOpenNumber: () => void;
}) {
  return (
    <aside className="w-80 shrink-0 rounded-lg border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Conversas (Evolution)</h2>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={props.instanceId}
            onChange={(e) => props.onInstanceChange(e.target.value)}
            className="rounded-md border px-2 py-1 text-xs"
            aria-label="Instância"
          >
            <option value="">Todas instâncias</option>
            {props.instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name ?? i.id}
              </option>
            ))}
          </select>
          <input
            value={props.chatSearch}
            onChange={(e) => props.onChatSearchChange(e.target.value)}
            placeholder="Buscar por número ou nome"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">Direção:</span>
          <select
            value={props.directionFilter}
            onChange={(e) => props.onDirectionFilterChange(e.target.value as any)}
            className="rounded-md border px-2 py-1 text-xs"
          >
            <option value="all">Todas</option>
            <option value="inbound">Recebidas</option>
            <option value="outbound">Enviadas</option>
          </select>
        </div>
      </div>
      <div className="h-full overflow-y-auto">
        {props.isLoadingChats ? (
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
            {props.filteredChats.map((chat) => (
              <li key={`${chat.id}-${chat.contact}`}>
                <button
                  onClick={() => props.onSelectChat(chat.contact, chat.remoteJid ?? null)}
                  className={[
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                    props.selectedContact === chat.contact ? 'bg-gray-50' : 'hover:bg-gray-50'
                  ].join(' ')}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {(chat.name ?? chat.contact ?? 'C')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {chat.name ?? (props.formatPhone(chat.contact) || 'Sem nome')}
                      </p>
                      <span className="ml-auto text-[11px] text-gray-400">
                        {props.formatChatTime(chat.lastMessage?.timestamp ?? null)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs text-gray-500">{props.formatPhone(chat.contact)}</p>
                      {!!props.unreadByContact[chat.contact] && (
                        <span className="ml-auto rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {props.unreadByContact[chat.contact]}
                        </span>
                      )}
                    </div>
                    {chat.lastMessage && (
                      <p className="truncate text-xs text-gray-400">
                        <span>{chat.lastMessage.fromMe ? '↗' : '↙'}</span> {chat.lastMessage.text} •{' '}
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
                value={props.phoneInput}
                onChange={(e) => props.onPhoneInputChange(e.target.value)}
                placeholder="Ex.: 5511999999999"
                inputMode="numeric"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <button onClick={props.onOpenNumber} className="rounded-md border px-3 py-2 text-sm">
                Abrir
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
