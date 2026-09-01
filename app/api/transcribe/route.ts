import { NextResponse } from "next/server";
import { getOpenAIKey, OPENAI_API_URL } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

function driveIdFromUrl(url: string) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  return patterns.map((pattern) => url.match(pattern)?.[1]).find(Boolean);
}

async function fileFromDrive(url: string) {
  const id = driveIdFromUrl(url);
  if (!id) throw new Error("Cole um link válido de um arquivo do Google Drive.");

  const response = await fetch(
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
  );
  if (!response.ok) {
    throw new Error(
      "Não foi possível acessar o vídeo. No Google Drive, libere o arquivo como ‘qualquer pessoa com o link’.",
    );
  }
  const blob = await response.blob();
  return new File([blob], `aula-${id}.mp4`, { type: blob.type || "video/mp4" });
}

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const driveUrl = String(incoming.get("driveUrl") || "");
    const uploaded = incoming.get("file");
    const file =
      uploaded instanceof File && uploaded.size > 0
        ? uploaded
        : driveUrl
          ? await fileFromDrive(driveUrl)
          : null;

    if (!file) {
      return NextResponse.json(
        { error: "Envie um arquivo ou cole o link do vídeo no Google Drive." },
        { status: 400 },
      );
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "O arquivo precisa ter até 25 MB. Comprima o vídeo ou envie apenas o áudio." },
        { status: 413 },
      );
    }

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
    form.append("language", "pt");
    form.append("response_format", "json");

    const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getOpenAIKey()}` },
      body: form,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || "Não foi possível transcrever o vídeo.");
    }
    return NextResponse.json({ transcript: payload.text, fileName: file.name });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro inesperado na transcrição." },
      { status: 500 },
    );
  }
}
