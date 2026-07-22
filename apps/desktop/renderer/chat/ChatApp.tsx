import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = Awaited<ReturnType<typeof window.openclawPet.getChatHistory>>[number];
type DisplayMessage = ChatMessage & { pending?: boolean };

interface PendingMessage {
  message: DisplayMessage;
  matchingMessagesAtSend: number;
}

function matchingUserMessages(messages: ChatMessage[], content: string): number {
  return messages.filter((item) => item.role === "user" && item.content === content).length;
}

export function ChatApp() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [notice, setNotice] = useState("Connecting to Lyn…");
  const serverMessages = useRef<ChatMessage[]>([]);
  const pendingMessages = useRef<PendingMessage[]>([]);
  const historyRequest = useRef(0);
  const refreshTimer = useRef<number | undefined>(undefined);
  const messageList = useRef<HTMLElement>(null);
  const stickToBottom = useRef(true);

  const showMessages = useCallback((history: ChatMessage[]) => {
    setMessages([
      ...history,
      ...pendingMessages.current.map((pending) => pending.message),
    ]);
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
        setNotice(error instanceof Error ? error.message : "Chat history unavailable.");
      }
    }
  }, [showMessages]);

  useEffect(() => {
    let active = true;
    void window.openclawPet.getGatewayStatus().then((status) => {
      if (active) setNotice(status.connected ? "Connected to Lyn." : (status.detail ?? "Gateway not connected."));
    }).catch(() => {
      if (active) setNotice("Gateway status unavailable.");
    });
    void loadHistory();
    const unsubscribe = window.openclawPet.onChatUpdated(() => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void loadHistory(), 150);
    });
    return () => {
      active = false;
      window.clearTimeout(refreshTimer.current);
      unsubscribe();
    };
  }, [loadHistory]);

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

    // An older history response must not reconcile a message sent after that request began.
    historyRequest.current += 1;
    const optimisticMessage: DisplayMessage = {
      id: `local-${crypto.randomUUID()}`,
      role: "user",
      content,
      timestamp: Date.now(),
      pending: true,
    };
    pendingMessages.current.push({
      message: optimisticMessage,
      matchingMessagesAtSend: matchingUserMessages(serverMessages.current, content),
    });
    stickToBottom.current = true;
    setMessage("");
    showMessages(serverMessages.current);
    setSending(true);

    try {
      const result = await window.openclawPet.sendChat(content);
      if (!result.accepted) throw new Error(result.reason ?? "The gateway did not accept the message.");
      setNotice(result.reason ?? "Message sent to Lyn.");
      void loadHistory();
    } catch (error: unknown) {
      pendingMessages.current = pendingMessages.current.filter(({ message: item }) => item.id !== optimisticMessage.id);
      showMessages(serverMessages.current);
      setMessage((current) => current || content);
      setNotice(error instanceof Error ? error.message : "The message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="panel chat-panel">
      <header>
        <strong>PawClaw</strong>
        <span>Desktop chat</span>
      </header>
      <section
        aria-live="polite"
        className="chat-messages"
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
        }}
        ref={messageList}
      >
        {messages.length === 0 ? <p className="chat-empty">No messages yet.</p> : messages.map((item) => (
          <article className={`chat-message chat-message--${item.role}${item.pending ? " chat-message--pending" : ""}`} key={item.id}>
            <span>{item.pending ? "Sending…" : item.role === "user" ? "You" : "Lyn"}</span>
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
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Write a message"
        />
        <button disabled={sending || !message.trim()} type="submit">
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
      <small>{notice}</small>
    </main>
  );
}
