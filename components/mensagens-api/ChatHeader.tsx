export function ChatHeader(props: {
  selectedContact: string | null;
  selectedName?: string | null;
  avatarUrl?: string | null;
  originLabel?: string | null;
  normalizedPhone: string;
  formatPhone: (raw?: string | null) => string;
  realtimeMode: 'stream' | 'poll';
  streamConnected: boolean;
  onRefresh: () => void;
  onForcePolling: () => void;
  onRetryStream: () => void;
  abOptions?: Array<{ id: string; label: string }>;
  abSelectedPromptId?: string | null;
  abAssignedBy?: string | null;
  abLoading?: boolean;
  onSelectAbPrompt?: (promptId: string | null) => void;
}) {
  const phoneDisplay = props.selectedContact ? props.formatPhone(props.selectedContact) : null;
  const title = props.selectedContact ? (props.selectedName || phoneDisplay || `+${props.normalizedPhone}`) : 'Selecione uma conversa';
  const originDisplay = props.selectedContact ? (props.originLabel ? props.formatPhone(props.originLabel) : 'unknown') : null;
  const subtitle = props.selectedContact ? `Origem: ${originDisplay} • Destino: ${phoneDisplay ?? `+${props.normalizedPhone}`}` : '—';
  const avatarLetter = (props.selectedName || phoneDisplay || 'C').trim()[0] ?? 'C';
  const badge = props.realtimeMode === 'stream' ? (props.streamConnected ? 'Tempo real' : 'Conectando') : 'Polling';
  const showAb = !!props.selectedContact && Array.isArray(props.abOptions) && props.abOptions.length > 0 && typeof props.onSelectAbPrompt === 'function';
  const abLabel = props.abAssignedBy === 'manual' ? 'Manual' : props.abAssignedBy === 'auto' ? 'A/B' : props.abAssignedBy === 'legacy' ? 'Legado' : null;

  return (
    <div className="border-b border-[#202c33] px-4 py-3 text-[#e9edef]">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 text-white">
          {props.avatarUrl ? <img src={props.avatarUrl} alt="" className="h-full w-full object-cover" /> : avatarLetter}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <p className="truncate text-xs text-[#8696a0]">{subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {showAb && (
            <div className="flex items-center gap-2">
              {abLabel && (
                <span className="rounded-full border border-[#202c33] bg-[#0b141a] px-2 py-1 text-[11px] text-[#e9edef]">
                  {abLabel}
                </span>
              )}
              <select
                value={props.abSelectedPromptId ?? ''}
                onChange={(e) => props.onSelectAbPrompt?.(e.target.value ? e.target.value : null)}
                disabled={!!props.abLoading}
                className="rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
              >
                <option value="">Padrão (A/B)</option>
                {props.abOptions?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <span className="rounded-full border border-[#202c33] bg-[#0b141a] px-2 py-1 text-[11px] text-[#e9edef]">
            {badge}
          </span>
          <button
            onClick={props.onRefresh}
            className="rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
          >
            Atualizar
          </button>
          {props.realtimeMode === 'stream' ? (
            <button
              onClick={props.onForcePolling}
              className="rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
            >
              Polling
            </button>
          ) : (
            <button
              onClick={props.onRetryStream}
              className="rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
            >
              Stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
