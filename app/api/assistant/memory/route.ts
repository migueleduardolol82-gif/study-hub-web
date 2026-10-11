import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { assistantDb, assistantUser, sameOrigin } from "@/lib/assistant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const sql = await assistantDb();
  const rows = await sql`SELECT id, content, created_at FROM nexo_assistant_memory WHERE user_id = ${session.userId} ORDER BY created_at DESC LIMIT 100`;
  return NextResponse.json(success(rows), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const body = await request.json().catch(() => ({})) as { content?: string };
  const content = body.content?.trim() || "";
  if (!content || content.length > 500) return NextResponse.json(failure("INVALID_REQUEST", "Memória deve ter até 500 caracteres."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`INSERT INTO nexo_assistant_memory (id, user_id, content) VALUES (${crypto.randomUUID()}, ${session.userId}, ${content}) RETURNING id, content, created_at`;
  return NextResponse.json(success(rows[0]), { status: 201 });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const body = await request.json().catch(() => ({})) as { id?: string; content?: string };
  const content = body.content?.trim() || "";
  if (!body.id || !content || content.length > 500) return NextResponse.json(failure("INVALID_REQUEST", "Memória inválida."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`UPDATE nexo_assistant_memory SET content = ${content} WHERE id = ${body.id} AND user_id = ${session.userId} RETURNING id, content, created_at`;
  return rows.length ? NextResponse.json(success(rows[0])) : NextResponse.json(failure("NOT_FOUND", "Memória não encontrada."), { status: 404 });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json(failure("INVALID_REQUEST", "Memória inválida."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`DELETE FROM nexo_assistant_memory WHERE id = ${id} AND user_id = ${session.userId} RETURNING id`;
  return rows.length ? NextResponse.json(success({ deleted: true })) : NextResponse.json(failure("NOT_FOUND", "Memória não encontrada."), { status: 404 });
}

