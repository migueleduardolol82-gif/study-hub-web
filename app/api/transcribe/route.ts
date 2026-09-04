import { del } from "@vercel/blob";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { NextResponse } from "next/server";
import { failure, success } from "@/lib/api-contract";
import { getOpenAIKey, OpenAIRequestError, OPENAI_API_URL } from "@/lib/openai";
import { getNestedMessage, isRecord, parseJsonSafely } from "@/lib/safe-json";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_MEDIA_BYTES = 250 * 1024 * 1024;
const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
const run = promisify(execFile);

const extensionByMime: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
};

function driveIdFromUrl(url: string) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  return patterns.map((pattern) => url.match(pattern)?.[1]).find(Boolean);
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host) || /^fe80:/i.test(host) || /^(fc|fd)/i.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function resolvePublicMediaUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Cole um link público válido começando com https://.");
  }
  if (parsed.protocol !== "https:" || isPrivateHostname(parsed.hostname)) {
    throw new Error("Por segurança, use um link público HTTPS.");
  }

  const driveId = driveIdFromUrl(rawUrl);
  if (driveId) {
    return `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;
  }
  if (parsed.hostname.endsWith("dropbox.com")) parsed.searchParams.set("dl", "1");
  return parsed.toString();
}

function safeExtension(fileName: string, mimeType = "") {
  const extension = extname(fileName).toLowerCase();
  if (/^\.[a-z0-9]{2,5}$/.test(extension)) return extension;
  return extensionByMime[mimeType.split(";")[0].toLowerCase()] || ".mp4";
}

async function downloadToFile(url: string, destination: string) {
  let currentUrl = resolvePublicMediaUrl(url);
  let response: Response | null = null;
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const target = new URL(currentUrl);
    if (target.protocol !== "https:" || isPrivateHostname(target.hostname)) {
      throw new Error("O link tentou redirecionar para um endereço não permitido.");
    }
    response = await fetch(target, {
      redirect: "manual",
      headers: { "User-Agent": "Nexo-Study-Hub/1.0" },
    });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location) break;
    currentUrl = new URL(location, target).toString();
  }
  if (response?.status && response.status >= 300 && response.status < 400) {
    throw new Error("O link possui redirecionamentos demais.");
  }
  if (!response) throw new Error("Não foi possível abrir o link do vídeo.");
  if (!response.ok || !response.body) {
    throw new Error(
      "Não foi possível acessar esse vídeo. Confirme que o link é público e aponta diretamente para um arquivo.",
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("text/html") || contentType.includes("application/json")) {
    throw new Error(
      "O link devolveu uma página, não um vídeo. No Drive, escolha ‘qualquer pessoa com o link’; em outros serviços, use o link público de download.",
    );
  }
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_MEDIA_BYTES) throw new Error("O vídeo pode ter no máximo 250 MB.");

  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      callback(received > MAX_MEDIA_BYTES ? new Error("O vídeo ultrapassou 250 MB.") : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body as never), limiter, createWriteStream(destination));
  return contentType;
}

async function transcribeChunk(path: string, index: number) {
  const audio = await readFile(path);
  const form = new FormData();
  form.append("file", new File([audio], `parte-${index + 1}.mp3`, { type: "audio/mpeg" }));
  form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  form.append("language", "pt");
  form.append("response_format", "json");
  form.append("prompt", "Transcreva fielmente esta aula em português, preservando termos técnicos, nomes e números.");

  let response: Response;
  try {
    response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getOpenAIKey()}` },
      body: form,
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new OpenAIRequestError(
      timedOut ? "OPENAI_TIMEOUT" : "OPENAI_UNAVAILABLE",
      timedOut ? `A transcrição da parte ${index + 1} excedeu o tempo limite. Tente novamente.` : `Não foi possível enviar a parte ${index + 1} para transcrição.`,
      503,
      true,
      error instanceof Error ? error.message : String(error),
    );
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const responseText = await response.text();
  let payload: unknown = null;
  if (contentType.includes("application/json") && responseText.trim()) {
    try { payload = parseJsonSafely(responseText); } catch { payload = null; }
  }
  if (!response.ok) {
    const technical = getNestedMessage(payload) || responseText.slice(0, 400) || `HTTP ${response.status}`;
    if (response.status === 429) throw new OpenAIRequestError("OPENAI_RATE_LIMIT", "O limite de transcrição foi atingido. Aguarde e tente novamente.", 429, true, technical);
    if (response.status === 401 || response.status === 403) throw new OpenAIRequestError("OPENAI_AUTH_FAILED", "A configuração da IA precisa ser revisada.", response.status, false, technical);
    throw new OpenAIRequestError("OPENAI_UNAVAILABLE", `Não foi possível transcrever a parte ${index + 1}.`, response.status, response.status >= 500, technical);
  }
  if (!isRecord(payload) || typeof payload.text !== "string" || !payload.text.trim()) {
    throw new OpenAIRequestError("MALFORMED_AI_RESPONSE", "A IA devolveu uma transcrição inválida. Tente novamente.", 502, true, responseText.slice(0, 400));
  }
  return payload.text.trim();
}

