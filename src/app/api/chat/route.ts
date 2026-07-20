import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import { currentOwnerToken, hashToken } from "@/lib/auth/owner";
import { EngineError, OwnershipError, handleTurn } from "@/lib/chat/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { sessionId?: string; clientMessageId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const { sessionId, clientMessageId, text } = body;
  if (!sessionId || !clientMessageId || !text || !text.trim()) {
    return NextResponse.json({ error: "É necessária uma mensagem." }, { status: 400 });
  }

  const raw = await currentOwnerToken();
  if (!raw) {
    return NextResponse.json(
      { error: "A sua sessão expirou. Atualize a página, por favor." },
      { status: 401 },
    );
  }

  try {
    const store = getStore();
    const provider = getProvider();
    const result = await handleTurn(store, provider, {
      sessionId,
      ownerToken: hashToken(raw),
      clientMessageId,
      text,
    });

    return NextResponse.json({
      reply: result.reply,
      stage: result.stage,
      hasRecommendation: Boolean(result.state.recommended_solution),
      duplicate: result.duplicate,
    });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }
    if (err instanceof EngineError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("POST /api/chat", err);
    return NextResponse.json(
      {
        error:
          "O assistente está com dificuldade em responder neste momento. A sua mensagem foi guardada. Tente novamente daqui a instantes.",
      },
      { status: 502 },
    );
  }
}
