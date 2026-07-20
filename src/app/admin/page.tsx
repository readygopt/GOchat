import Link from "next/link";
import { adminConfigured, isAdmin } from "@/lib/auth/admin";
import { getStore, isSupabaseActive } from "@/lib/db";
import { providerLabel } from "@/lib/ai";
import LoginForm from "@/components/admin/LoginForm";
import { formatDate, formatTime } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  exploring: "A explorar",
  understanding_problem: "A perceber o problema",
  understanding_process: "A perceber o processo",
  exploring_solutions: "A explorar soluções",
  recommending: "A recomendar",
  validating: "A validar",
  completed: "Concluído",
};

export default async function AdminHome() {
  if (!(await isAdmin())) {
    return <LoginForm configured={adminConfigured()} />;
  }

  const store = getStore();
  const sessions = await store.listSessions();

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="wordmark text-2xl" style={{ color: "var(--ink)" }}>
            Conversas
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-faint)" }}>
            Armazenamento: {isSupabaseActive() ? "Supabase" : "ficheiro local"}. Modelo: {providerLabel()}.
          </p>
        </div>
        <Link href="/" className="text-[13px]" style={{ color: "var(--accent-ink)" }}>
          Abrir conversa
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="panel p-6 text-[14px]" style={{ color: "var(--ink-soft)" }}>
          Ainda não há conversas. Assim que alguém falar com o assistente, aparecem aqui.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/${s.id}`}
                className="panel flex items-center justify-between p-4 transition hover:border-[var(--accent)]"
              >
                <div>
                  <div className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>
                    {s.title || "Nova conversa"}
                  </div>
                  <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
                    {STAGE_LABEL[s.stage] ?? s.stage} às {formatTime(s.updated_at)} em{" "}
                    {formatDate(s.updated_at)}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
