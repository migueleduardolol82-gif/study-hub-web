import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { assistantUser, sameOrigin } from "@/lib/assistant-store";
import { notionConfigured, notionDb } from "@/lib/notion-integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  if (!notionConfigured()) return NextResponse.json(success({ configured: false, connected: false }));
  const sql = await notionDb();
  const rows = await sql`SELECT workspace_name, connected_at, last_sync_at FROM nexo_notion_connections WHERE user_id = ${session.userId}`;
  return NextResponse.json(success({ configured: true, connected: rows.length > 0, workspaceName: rows[0]?.workspace_name || null, connectedAt: rows[0]?.connected_at || null, lastSyncAt: rows[0]?.last_sync_at || null }), { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
  const session = await assistantUser();
  if (!session.userId) return NextResponse.json(failure(session.error!, "Entre na conta."), { status: session.status });
  const sql = await notionDb();
  await sql`DELETE FROM nexo_notion_connections WHERE user_id = ${session.userId}`;
  return NextResponse.json(success({ disconnected: true }));
}
