import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { documentAnalysisSchema, validateDocumentAnalysis } from "@/lib/document-analysis";
import { inputText, specialistInstructions } from "@/lib/ai-pedagogy";
import { createStructuredResponse } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  return aiRoute(request, "/api/documents/analyze", async (body) => {
    const documentName = inputText(body.documentName, 300);
    const locator = inputText(body.locator, 200);
    const content = inputText(body.content, 30000);
    if (!documentName || !locator || !content) throw new InvalidAIRequest("Documento, localização e conteúdo são obrigatórios.");
    return createStructuredResponse({
      schema: documentAnalysisSchema, schemaName: "document_section_analysis", validate: validateDocumentAnalysis,
      timeoutMs: 105000, maxOutputTokens: 6000, signal: request.signal,
      instructions: `${specialistInstructions} Analise integralmente o trecho fornecido como fonte primária. Extraia apenas o que está presente. Preserve termos técnicos, fórmulas, exceções, exemplos e relações. Em warnings, registre contradições internas, limitações, texto ilegível ou informação que exija confirmação; não complete lacunas com conhecimento externo. Toda referência deve repetir exatamente o nome do documento e a localização recebida. Seja compacto, mas não omita conceitos examináveis.`,
      input: JSON.stringify({ documento: documentName, localizacao: locator, conteudoIntegralDoTrecho: content }),
    });
  });
}
