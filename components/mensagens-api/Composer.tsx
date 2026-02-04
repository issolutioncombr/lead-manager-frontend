import { useEffect, useRef } from 'react';

export function Composer(props: {
  selectedContact: string | null;
  displayPhone: string;
  text: string;
  onTextChange: (value: string) => void;
  canSend: boolean;
  onSend: () => void;
  hasNewMessages: boolean;
  onJumpToLatest: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.selectedContact) {
      inputRef.current?.focus();
    }
  }, [props.selectedContact]);

  return (
    <div className="border-t border-[#202c33] p-3 text-[#e9edef]">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-[#8696a0]">{props.selectedContact ? props.displayPhone : '—'}</span>
        <div className="ml-auto flex items-center gap-2">
          {props.hasNewMessages && (
            <button
              onClick={props.onJumpToLatest}
              className="rounded-md border border-[#202c33] bg-[#0b141a] px-2 py-1 text-xs text-[#e9edef]"
            >
              Novas mensagens
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={props.text}
          onChange={(e) => props.onTextChange(e.target.value)}
          placeholder={props.selectedContact ? 'Digite uma mensagem' : 'Selecione uma conversa'}
          disabled={!props.selectedContact}
          className="flex-1 rounded-2xl border border-[#202c33] bg-[#202c33] px-4 py-2 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none disabled:opacity-50"
          aria-label="Mensagem"
        />
        <button
          onClick={props.onSend}
          disabled={!props.canSend}
          className="rounded-full bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Enviar"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
