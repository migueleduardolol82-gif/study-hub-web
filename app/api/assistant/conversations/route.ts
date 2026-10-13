import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { assistantDb, assistantUser, sameOrigin } from "@/lib/assistant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta para abrir o assistente."), { status: session.status });
  const sql = await assistantDb();
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const rows = await sql`SELECT id, title, messages, updated_at FROM nexo_assistant_conversations WHERE id = ${id} AND user_id = ${session.userId}`;
    if (!rows.length) return NextResponse.json(failure("NOT_FOUND", "Conversa não encontrada."), { status: 404 });
    return NextResponse.json(success(rows[0]), { headers: { "Cache-Control": "no-store" } });
  }
  const rows = await sql`SELECT id, title, updated_at FROM nexo_assistant_conversations WHERE user_id = ${session.userId} ORDER BY updated_at DESC LIMIT 100`;
  return NextResponse.json(success(rows), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta para criar uma conversa."), { status: session.status });
  const id = crypto.randomUUID();
  const sql = await assistantDb();
  await sql`INSERT INTO nexo_assistant_conversations (id, user_id, title) VALUES (${id}, ${session.userId}, 'Nova conversa')`;
  return NextResponse.json(success({ id, title: "Nova conversa", messages: [] }), { status: 201 });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const body = await request.json().catch(() => ({})) as { id?: string; title?: string };
  if (!body.id || !body.title?.trim() || body.title.length > 100) return NextResponse.json(failure("INVALID_REQUEST", "Nome inválido."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`UPDATE nexo_assistant_conversations SET title = ${body.title.trim()}, updated_at = NOW() WHERE id = ${body.id} AND user_id = ${session.userId} RETURNING id`;
  return rows.length ? NextResponse.json(success({ saved: true })) : NextResponse.json(failure("NOT_FOUND", "Conversa não encontrada."), { status: 404 });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json(failure("INVALID_REQUEST", "Conversa inválida."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`DELETE FROM nexo_assistant_conversations WHERE id = ${id} AND user_id = ${session.userId} RETURNING id`;
  if (rows.length) await sql`DELETE FROM nexo_assistant_actions WHERE conversation_id = ${id} AND user_id = ${session.userId} AND status IN ('planned', 'failed', 'cancelled')`;
  return rows.length ? NextResponse.json(success({ deleted: true })) : NextResponse.json(failure("NOT_FOUND", "Conversa não encontrada."), { status: 404 });
}
