import type { AIProvider } from "@/lib/ai/provider";
import type { PersistenceAdapter } from "@/lib/db/types";
import { buildContextBlock, buildSystemPrompt, toModelMessages } from "@/lib/ai/prompt";
import { containsForbidden, sanitizeUserFacing } from "@/lib/discovery/sanitize";
import type { DiscoveryState } from "@/lib/discovery/contract";

const HISTORY_LIMIT = 12;

export interface HandleTurnInput {
  sessionId: string;
  ownerToken: string;
  clientMessageId: string;
  text: string;
}

export interface HandleTurnResult {
  reply: string;
  state: DiscoveryState;
  duplicate: boolean;
  stage: string;
}

export class OwnershipError extends Error {}
export class EngineError extends Error {}

/**
 * Runs one conversation turn. Idempotent on clientMessageId. Loads context, calls the
 * provider, validates and repairs structured output, enforces the writing rules, and persists
 * the user message, the assistant message and a new discovery snapshot.
 */
export async function handleTurn(
  store: PersistenceAdapter,
  provider: AIProvider,
  input: HandleTurnInput,
): Promise<HandleTurnResult> {
  const text = input.text.trim();
  if (!text) throw new EngineError("É necessária uma mensagem.");

  const session = await store.getSession(input.sessionId);
  if (!session) throw new EngineError("Conversa não encontrada.");
  if (session.owner_token !== input.ownerToken) {
    throw new OwnershipError("Esta conversa pertence a outro visitante.");
  }

  // Idempotency. If this client message was already processed, replay the stored reply.
  const existingUser = await store.getMessageByClientId(
    input.sessionId,
    input.clientMessageId,
  );
  if (existingUser) {
    const snapshot = await store.latestSnapshot(input.sessionId);
    const messages = await store.listMessages(input.sessionId);
    const idx = messages.findIndex((m) => m.id === existingUser.id);
    const following = messages
      .slice(idx + 1)
      .find((m) => m.role === "assistant");
    return {
      reply: following?.content ?? "",
      state: snapshot?.state ?? (await emptyState()),
      duplicate: true,
      stage: snapshot?.state.stage ?? session.stage,
    };
  }

  const priorSnapshot = await store.latestSnapshot(input.sessionId);
  const priorState = priorSnapshot?.state ?? null;
  const history = await store.recentMessages(input.sessionId, HISTORY_LIMIT);

  const req = {
    system: buildSystemPrompt(),
    contextBlock: buildContextBlock(priorState, session.summary),
    history: toModelMessages(history),
    userMessage: text,
    priorState,
  };

  // First attempt.
  let result = await provider.generateTurn(req);

  // One repair retry on malformed structured output.
  if (!result.turn) {
    result = await provider.generateTurn({
      ...req,
      repairNote:
        `Your previous response did not match the required structure. Error: ${result.error ?? "unknown"}. ` +
        "Call record_turn again with a valid assistant_message string and a complete discovery_state object.",
    });
  }

  // Record the user message first so it is never lost even if generation failed.
  await store.appendMessage({
    session_id: input.sessionId,
    role: "user",
    content: text,
    client_message_id: input.clientMessageId,
  });

  if (!result.turn) {
    // Structured output could not be produced. Preserve the conversation, do not corrupt state.
    throw new EngineError("O assistente não conseguiu produzir uma resposta válida. Tente novamente.");
  }

  let reply = result.turn.assistant_message;
  if (containsForbidden(reply)) {
    reply = sanitizeUserFacing(reply);
  }

  const newState = result.turn.discovery_state;

  await store.appendMessage({
    session_id: input.sessionId,
    role: "assistant",
    content: reply,
  });
  const snapshot = await store.saveSnapshot(input.sessionId, newState);

  await store.updateSessionMeta(input.sessionId, {
    stage: newState.stage,
    summary: newState.summary,
    title: deriveTitle(session.title, newState),
  });

  return {
    reply,
    state: snapshot.state,
    duplicate: false,
    stage: newState.stage,
  };
}

async function emptyState(): Promise<DiscoveryState> {
  const { emptyDiscoveryState } = await import("@/lib/discovery/contract");
  return emptyDiscoveryState();
}

function deriveTitle(current: string, state: DiscoveryState): string {
  if (current && current !== "Nova conversa") return current;
  if (state.business.name) return state.business.name;
  if (state.business.industry) return capitalize(state.business.industry);
  return current || "Nova conversa";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
