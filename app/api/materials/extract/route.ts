import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Compatibility route for repositories that still contain the former PDF endpoint.
// PDF extraction now runs in the browser so large files do not cross Vercel limits.
export async function POST() {
  return NextResponse.json(
    {
      error: "A leitura do PDF agora acontece diretamente no navegador.",
      extractionMode: "client",
    },
    { status: 410 },
  );
}
