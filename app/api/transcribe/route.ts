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
import { getOpenAIKey, OPENAI_API_URL } from "@/lib/openai";

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

  const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getOpenAIKey()}` },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Não foi possível transcrever a parte ${index + 1}.`);
  }
  return String(payload.text || "").trim();
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
      const body = await request.json() as {
        mediaUrl?: string;
        sourceUrl?: string;
        fileName?: string;
        mimeType?: string;
      };
      sourceUrl = String(body.mediaUrl || body.sourceUrl || "");
      fileName = String(body.fileName || "aula.mp4");
      mimeType = String(body.mimeType || "video/mp4");
      if (body.mediaUrl?.includes(".blob.vercel-storage.com")) temporaryBlobUrl = body.mediaUrl;
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
      return NextResponse.json(
        { error: "Envie um vídeo/áudio ou cole um link público direto." },
        { status: 400 },
      );
    }
    if (upload && upload.size > DIRECT_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Para arquivos acima de 4 MB, use o upload ampliado com Vercel Blob." },
        { status: 413 },
      );
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

    return NextResponse.json({
      transcript: transcriptParts.filter(Boolean).join("\n\n"),
      fileName,
      parts: chunks.length,
      normalizedAudio: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro inesperado na transcrição." },
      { status: 500 },
    );
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
