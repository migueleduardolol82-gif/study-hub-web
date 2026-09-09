import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { failure, success } from "./api-contract";
import { isClerkConfigured } from "./auth-config";
import { OpenAIRequestError } from "./openai";
import { isRecord } from "./safe-json";

export class InvalidAIRequest extends Error {}

export async function aiRoute(request: Request, route: string, generate: (body: Record<string, unknown>) => Promise<unknown>) {
  const started = Date.now();
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
    if (isClerkConfigured() && !(await auth()).userId) {
      return NextResponse.json(failure("AUTH_REQUIRED", "Faça login para usar a inteligência artificial."), { status: 401 });
    }
    if (!request.headers.get("content-type")?.includes("application/json")) throw new InvalidAIRequest("Envie a solicitação em formato JSON.");
    if (Number(request.headers.get("content-length") || 0) > 150000) throw new InvalidAIRequest("Selecione um trecho menor do material.");
    const raw = await request.text();
    if (raw.length > 150000) throw new InvalidAIRequest("Selecione um trecho menor do material.");
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new InvalidAIRequest("A solicitação enviada é inválida."); }
    if (!isRecord(body)) throw new InvalidAIRequest("A solicitação enviada é inválida.");
    const data = await generate(body);
    console.info("ai_generation_completed", { route, elapsedMs: Date.now() - started });
    return NextResponse.json(success(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidAIRequest) return NextResponse.json(failure("INVALID_REQUEST", error.message), { status: 400 });
    // Prompts and user source text are deliberately excluded from diagnostics.
    console.error("ai_generation_failed", { route, elapsedMs: Date.now() - started, code: error instanceof OpenAIRequestError ? error.code : "UNKNOWN_ERROR", detail: error instanceof OpenAIRequestError ? error.technicalMessage : error instanceof Error ? error.stack : String(error) });
    if (error instanceof OpenAIRequestError) return NextResponse.json(failure(error.code, error.message, error.retryable), { status: error.status });
    return NextResponse.json(failure("CURRICULUM_GENERATION_FAILED", "Não foi possível concluir a geração. Tente novamente.", true), { status: 500 });
  }
}
