import { useState } from "react";

export function ChatApp() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(
    "Connect the gateway to start chatting.",
  );
  async function send() {
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const result = await window.openclawPet.sendChat(content);
      setNotice(result.reason ?? "Message sent");
      if (result.accepted) setMessage("");
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "The message could not be sent.");
    } finally {
      setSending(false);
    }
  }
  return (
    <main className="panel">
      <header>
        <strong>Lyn</strong>
        <span>Desktop chat</span>
      </header>
      <section className="chat-empty">
        The gateway adapter is not connected yet.
      </section>
      <form
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
