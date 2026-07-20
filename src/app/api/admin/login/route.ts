import { NextResponse } from "next/server";
import { adminConfigured, grantAdmin, verifyPassword } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "A vista do proprietário não está configurada. Defina ADMIN_PASSWORD para a ativar." },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  if (!body.password || !verifyPassword(body.password)) {
    return NextResponse.json({ error: "Essa palavra passe não está correta." }, { status: 401 });
  }

  await grantAdmin();
  return NextResponse.json({ ok: true });
}
