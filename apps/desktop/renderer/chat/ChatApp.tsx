import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatUpdate } from '../shared/desktop-api';

type ChatMessage = Awaited<ReturnType<typeof window.openclawPet.getChatHistory>>[number];
type DisplayMessage = ChatMessage & {
  kind?: 'commentary' | 'stream';
  pending?: boolean;
};

interface PendingMessage {
  message: DisplayMessage;
  matchingMessagesAtSend: number;
}

interface DisplayRun {
  runId: string;
  startedAt: number;
  commentary: Map<string, DisplayMessage>;
  answer?: DisplayMessage;
  complete: boolean;
  finalContent?: string;
}

interface ChatAppProps {
  assistantName: string;
}

function matchingUserMessages(messages: ChatMessage[], content: string): number {
  return messages.filter((item) => item.role === 'user' && item.content === content).length;
}

function messageTimestamp(message: ChatMessage): number {
  return typeof message.timestamp === 'number' ? message.timestamp : 0;
}

export function ChatApp({ assistantName }: ChatAppProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [notice, setNotice] = useState(`Conectando con ${assistantName}…`);
  const serverMessages = useRef<ChatMessage[]>([]);
  const pendingMessages = useRef<PendingMessage[]>([]);
  const displayRuns = useRef(new Map<string, DisplayRun>());
  const historyRequest = useRef(0);
  const refreshTimer = useRef<number | undefined>(undefined);
  const messageList = useRef<HTMLElement>(null);
  const stickToBottom = useRef(true);

  const getRun = useCallback((runId: string, timestamp: number): DisplayRun => {
    const current = displayRuns.current.get(runId);
    if (current) return current;
    const created: DisplayRun = {
      runId,
      startedAt: timestamp,
      commentary: new Map(),
      complete: false
    };
    displayRuns.current.set(runId, created);
    return created;
  }, []);

  const showMessages = useCallback((history: ChatMessage[]) => {
    const result: DisplayMessage[] = [];
    const insertedRuns = new Set<string>();
    const completedRuns = [...displayRuns.current.values()]
      .filter((run) => run.complete && run.finalContent)
      .sort((left, right) => left.startedAt - right.startedAt);

    for (const item of history) {
      if (item.role === 'assistant') {
        const matchingRun = completedRuns.find((run) => {
          if (insertedRuns.has(run.runId) || run.finalContent !== item.content) return false;
          const timestamp = messageTimestamp(item);
          return timestamp === 0 || timestamp >= run.startedAt - 60_000;
        });
        if (matchingRun) {
          result.push(...matchingRun.commentary.values());
          insertedRuns.add(matchingRun.runId);
        }
      }
      result.push(item);
    }

    const extras: DisplayMessage[] = pendingMessages.current.map((pending) => pending.message);
    for (const run of displayRuns.current.values()) {
      if (insertedRuns.has(run.runId)) continue;
      extras.push(...run.commentary.values());
      if (run.answer) extras.push(run.answer);
    }
    extras.sort((left, right) => messageTimestamp(left) - messageTimestamp(right));
    setMessages([...result, ...extras]);
  }, []);

  const loadHistory = useCallback(async () => {
    const request = ++historyRequest.current;
    try {
      const history = await window.openclawPet.getChatHistory();
      if (request !== historyRequest.current) return;

      pendingMessages.current = pendingMessages.current.filter((pending) => (
        matchingUserMessages(history, pending.message.content) <= pending.matchingMessagesAtSend
      ));
      serverMessages.current = history;
      showMessages(history);
    } catch (error: unknown) {
      if (request === historyRequest.current) {
        setNotice(error instanceof Error ? error.message : 'El historial no está disponible.');
      }
    }
  }, [showMessages]);

  const applyChatUpdate = useCallback((update: ChatUpdate) => {
    if (update.type === 'history') {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void loadHistory(), 40);
      return;
    }

    const run = getRun(update.runId, update.timestamp);
    if (update.type === 'commentary') {
      const key = update.itemId ?? `commentary-${run.commentary.size}`;
      if (!update.content.trim()) {
        run.commentary.delete(key);
      } else {
        run.commentary.set(key, {
          id: `commentary-${update.runId}-${key}`,
          role: 'assistant',
          content: update.content,
          timestamp: update.timestamp,
          kind: 'commentary',
          pending: !run.complete
        });
      }
    } else if (update.type === 'delta') {
      run.answer = {
        id: `stream-${update.runId}`,
        role: 'assistant',
        content: update.content,
        timestamp: update.timestamp,
        kind: 'stream',
        pending: true
      };
    } else {
      run.complete = true;
      for (const commentary of run.commentary.values()) commentary.pending = false;
      const fallbackContent = update.type === 'final'
        ? run.answer?.content
        : update.reason ?? run.answer?.content;
      const finalMessage = update.message ?? (fallbackContent ? {
        id: `final-${update.runId}`,
        role: 'assistant' as const,
        content: fallbackContent,
        timestamp: update.timestamp
      } : undefined);
      if (finalMessage) {
        run.finalContent = finalMessage.content;
        run.answer = { ...finalMessage, pending: false };
      } else {
        run.answer = undefined;
      }
      setNotice(update.type === 'final'
        ? `Respuesta recibida de ${assistantName}.`
        : update.reason ?? `La respuesta de ${assistantName} se interrumpió.`);
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void loadHistory(), 40);
    }

    stickToBottom.current = true;
    showMessages(serverMessages.current);
  }, [assistantName, getRun, loadHistory, showMessages]);

  useEffect(() => {
    let active = true;
    void window.openclawPet.getGatewayStatus().then((status) => {
      if (active) {
        setNotice(status.connected
          ? `Conectado con ${assistantName}.`
          : (status.detail ?? 'Gateway sin conexión.'));
      }
    }).catch(() => {
      if (active) setNotice('No se pudo consultar el Gateway.');
    });
    void loadHistory();
    const unsubscribe = window.openclawPet.onChatUpdated(applyChatUpdate);
    return () => {
      active = false;
      window.clearTimeout(refreshTimer.current);
      unsubscribe();
    };
  }, [applyChatUpdate, assistantName, loadHistory]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const frame = window.requestAnimationFrame(() => {
      const element = messageList.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  async function send() {
    const content = message.trim();
    if (!content || sending) return;

    historyRequest.current += 1;
    const optimisticMessage: DisplayMessage = {
      id: `local-${crypto.randomUUID()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      pending: true
    };
    pendingMessages.current.push({
      message: optimisticMessage,
      matchingMessagesAtSend: matchingUserMessages(serverMessages.current, content)
    });
    stickToBottom.current = true;
    setMessage('');
    showMessages(serverMessages.current);
    setSending(true);

    try {
      const result = await window.openclawPet.sendChat(content);
      if (!result.accepted) throw new Error(result.reason ?? 'El Gateway no aceptó el mensaje.');
      setNotice(`Mensaje enviado a ${assistantName}.`);
      void loadHistory();
    } catch (error: unknown) {
      pendingMessages.current = pendingMessages.current.filter(
        ({ message: item }) => item.id !== optimisticMessage.id
      );
      showMessages(serverMessages.current);
      setMessage((current) => current || content);
      setNotice(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-panel">
      <section
        aria-live="polite"
        className="chat-messages"
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
        }}
        ref={messageList}
      >
        {messages.length === 0 ? <p className="chat-empty">Todavía no hay mensajes.</p> : messages.map((item) => (
          <article
            className={[
              'chat-message',
              `chat-message--${item.role}`,
              item.pending ? 'chat-message--pending' : '',
              item.kind ? `chat-message--${item.kind}` : ''
            ].filter(Boolean).join(' ')}
            key={item.id}
          >
            <span>
              {item.role === 'user'
                ? (item.pending ? 'Enviando…' : 'Tú')
                : item.kind === 'commentary'
                  ? `${assistantName} · progreso`
                  : item.pending
                    ? `${assistantName} está escribiendo…`
                    : assistantName}
            </span>
            <p>{item.content}</p>
          </article>
        ))}
      </section>
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          aria-label={`Mensaje para ${assistantName}`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={`Escribe a ${assistantName}`}
        />
        <button disabled={sending || !message.trim()} type="submit">
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
      <small>{notice}</small>
    </section>
  );
}
