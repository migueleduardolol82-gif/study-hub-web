import { auth } from "@clerk/nextjs/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { failure } from "@/lib/api-contract";
import { isCloudConfigured } from "@/lib/auth-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) return NextResponse.json(failure("ORIGIN_NOT_ALLOWED", "Origem não autorizada."), { status: 403 });
    if (!isCloudConfigured()) return NextResponse.json(failure("CLOUD_NOT_CONFIGURED", "Entre na conta e configure o armazenamento para sincronizar documentos."), { status: 503 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json(failure("AUTH_REQUIRED", "Faça login para enviar documentos."), { status: 401 });
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({ request, body, onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith("nexo-documents/")) throw new Error("Caminho de documento inválido.");
      return { allowedContentTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain", "image/jpeg", "image/png"], maximumSizeInBytes: 30 * 1024 * 1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ userId }) };
    } });
    return NextResponse.json(response);
  } catch (error) {
    console.error("POST /api/documents/upload", error);
    return NextResponse.json(failure("DOCUMENT_UPLOAD_FAILED", "Não foi possível enviar o documento. A cópia local foi preservada.", true), { status: 400 });
  }
}
