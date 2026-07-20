import type { DiscoveryState } from "@/lib/discovery/contract";

function translatePriority(p: string): string {
  if (p === "high") return "alta";
  if (p === "low") return "baixa";
  return "média";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3
        className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--ink-faint)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span
          key={i}
          className="rounded-full px-2.5 py-1 text-[12px]"
          style={{ background: "var(--surface-muted)", color: "var(--ink-soft)" }}
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <p className="text-[12px] italic" style={{ color: "var(--ink-faint)" }}>
      Ainda sem registo.
    </p>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-[12px]" style={{ color: "var(--ink-soft)" }}>
        <span>{label}</span>
        <span>{Math.round(value * 100)}</span>
      </div>
      <div className="meter">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

export default function StatePanel({ state }: { state: DiscoveryState }) {
  const rec = state.recommended_solution;
  return (
    <div>
      <Section title="Confiança">
        <Meter label="Compreensão do negócio" value={state.confidence.business} />
        <Meter label="Compreensão do problema" value={state.confidence.problem} />
        <Meter label="Compreensão da solução" value={state.confidence.solution} />
      </Section>

      {rec && (
        <Section title="Solução recomendada">
          <div className="panel p-3">
            <div className="text-[14px] font-semibold" style={{ color: "var(--accent-ink)" }}>
              {rec.type}
            </div>
            {rec.summary && (
              <p className="mt-1 text-[13px]" style={{ color: "var(--ink-soft)" }}>
                {rec.summary}
              </p>
            )}
            {rec.why && (
              <p className="mt-2 text-[12px]" style={{ color: "var(--ink-faint)" }}>
                Porquê: {rec.why}
              </p>
            )}
            {rec.core_capabilities.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                  Capacidades principais
                </div>
                <ul className="list-disc pl-4 text-[13px]" style={{ color: "var(--ink-soft)" }}>
                  {rec.core_capabilities.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rec.mvp.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                    Primeira versão
                  </div>
                  <Chips items={rec.mvp} />
                </div>
              )}
              {rec.integrations.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                    Integrações
                  </div>
                  <Chips items={rec.integrations} />
                </div>
              )}
            </div>
            {rec.human_handoff && (
              <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
                Passagem para humano: {rec.human_handoff}
              </p>
            )}
          </div>
        </Section>
      )}

      <Section title="Negócio">
        <KeyVals
          rows={[
            ["Nome", state.business.name],
            ["Setor", state.business.industry],
            ["Localização", state.business.location],
            ["Modelo", state.business.model],
            ["Dimensão", state.business.size],
          ]}
        />
        {state.business.services.length > 0 && (
          <div className="mt-2">
            <Chips items={state.business.services} />
          </div>
        )}
      </Section>

      <Section title="Canais">
        <Chips items={state.channels} />
      </Section>

      <Section title="Factos confirmados">
        <Bullets items={state.confirmed_facts} />
      </Section>

      <Section title="Inferências">
        <Bullets items={state.inferences} muted />
      </Section>

      <Section title="Pressupostos">
        <Bullets items={state.assumptions} muted />
      </Section>

      <Section title="Pontos de atrito">
        {state.pain_points.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-col gap-2">
            {state.pain_points.map((p, i) => (
              <li key={i} className="panel p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: "var(--ink)" }}>
                    {p.text}
                  </span>
                  <span
                    className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase"
                    style={{
                      background: p.status === "confirmed" ? "var(--accent-soft)" : "var(--surface-muted)",
                      color: p.status === "confirmed" ? "var(--accent-ink)" : "var(--ink-faint)",
                    }}
                  >
                    {p.status === "confirmed" ? "confirmado" : "inferido"}
                  </span>
                </div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  Prioridade {translatePriority(p.priority)}. Confiança {Math.round(p.confidence * 100)}.
                  {p.evidence ? ` Evidência: ${p.evidence}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Capacidades desejadas">
        <Chips items={state.desired_capabilities} />
      </Section>

      <Section title="Ações necessárias">
        <Chips items={state.required_actions} />
      </Section>

      <Section title="Perguntas frequentes">
        <Bullets items={state.frequent_questions} muted />
      </Section>

      <Section title="Perguntas em aberto">
        <Bullets items={state.open_questions} muted />
      </Section>

      {state.summary && (
        <Section title="Resumo corrente">
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            {state.summary}
          </p>
        </Section>
      )}
    </div>
  );
}

function KeyVals({ rows }: { rows: [string, string][] }) {
  const filled = rows.filter(([, v]) => v && v.trim());
  if (!filled.length) return <Empty />;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
      {filled.map(([k, v]) => (
        <div key={k} className="contents">
          <dt style={{ color: "var(--ink-faint)" }}>{k}</dt>
          <dd style={{ color: "var(--ink)" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Bullets({ items, muted }: { items: string[]; muted?: boolean }) {
  if (!items.length) return <Empty />;
  return (
    <ul className="flex flex-col gap-1 text-[13px]">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2" style={{ color: muted ? "var(--ink-soft)" : "var(--ink)" }}>
          <span
            className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
