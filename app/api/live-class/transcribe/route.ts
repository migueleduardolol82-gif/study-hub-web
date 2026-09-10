import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { isClerkConfigured } from "@/lib/auth-config";
import { getOpenAIKey, OpenAIRequestError, OPENAI_API_URL } from "@/lib/openai";
import { getNestedMessage, isRecord, parseJsonSafely } from "@/lib/safe-json";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

function extensionFor(type: string) {
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mpeg")) return "mp3";
  return "webm";
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
    if (isClerkConfigured() && !(await auth()).userId) return NextResponse.json(failure("AUTH_REQUIRED", "Faça login para usar a aula ao vivo."), { status: 401 });
    const data = await request.formData();
    const chunk = data.get("audio");
    if (!(chunk instanceof File) || !chunk.size) return NextResponse.json(failure("INVALID_REQUEST", "O trecho de áudio está vazio."), { status: 400 });
    if (chunk.size > MAX_CHUNK_BYTES) return NextResponse.json(failure("PAYLOAD_TOO_LARGE", "O trecho de áudio ultrapassou 8 MB."), { status: 413 });
    if (!chunk.type.startsWith("audio/") && !chunk.type.startsWith("video/")) return NextResponse.json(failure("INVALID_MEDIA", "Formato de áudio não suportado."), { status: 415 });

    const form = new FormData();
    form.append("file", new File([await chunk.arrayBuffer()], `trecho.${extensionFor(chunk.type)}`, { type: chunk.type }));
    form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
    form.append("language", "pt");
    form.append("response_format", "json");
    form.append("prompt", "Transcreva fielmente este trecho de aula em português. Preserve termos técnicos, nomes, fórmulas e números. Não acrescente explicações.");
    const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${getOpenAIKey()}` }, body: form, signal: AbortSignal.timeout(50_000) });
    const raw = await response.text();
    let payload: unknown = null;
    if (response.headers.get("content-type")?.includes("application/json") && raw.trim()) {
      try { payload = parseJsonSafely(raw); } catch { payload = null; }
    }
    if (!response.ok) {
      const detail = getNestedMessage(payload) || raw.slice(0, 400) || `HTTP ${response.status}`;
      if (response.status === 401 || response.status === 403) throw new OpenAIRequestError("OPENAI_AUTH_FAILED", "A configuração da IA precisa ser revisada.", response.status, false, detail);
      if (response.status === 429) throw new OpenAIRequestError("OPENAI_RATE_LIMIT", "O limite de transcrição foi atingido. Aguarde e tente novamente.", 429, true, detail);
      throw new OpenAIRequestError("OPENAI_UNAVAILABLE", "Não foi possível transcrever este trecho.", response.status, response.status >= 500, detail);
    }
    if (!isRecord(payload) || typeof payload.text !== "string") throw new OpenAIRequestError("MALFORMED_AI_RESPONSE", "A transcrição devolveu uma resposta inválida.", 502, true, raw.slice(0, 400));
    return NextResponse.json(success({ transcript: payload.text.trim() }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("POST /api/live-class/transcribe", error instanceof OpenAIRequestError ? error.technicalMessage : error);
    if (error instanceof OpenAIRequestError) return NextResponse.json(failure(error.code, error.message, error.retryable), { status: error.status });
    const timeout = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    return NextResponse.json(failure(timeout ? "OPENAI_TIMEOUT" : "LIVE_TRANSCRIPTION_FAILED", timeout ? "Este trecho demorou demais para transcrever. Tente novamente." : "Não foi possível transcrever este trecho.", true), { status: timeout ? 504 : 500 });
  }
}
