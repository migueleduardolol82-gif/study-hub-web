import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Origem de upload não autorizada." }, { status: 403 });
    }
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("nexo-media/")) throw new Error("Caminho de upload inválido.");
        return {
          allowedContentTypes: ["audio/*", "video/*"],
          maximumSizeInBytes: 250 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível preparar o upload.";
    const notConfigured = message.toLowerCase().includes("token");
    console.error("POST /api/media/upload", error);
    return NextResponse.json(
      {
        error: notConfigured
          ? "O armazenamento de vídeos ainda não está ativado. Crie um Vercel Blob no projeto; a variável BLOB_READ_WRITE_TOKEN será adicionada automaticamente."
          : "Não foi possível preparar o upload. Verifique o arquivo e tente novamente.",
      },
      { status: notConfigured ? 503 : 400 },
    );
  }
}
