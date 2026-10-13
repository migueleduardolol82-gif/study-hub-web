import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { agendaRow, assistantDb, assistantUser, sameOrigin } from "@/lib/assistant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta para ver a agenda."), { status: session.status });
  const sql = await assistantDb();
  const rows = await sql`SELECT * FROM nexo_agenda_items WHERE user_id = ${session.userId} ORDER BY starts_at DESC LIMIT 500`;
  return NextResponse.json(success(rows.map((row) => agendaRow(row))), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const body = await request.json().catch(() => ({})) as { title?: string; startsAt?: string; endsAt?: string; kind?: string; notes?: string };
  const title = body.title?.trim() || "";
  const starts = Date.parse(body.startsAt || "");
  const ends = Date.parse(body.endsAt || "");
  if (!title || title.length > 160 || !Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts || ends - starts > 30 * 86400000 || !["event", "task"].includes(body.kind || "") || (body.notes || "").length > 2000) {
    return NextResponse.json(failure("INVALID_REQUEST", "Confira título, tipo e horários."), { status: 400 });
  }
  const id = crypto.randomUUID();
  const sql = await assistantDb();
  const rows = await sql`INSERT INTO nexo_agenda_items (id, user_id, title, starts_at, ends_at, kind, notes) VALUES (${id}, ${session.userId}, ${title}, ${new Date(starts).toISOString()}, ${new Date(ends).toISOString()}, ${body.kind!}, ${body.notes || ""}) RETURNING *`;
  return NextResponse.json(success(agendaRow(rows[0])), { status: 201 });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const body = await request.json().catch(() => ({})) as { id?: string; done?: boolean };
  if (!body.id || typeof body.done !== "boolean") return NextResponse.json(failure("INVALID_REQUEST", "Alteração inválida."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`UPDATE nexo_agenda_items SET done = ${body.done} WHERE id = ${body.id} AND user_id = ${session.userId} AND kind = 'task' RETURNING *`;
  return rows.length ? NextResponse.json(success(agendaRow(rows[0]))) : NextResponse.json(failure("NOT_FOUND", "Tarefa não encontrada."), { status: 404 });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json(failure("INVALID_REQUEST", "Item inválido."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`DELETE FROM nexo_agenda_items WHERE id = ${id} AND user_id = ${session.userId} RETURNING id`;
  return rows.length ? NextResponse.json(success({ deleted: true })) : NextResponse.json(failure("NOT_FOUND", "Item não encontrado."), { status: 404 });
}
