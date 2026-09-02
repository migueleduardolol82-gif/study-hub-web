import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isCloudConfigured } from "@/lib/auth-config";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUserId() {
  if (!isCloudConfigured()) return null;
  const session = await auth();
  return session.userId;
}

async function ensureTable() {
  const sql = getDatabase();
  await sql`
    CREATE TABLE IF NOT EXISTS nexo_user_state (
      user_id TEXT PRIMARY KEY,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  return sql;
}

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!isCloudConfigured()) {
      return NextResponse.json({ error: "Sincronização na nuvem ainda não configurada." }, { status: 503 });
    }
    if (!userId) return NextResponse.json({ error: "Faça login para acessar seu painel." }, { status: 401 });
    const sql = await ensureTable();
    const rows = await sql`SELECT state, updated_at FROM nexo_user_state WHERE user_id = ${userId}`;
    const record = rows[0] as { state?: unknown; updated_at?: string } | undefined;
    return NextResponse.json({ state: record?.state ?? null, updatedAt: record?.updated_at ?? null });
  } catch (error) {
    console.error("GET /api/user-data", error);
    return NextResponse.json({ error: "Não foi possível carregar seu painel agora." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    }
    const userId = await currentUserId();
    if (!isCloudConfigured()) {
      return NextResponse.json({ error: "Sincronização na nuvem ainda não configurada." }, { status: 503 });
    }
    if (!userId) return NextResponse.json({ error: "Faça login para salvar seu painel." }, { status: 401 });

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4_000_000) return NextResponse.json({ error: "O painel ultrapassou o limite de 4 MB." }, { status: 413 });
    const body = await request.json() as { state?: unknown };
    if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) {
      return NextResponse.json({ error: "Estado do painel inválido." }, { status: 400 });
    }

    const serialized = JSON.stringify(body.state);
    if (serialized.length > 4_000_000) return NextResponse.json({ error: "O painel ultrapassou o limite de 4 MB." }, { status: 413 });
    const sql = await ensureTable();
    await sql`
      INSERT INTO nexo_user_state (user_id, state, updated_at)
      VALUES (${userId}, ${serialized}::jsonb, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
    `;
    return NextResponse.json({ saved: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("PUT /api/user-data", error);
    return NextResponse.json({ error: "Não foi possível salvar seu painel agora." }, { status: 500 });
  }
}
