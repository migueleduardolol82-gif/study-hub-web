import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assistantUser } from "@/lib/assistant-store";
import { encryptToken, exchangeNotionToken, notionConfigured, notionDb } from "@/lib/notion-integration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await assistantUser();
  const url = new URL(request.url);
  const redirect = new URL("/", url.origin);
  redirect.searchParams.set("assistant", "integrations");
  if (!session.userId || !notionConfigured()) return NextResponse.redirect(redirect);
  const cookieStore = await cookies();
  const expected = cookieStore.get("notion_oauth_state")?.value;
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!expected || !state || expected !== `${session.userId}.${state}` || !code || url.searchParams.has("error")) {
    redirect.searchParams.set("notion", "denied");
    return NextResponse.redirect(redirect);
  }
  try {
    const token = await exchangeNotionToken({ grant_type: "authorization_code", code, redirect_uri: process.env.NOTION_REDIRECT_URI! });
    const sql = await notionDb();
    await sql`INSERT INTO nexo_notion_connections (user_id, access_token_cipher, refresh_token_cipher, workspace_id, workspace_name, bot_id)
      VALUES (${session.userId}, ${encryptToken(token.access_token!)}, ${encryptToken(token.refresh_token!)}, ${token.workspace_id || ""}, ${token.workspace_name || "Notion"}, ${token.bot_id || ""})
      ON CONFLICT (user_id) DO UPDATE SET access_token_cipher = EXCLUDED.access_token_cipher, refresh_token_cipher = EXCLUDED.refresh_token_cipher,
      workspace_id = EXCLUDED.workspace_id, workspace_name = EXCLUDED.workspace_name, bot_id = EXCLUDED.bot_id, connected_at = NOW()`;
    redirect.searchParams.set("notion", "connected");
  } catch {
    redirect.searchParams.set("notion", "failed");
  }
  const response = NextResponse.redirect(redirect);
  response.cookies.set("notion_oauth_state", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/api/integrations/notion/callback" });
  return response;
}
