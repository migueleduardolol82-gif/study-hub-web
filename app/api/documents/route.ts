import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { isCloudConfigured } from "@/lib/auth-config";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function owner() { if (!isCloudConfigured()) return null; return (await auth()).userId; }
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}
async function tables() {
  const sql = getDatabase();
  await sql`CREATE TABLE IF NOT EXISTS nexo_documents (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, format TEXT NOT NULL, size_bytes INTEGER NOT NULL, hash TEXT NOT NULL, blob_url TEXT, page_count INTEGER NOT NULL DEFAULT 0, char_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'extracting', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, hash))`;
  await sql`CREATE INDEX IF NOT EXISTS nexo_documents_user_idx ON nexo_documents(user_id, created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS nexo_document_chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES nexo_documents(id) ON DELETE CASCADE, user_id TEXT NOT NULL, chunk_order INTEGER NOT NULL, locator TEXT NOT NULL, content TEXT NOT NULL, UNIQUE(document_id, chunk_order))`;
  await sql`CREATE INDEX IF NOT EXISTS nexo_document_chunks_owner_idx ON nexo_document_chunks(user_id, document_id, chunk_order)`;
  return sql;
}

export async function GET(request: Request) {
  try {
    const userId = await owner();
    if (!isCloudConfigured()) return NextResponse.json(failure("CLOUD_NOT_CONFIGURED", "Sincronização de documentos não configurada."), { status: 503 });
    if (!userId) return NextResponse.json(failure("AUTH_REQUIRED", "Faça login para acessar documentos."), { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    const sql = await tables();
    if (id) {
      const chunks = await sql`SELECT id, document_id, chunk_order, locator, content FROM nexo_document_chunks WHERE user_id = ${userId} AND document_id = ${id} ORDER BY chunk_order`;
      return NextResponse.json(success({ chunks: chunks.map((item) => ({ id: item.id, documentId: item.document_id, order: item.chunk_order, locator: item.locator, text: item.content })) }));
    }
    const documents = await sql`SELECT id, name, format, size_bytes, hash, blob_url, page_count, char_count, status, created_at FROM nexo_documents WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return NextResponse.json(success({ documents }));
  } catch (error) { console.error("GET /api/documents", error); return NextResponse.json(failure("DOCUMENT_LOAD_FAILED", "Não foi possível carregar os documentos.", true), { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
    if (Number(request.headers.get("content-length") || 0) > 250_000) return NextResponse.json(failure("PAYLOAD_TOO_LARGE", "Lote de documento muito grande."), { status: 413 });
    const userId = await owner();
    if (!isCloudConfigured()) return NextResponse.json(failure("CLOUD_NOT_CONFIGURED", "Sincronização de documentos não configurada."), { status: 503 });
    if (!userId) return NextResponse.json(failure("AUTH_REQUIRED", "Faça login para salvar documentos."), { status: 401 });
    const body = await request.json() as { action?: string; document?: Record<string, unknown>; documentId?: string; chunks?: unknown[]; complete?: boolean };
    const sql = await tables();
    if (body.action === "upsert" && body.document) {
      const item = body.document;
      if (!["pdf", "docx", "pptx", "txt", "jpg", "jpeg", "png"].includes(String(item.format)) || !String(item.id || "") || !String(item.name || "") || !String(item.hash || "")) return NextResponse.json(failure("INVALID_DOCUMENT", "Documento inválido."), { status: 400 });
      await sql`INSERT INTO nexo_documents (id,user_id,name,format,size_bytes,hash,blob_url,page_count,char_count,status) VALUES (${String(item.id)},${userId},${String(item.name).slice(0,300)},${String(item.format)},${Number(item.size)||0},${String(item.hash)},${item.blobUrl ? String(item.blobUrl) : null},${Number(item.pageCount)||0},${Number(item.charCount)||0},'extracting') ON CONFLICT (user_id,hash) DO UPDATE SET name=EXCLUDED.name, blob_url=COALESCE(EXCLUDED.blob_url,nexo_documents.blob_url), page_count=EXCLUDED.page_count, char_count=EXCLUDED.char_count`;
      return NextResponse.json(success({ saved: true }));
    }
    if (body.action === "chunks" && body.documentId && Array.isArray(body.chunks) && body.chunks.length <= 30) {
      const owned = await sql`SELECT id FROM nexo_documents WHERE id=${body.documentId} AND user_id=${userId}`;
      if (!owned.length) return NextResponse.json(failure("DOCUMENT_NOT_FOUND", "Documento não encontrado."), { status: 404 });
      const safe = body.chunks.map((item) => { const chunk = item as Record<string, unknown>; return { id: String(chunk.id), document_id: body.documentId, user_id: userId, chunk_order: Number(chunk.order), locator: String(chunk.locator).slice(0,300), content: String(chunk.text).slice(0,6500) }; });
      await sql`INSERT INTO nexo_document_chunks (id,document_id,user_id,chunk_order,locator,content) SELECT id,document_id,user_id,chunk_order,locator,content FROM jsonb_to_recordset(${JSON.stringify(safe)}::jsonb) AS x(id TEXT,document_id TEXT,user_id TEXT,chunk_order INTEGER,locator TEXT,content TEXT) ON CONFLICT (document_id,chunk_order) DO UPDATE SET locator=EXCLUDED.locator,content=EXCLUDED.content`;
      if (body.complete) await sql`UPDATE nexo_documents SET status='ready' WHERE id=${body.documentId} AND user_id=${userId}`;
      return NextResponse.json(success({ saved: true }));
    }
    return NextResponse.json(failure("INVALID_REQUEST", "Operação de documento inválida."), { status: 400 });
  } catch (error) { console.error("POST /api/documents", error); return NextResponse.json(failure("DOCUMENT_SAVE_FAILED", "Não foi possível sincronizar o documento. A cópia local foi preservada.", true), { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
    const userId = await owner();
    if (!userId) return NextResponse.json(failure("AUTH_REQUIRED", "Faça login para excluir documentos."), { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json(failure("INVALID_REQUEST", "Documento não informado."), { status: 400 });
    const sql = await tables();
    const rows = await sql`DELETE FROM nexo_documents WHERE id=${id} AND user_id=${userId} RETURNING blob_url`;
    if (rows[0]?.blob_url) await del(String(rows[0].blob_url));
    return NextResponse.json(success({ deleted: Boolean(rows.length) }));
  } catch (error) { console.error("DELETE /api/documents", error); return NextResponse.json(failure("DOCUMENT_DELETE_FAILED", "Não foi possível excluir o documento.", true), { status: 500 }); }
}
