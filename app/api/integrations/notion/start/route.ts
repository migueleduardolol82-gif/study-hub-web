import { NextResponse } from "next/server";
import { assistantUser } from "@/lib/assistant-store";
import { notionConfigured } from "@/lib/notion-integration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await assistantUser();
  if (!session.userId) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (!notionConfigured()) return new Response("Conexão Notion ainda não configurada no servidor.", { status: 503 });
  const state = crypto.randomUUID();
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("owner", "user");
  url.searchParams.set("client_id", process.env.NOTION_CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.NOTION_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set("notion_oauth_state", `${session.userId}.${state}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/integrations/notion/callback" });
  return response;
}
