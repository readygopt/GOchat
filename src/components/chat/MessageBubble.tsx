import { formatTime } from "@/lib/format";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  pending?: boolean;
}

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col enter ${isUser ? "items-end" : "items-start"}`}>
      <div className={`bubble ${isUser ? "bubble-user" : "bubble-agent"}`}>
        {message.content}
      </div>
      <span
        className="mt-1 px-1 text-[11px]"
        style={{ color: "var(--ink-faint)" }}
      >
        {isUser ? "Você" : "Consultor"} {message.created_at ? `às ${formatTime(message.created_at)}` : ""}
      </span>
    </div>
  );
}
