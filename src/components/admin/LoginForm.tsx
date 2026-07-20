"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = await res.json();
      setError(data.error ?? "Não foi possível entrar.");
    } catch {
      setError("Não foi possível entrar. Tente novamente, por favor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-6">
        <h1 className="wordmark mb-1 text-xl" style={{ color: "var(--ink)" }}>
          Vista do proprietário
        </h1>
        <p className="mb-5 text-[13px]" style={{ color: "var(--ink-soft)" }}>
          Entre para inspecionar as conversas e a compreensão estruturada por trás delas.
        </p>
        {!configured ? (
          <p className="text-[13px]" style={{ color: "var(--danger)" }}>
            A vista do proprietário ainda não está configurada. Defina ADMIN_PASSWORD no ambiente para a ativar.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Palavra passe"
              autoFocus
              className="rounded-xl px-3 py-2 text-[15px] outline-none"
              style={{ background: "var(--surface-muted)", color: "var(--ink)", border: "1px solid var(--line)" }}
            />
            {error && (
              <span className="text-[13px]" style={{ color: "var(--danger)" }}>
                {error}
              </span>
            )}
            <button
              type="submit"
              disabled={busy || !password}
              className="send-btn py-2 text-[15px] font-medium disabled:opacity-40"
            >
              {busy ? "A verificar" : "Entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
