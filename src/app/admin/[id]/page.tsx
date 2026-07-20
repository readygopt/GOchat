import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { getStore } from "@/lib/db";
import { emptyDiscoveryState } from "@/lib/discovery/contract";
import StatePanel from "@/components/admin/StatePanel";
import { formatTime } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminSession({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const { id } = await params;
  const store = getStore();
  const session = await store.getSession(id);
  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/admin" className="text-[13px]" style={{ color: "var(--accent-ink)" }}>
          Voltar às conversas
        </Link>
        <p className="mt-6 text-[14px]" style={{ color: "var(--ink-soft)" }}>
          Não foi possível encontrar esta conversa.
        </p>
      </div>
    );
  }

  const messages = await store.listMessages(id);
  const snapshots = await store.listSnapshots(id);
  const latest = snapshots.length ? snapshots[snapshots.length - 1].state : emptyDiscoveryState();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--accent-ink)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Conversas
        </Link>
        <div className="text-right">
          <div className="wordmark text-lg" style={{ color: "var(--ink)" }}>
            {session.title || "Nova conversa"}
          </div>
          <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
            {snapshots.length} versões do estado
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="panel flex max-h-[78vh] flex-col overflow-hidden">
          <div className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)", borderColor: "var(--line)" }}>
            Conversa
          </div>
          <div className="scroll-area flex flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
                Ainda não há mensagens.
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-agent"}`}>
                    {m.content}
                  </div>
                  <span className="mt-1 px-1 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    {m.role === "user" ? "Visitante" : "Consultor"} às {formatTime(m.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel max-h-[78vh] overflow-hidden">
          <div className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)", borderColor: "var(--line)" }}>
            Compreensão estruturada
          </div>
          <div className="scroll-area overflow-y-auto p-4" style={{ maxHeight: "calc(78vh - 42px)" }}>
            <StatePanel state={latest} />
          </div>
        </section>
      </div>
    </div>
  );
}
