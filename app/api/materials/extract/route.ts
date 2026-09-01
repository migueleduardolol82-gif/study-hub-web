import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione uma apostila em PDF." }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "A apostila precisa ter até 15 MB." }, { status: 413 });
    }

    const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
    const data = await parser.getText();
    await parser.destroy();
    const text = data.text.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Não encontrei texto no PDF. O arquivo pode ser uma digitalização sem OCR." },
        { status: 422 },
      );
    }
    return NextResponse.json({ text, pages: data.total, fileName: file.name });
  } catch {
    return NextResponse.json({ error: "Não foi possível ler esta apostila." }, { status: 500 });
  }
}