export async function POST(request: Request) {
  const workingDirectory = await mkdtemp(join(tmpdir(), "nexo-transcribe-"));
  let temporaryBlobUrl = "";

  try {
    const contentType = request.headers.get("content-type") || "";
    let sourceUrl = "";
    let fileName = "aula.mp4";
    let mimeType = "video/mp4";
    let upload: File | null = null;

    if (contentType.includes("application/json")) {
      let body: Record<string, unknown>;
      try {
        const parsed: unknown = await request.json();
        if (!isRecord(parsed)) throw new Error("invalid body");
        body = parsed;
      } catch {
        return NextResponse.json(failure("INVALID_REQUEST", "A solicitação enviada é inválida."), { status: 400 });
      }
      sourceUrl = String(body.mediaUrl || body.sourceUrl || "");
      fileName = String(body.fileName || "aula.mp4");
      mimeType = String(body.mimeType || "video/mp4");
      if (typeof body.mediaUrl === "string" && body.mediaUrl.includes(".blob.vercel-storage.com")) temporaryBlobUrl = body.mediaUrl;
    } else {
      const incoming = await request.formData();
      sourceUrl = String(incoming.get("sourceUrl") || incoming.get("driveUrl") || "");
      const uploaded = incoming.get("file");
      upload = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
      if (upload) {
        fileName = upload.name;
        mimeType = upload.type;
      }
    }

    if (!upload && !sourceUrl) {
      return NextResponse.json(failure("INVALID_REQUEST", "Envie um vídeo/áudio ou cole um link público direto."), { status: 400 });
    }
    if (upload && upload.size > DIRECT_UPLOAD_BYTES) {
      return NextResponse.json(failure("INVALID_REQUEST", "Para arquivos acima de 4 MB, use o upload ampliado com Vercel Blob."), { status: 413 });
    }

    const inputPath = join(workingDirectory, `input${safeExtension(fileName, mimeType)}`);
    if (upload) {
      await writeFile(inputPath, Buffer.from(await upload.arrayBuffer()));
    } else {
      mimeType = await downloadToFile(sourceUrl, inputPath) || mimeType;
    }

    if (!ffmpegPath) throw new Error("O conversor de áudio não está disponível nesta implantação.");
    const outputPattern = join(workingDirectory, "parte-%03d.mp3");
    try {
      await run(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-i", inputPath,
        "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k",
        "-f", "segment", "-segment_time", "600", "-reset_timestamps", "1", outputPattern,
      ], { maxBuffer: 4 * 1024 * 1024 });
    } catch {
      throw new Error(
        "Não encontrei uma faixa de áudio válida. Tente outro arquivo ou exporte o vídeo novamente como MP4 (H.264/AAC).",
      );
    }

    const chunks = (await readdir(workingDirectory))
      .filter((name) => name.startsWith("parte-") && name.endsWith(".mp3"))
      .sort();
    if (!chunks.length) throw new Error("O vídeo não produziu áudio para transcrição.");

    const transcriptParts: string[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      transcriptParts.push(await transcribeChunk(join(workingDirectory, chunks[index]), index));
    }

    return NextResponse.json(success({
      transcript: transcriptParts.filter(Boolean).join("\n\n"),
      fileName,
      parts: chunks.length,
      normalizedAudio: true,
    }));
  } catch (error) {
    console.error("POST /api/transcribe", error instanceof OpenAIRequestError ? error.technicalMessage : error);
    if (error instanceof OpenAIRequestError) return NextResponse.json(failure(error.code, error.message, error.retryable), { status: error.status });
    const message = error instanceof Error ? error.message : "Erro inesperado na transcrição.";
    return NextResponse.json(failure("UNKNOWN_ERROR", message, true), { status: 500 });
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
    if (temporaryBlobUrl) {
      try {
        await del(temporaryBlobUrl);
      } catch {
        // A transcrição não deve falhar caso a limpeza do arquivo temporário falhe.
      }
    }
  }
}
