import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { ensureOwnerToken, hashToken } from "@/lib/auth/owner";
import { emptyDiscoveryState } from "@/lib/discovery/contract";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Create a new conversation for the current visitor.
export async function POST() {
  try {
    const raw = await ensureOwnerToken();
    const store = getStore();
    const session = await store.createSession({
      id: randomUUID(),
      owner_token: hashToken(raw),
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    console.error("POST /api/session", err);
    return NextResponse.json(
      { error: "Não foi possível iniciar uma conversa agora. Tente novamente." },
      { status: 500 },
    );
  }
}

// Resume an existing conversation. Returns messages and the latest discovery stage.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta o identificador da conversa." }, { status: 400 });
    }

    const raw = await ensureOwnerToken();
    const store = getStore();
    const session = await store.getSession(id);

    if (!session || session.owner_token !== hashToken(raw)) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    const messages = await store.listMessages(id);
    const snapshot = await store.latestSnapshot(id);

    return NextResponse.json({
      sessionId: session.id,
      stage: snapshot?.state.stage ?? session.stage,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      })),
      hasRecommendation: Boolean(
        (snapshot?.state ?? emptyDiscoveryState()).recommended_solution,
      ),
    });
  } catch (err) {
    console.error("GET /api/session", err);
    return NextResponse.json(
      { error: "Não foi possível carregar esta conversa. Tente novamente." },
      { status: 500 },
    );
  }
}
