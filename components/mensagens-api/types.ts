export type Message = {
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

export type ChatItem = {
  id: string;
  name: string | null;
  contact: string;
  lastMessage?: { text: string; timestamp: string; fromMe: boolean } | null;
};

export type RenderedMessageItem =
  | { type: 'date'; id: string; label: string }
  | { type: 'msg'; id: string; msg: Message };

