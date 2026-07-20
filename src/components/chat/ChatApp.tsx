"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Composer from "./Composer";
import MessageBubble, { type ChatMessage } from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ThemeToggle from "./ThemeToggle";

const STORAGE_KEY = "tl-session";

interface FailedSend {
  text: string;
  clientMessageId: string;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface BootResult {
  sessionId: string | null;
  messages: ChatMessage[];
}

// The bootstrap promise is stored on window so it is a single instance for the whole page.
// A remount (React StrictMode in development, a fast navigation, or a duplicated client module)
// then shares one bootstrap instead of creating a second session.
interface BootWindow {
  __tlBoot?: Promise<BootResult>;
}

function bootstrapSession(): Promise<BootResult> {
  const w = window as unknown as BootWindow;
  if (w.__tlBoot) return w.__tlBoot;
  w.__tlBoot = (async () => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        const res = await fetch(`/api/session?id=${encodeURIComponent(existing)}`);
        if (res.ok) {
          const data = await res.json();
          return { sessionId: data.sessionId as string, messages: (data.messages ?? []) as ChatMessage[] };
        }
      }
      const res = await fetch("/api/session", { method: "POST" });
      if (!res.ok) return { sessionId: null, messages: [] };
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, data.sessionId);
      return { sessionId: data.sessionId as string, messages: [] };
    } catch {
      return { sessionId: null, messages: [] };
    }
  })();
  return w.__tlBoot;
}

export default function ChatApp() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const failedRef = useRef<FailedSend | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    bootstrapSession().then((result) => {
      if (!active) return;
      setSessionId(result.sessionId);
      setMessages(result.messages);
      setBooting(false);
      if (!result.sessionId) {
        setError("Não foi possível iniciar uma conversa. Atualize a página, por favor.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  const deliver = useCallback(
    async (text: string, clientMessageId: string, alreadyShown: boolean) => {
      if (!sessionId) return;
      setError(null);
      failedRef.current = null;

      if (!alreadyShown) {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${clientMessageId}`,
            role: "user",
            content: text,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      setTyping(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, clientMessageId, text }),
        });
        const data = await res.json();
        setTyping(false);

        if (!res.ok) {
          failedRef.current = { text, clientMessageId };
          setError(data.error ?? "Algo correu mal. Tente novamente, por favor.");
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${clientMessageId}`,
            role: "assistant",
            content: data.reply,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch {
        setTyping(false);
        failedRef.current = { text, clientMessageId };
        setError("A ligação caiu. A sua mensagem foi guardada. Pode tentar novamente.");
      }
    },
    [sessionId],
  );

  function send(text: string) {
    void deliver(text, uuid(), false);
  }

  function retry() {
    const failed = failedRef.current;
    if (!failed) return;
    void deliver(failed.text, failed.clientMessageId, true);
  }

  async function startOver() {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setError(null);
    failedRef.current = null;
    setBooting(true);
    try {
      const res = await fetch("/api/session", { method: "POST" });
      const data = await res.json();
      const id = res.ok ? (data.sessionId as string) : null;
      if (id) localStorage.setItem(STORAGE_KEY, id);
      // Keep the shared bootstrap in sync so a later remount reuses this session.
      (window as unknown as BootWindow).__tlBoot = Promise.resolve({ sessionId: id, messages: [] });
      setSessionId(id);
      if (!id) setError("Não foi possível iniciar uma conversa. Atualize a página, por favor.");
    } catch {
      setError("Não foi possível iniciar uma conversa. Atualize a página, por favor.");
    } finally {
      setBooting(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col">
      <header
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/go-chat-lockup.png" alt="GO Chat" className="h-8 w-auto object-contain" />
          <span className="mt-0.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>
            Encontre a coisa certa para construir
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!empty && (
            <button
              onClick={startOver}
              className="rounded-full px-3 py-1.5 text-[13px] transition hover:bg-[var(--surface-muted)]"
              style={{ color: "var(--ink-soft)" }}
            >
              Nova conversa
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="scroll-area flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        {booting ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-1.5">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        ) : empty ? (
          <div className="flex h-full flex-col items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/go-symbol.png"
              alt="GO"
              className="h-24 w-auto object-contain sm:h-28"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {typing && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <div className="px-4 pb-4 sm:px-5">
        {error && (
          <div
            className="mb-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13px]"
            style={{ background: "var(--accent-soft)", color: "var(--danger)" }}
          >
            <span>{error}</span>
            {failedRef.current && (
              <button
                onClick={retry}
                className="shrink-0 rounded-full px-3 py-1 font-medium"
                style={{ background: "var(--surface)", color: "var(--ink)" }}
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}
        <Composer onSend={send} disabled={booting || typing || !sessionId} />
      </div>
    </div>
  );
}
