import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/db";
import { isCloudConfigured } from "@/lib/auth-config";

export type AssistantMessage = { role: "user" | "assistant"; text: string; at: string };
export type AgendaItem = { id: string; title: string; startsAt: string; endsAt: string; kind: "event" | "task"; done: boolean; notes: string };
export type AssistantAction = { id: string; conversationId: string; kind: "create_agenda"; payload: { title: string; startsAt: string; endsAt: string; kind: "event" | "task" }; status: "planned" | "executing" | "executed" | "failed" | "cancelled"; createdAt: string; error?: string };

export async function assistantUser() {
  if (!isCloudConfigured()) return { error: "CLOUD_NOT_CONFIGURED", status: 503, userId: null };
  const { userId } = await auth();
  if (!userId) return { error: "AUTH_REQUIRED", status: 401, userId: null };
  return { userId, error: null, status: 200 };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try { return !origin || !host || new URL(origin).host === host; } catch { return false; }
}

export async function assistantDb() {
  const sql = getDatabase();
  await sql`CREATE TABLE IF NOT EXISTS nexo_user_state (
    user_id TEXT PRIMARY KEY, state JSONB NOT NULL DEFAULT '{}'::jsonb,
    schema_version SMALLINT NOT NULL DEFAULT 6, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS nexo_assistant_conversations (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS nexo_assistant_conversations_user_updated ON nexo_assistant_conversations (user_id, updated_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS nexo_assistant_memory (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS nexo_assistant_memory_user ON nexo_assistant_memory (user_id)`;
  await sql`CREATE TABLE IF NOT EXISTS nexo_agenda_items (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('event', 'task')),
    done BOOLEAN NOT NULL DEFAULT FALSE, notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS nexo_agenda_user_start ON nexo_agenda_items (user_id, starts_at)`;
  await sql`CREATE TABLE IF NOT EXISTS nexo_assistant_actions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
    kind TEXT NOT NULL, payload JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'executing', 'executed', 'failed', 'cancelled')),
    error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), executed_at TIMESTAMPTZ
  )`;
  await sql`CREATE INDEX IF NOT EXISTS nexo_assistant_actions_user_conversation ON nexo_assistant_actions (user_id, conversation_id, created_at)`;
  return sql;
}

export function agendaRow(row: Record<string, unknown>): AgendaItem {
  return {
    id: String(row.id), title: String(row.title), startsAt: new Date(String(row.starts_at)).toISOString(),
    endsAt: new Date(String(row.ends_at)).toISOString(), kind: row.kind === "task" ? "task" : "event",
    done: Boolean(row.done), notes: String(row.notes || ""),
  };
}

export function actionRow(row: Record<string, unknown>): AssistantAction {
  return { id: String(row.id), conversationId: String(row.conversation_id), kind: "create_agenda", payload: row.payload as AssistantAction["payload"], status: row.status as AssistantAction["status"], createdAt: new Date(String(row.created_at)).toISOString(), error: typeof row.error === "string" ? row.error : undefined };
}
