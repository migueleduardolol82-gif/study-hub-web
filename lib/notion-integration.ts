import { getDatabase } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
export { decryptToken, encryptToken } from "@/lib/token-crypto";

export function notionConfigured() {
  return Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET && process.env.NOTION_REDIRECT_URI && process.env.INTEGRATION_ENCRYPTION_KEY);
}

export async function notionDb() {
  const sql = getDatabase();
  await sql`CREATE TABLE IF NOT EXISTS nexo_notion_connections (
    user_id TEXT PRIMARY KEY, access_token_cipher TEXT NOT NULL, refresh_token_cipher TEXT NOT NULL,
    workspace_id TEXT NOT NULL, workspace_name TEXT NOT NULL, bot_id TEXT NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_sync_at TIMESTAMPTZ
  )`;
  return sql;
}

type NotionToken = { access_token?: string; refresh_token?: string; workspace_id?: string; workspace_name?: string; bot_id?: string };

export async function exchangeNotionToken(body: Record<string, string>): Promise<NotionToken> {
  const credentials = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Notion token exchange failed (${response.status})`);
  const data = await response.json() as NotionToken;
  if (!data.access_token || !data.refresh_token) throw new Error("Notion token response incomplete");
  return data;
}

export async function notionSearch(userId: string, query: string) {
  const sql = await notionDb();
  const rows = await sql`SELECT access_token_cipher, refresh_token_cipher FROM nexo_notion_connections WHERE user_id = ${userId}`;
  if (!rows.length) return { connected: false, pages: [] as { title: string; url: string }[] };
  const search = async (token: string) => fetch("https://api.notion.com/v1/search", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2026-03-11", "Content-Type": "application/json" },
    body: JSON.stringify({ query: query.slice(0, 100), page_size: 15 }), signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  let response = await search(decryptToken(String(rows[0].access_token_cipher)));
  if (response.status === 401) {
    const refreshed = await exchangeNotionToken({ grant_type: "refresh_token", refresh_token: decryptToken(String(rows[0].refresh_token_cipher)) });
    await sql`UPDATE nexo_notion_connections SET access_token_cipher = ${encryptToken(refreshed.access_token!)}, refresh_token_cipher = ${encryptToken(refreshed.refresh_token!)} WHERE user_id = ${userId}`;
    response = await search(refreshed.access_token!);
  }
  if (!response.ok) throw new Error(`Notion search failed (${response.status})`);
  const data = await response.json() as { results?: { id?: string; url?: string; properties?: { title?: { title?: { plain_text?: string }[] } }; title?: { plain_text?: string }[] }[] };
  await sql`UPDATE nexo_notion_connections SET last_sync_at = NOW() WHERE user_id = ${userId}`;
  const pages = (data.results || []).map((page) => ({ id: page.id || "", title: page.properties?.title?.title?.map((part) => part.plain_text).join("") || page.title?.map((part) => part.plain_text).join("") || "Página sem título", url: page.url || "" })).filter((page) => {
    try { const url = new URL(page.url); return url.protocol === "https:" && (url.hostname === "notion.so" || url.hostname.endsWith(".notion.so")); } catch { return false; }
  });
  const token = decryptToken(String((await sql`SELECT access_token_cipher FROM nexo_notion_connections WHERE user_id = ${userId}`)[0].access_token_cipher));
  const excerpts = await Promise.all(pages.slice(0, 3).map(async (page) => {
    if (!/^[0-9a-f-]{32,36}$/i.test(page.id)) return { ...page, excerpt: "" };
    try {
      const blocks = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children?page_size=40`, {
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2026-03-11" }, signal: AbortSignal.timeout(10000), cache: "no-store",
      });
      if (!blocks.ok) return { ...page, excerpt: "" };
      const data = await blocks.json() as { results?: Record<string, unknown>[] };
      const excerpt = (data.results || []).flatMap((block) => {
        const value = block[typeof block.type === "string" ? block.type : ""];
        if (!value || typeof value !== "object") return [];
        const richText = (value as { rich_text?: { plain_text?: string }[] }).rich_text;
        return Array.isArray(richText) ? [richText.map((part) => part.plain_text || "").join("")] : [];
      }).filter(Boolean).join("\n").slice(0, 3500);
      return { ...page, excerpt };
    } catch { return { ...page, excerpt: "" }; }
  }));
  return { connected: true, pages: [...excerpts, ...pages.slice(3).map((page) => ({ ...page, excerpt: "" }))] };
}
