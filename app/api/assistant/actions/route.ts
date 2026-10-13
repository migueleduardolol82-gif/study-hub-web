import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { actionRow, assistantDb, assistantUser, sameOrigin } from "@/lib/assistant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json(failure("INVALID_REQUEST", "Conversa inválida."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`SELECT id, conversation_id, kind, payload, status, error, created_at FROM nexo_assistant_actions WHERE user_id = ${session.userId} AND conversation_id = ${conversationId} ORDER BY created_at DESC LIMIT 30`;
  return NextResponse.json(success(rows.map((row) => actionRow(row))), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const body = await request.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json(failure("INVALID_REQUEST", "Ação inválida."), { status: 400 });
  const sql = await assistantDb();
  const claimed = await sql`UPDATE nexo_assistant_actions SET status = 'executing', error = NULL WHERE id = ${body.id} AND user_id = ${session.userId} AND status IN ('planned', 'failed') RETURNING id, conversation_id, kind, payload, status, error, created_at`;
  if (!claimed.length) return NextResponse.json(failure("ACTION_NOT_AVAILABLE", "Ação já executada, cancelada ou não encontrada."), { status: 409 });
  const action = actionRow(claimed[0]);
  const payload = action.payload;
  const starts = Date.parse(payload.startsAt);
  const ends = Date.parse(payload.endsAt);
  if (action.kind !== "create_agenda" || !payload.title || !Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts || !["event", "task"].includes(payload.kind)) {
    await sql`UPDATE nexo_assistant_actions SET status = 'failed', error = 'Dados inválidos' WHERE id = ${action.id} AND user_id = ${session.userId}`;
    return NextResponse.json(failure("INVALID_ACTION", "A proposta não pode ser executada."), { status: 400 });
  }
  try {
    await sql`INSERT INTO nexo_agenda_items (id, user_id, title, starts_at, ends_at, kind, notes)
      VALUES (${action.id}, ${session.userId}, ${payload.title}, ${new Date(starts).toISOString()}, ${new Date(ends).toISOString()}, ${payload.kind}, 'Criado pelo Assistente após confirmação')
      ON CONFLICT (id) DO NOTHING`;
    const saved = await sql`UPDATE nexo_assistant_actions SET status = 'executed', executed_at = NOW() WHERE id = ${action.id} AND user_id = ${session.userId} RETURNING id, conversation_id, kind, payload, status, error, created_at`;
    return NextResponse.json(success(actionRow(saved[0])));
  } catch {
    await sql`UPDATE nexo_assistant_actions SET status = 'failed', error = 'Falha ao salvar na agenda' WHERE id = ${action.id} AND user_id = ${session.userId}`;
    return NextResponse.json(failure("ACTION_FAILED", "Não foi possível salvar na agenda. Tente novamente.", true), { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json(failure("INVALID_REQUEST", "Ação inválida."), { status: 400 });
  const sql = await assistantDb();
  const rows = await sql`UPDATE nexo_assistant_actions SET status = 'cancelled' WHERE id = ${id} AND user_id = ${session.userId} AND status = 'planned' RETURNING id, conversation_id, kind, payload, status, error, created_at`;
  return rows.length ? NextResponse.json(success(actionRow(rows[0]))) : NextResponse.json(failure("ACTION_NOT_AVAILABLE", "Ação indisponível."), { status: 409 });
}
