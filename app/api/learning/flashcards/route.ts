import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { createStructuredResponse } from "@/lib/openai";
import { savedReviewGeneration } from "@/lib/review-generation-store";
import { cardFactSchema, detailedCardSchema, validateCardFacts, validateDetailedCards, type CardFact } from "@/lib/flashcard-production";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  return aiRoute(request, "/api/learning/flashcards", async body => {
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 3000) throw new InvalidAIRequest("Trecho do material inválido.");
    const text = body.text;
    const recovery = Number(body.recoveryAttempt) > 0 ? "A tentativa anterior falhou na validação. Responda somente no esquema JSON solicitado; confira cada campo e use uma citação literal do trecho para cada conceito. Seja conciso." : "";
    if (body.stage === "inventory" || body.stage === "audit") return savedReviewGeneration("detailed-facts-v3", body, onUsage => createStructuredResponse({
      schema: cardFactSchema, schemaName: "detailed_facts", validate: value => {
        if (!value || typeof value !== "object" || !Array.isArray((value as { facts?: unknown }).facts)) throw new Error("Inventário de conceitos inválido.");
        const known = new Set(body.stage === "audit" && Array.isArray(body.existingObjectives)
          ? body.existingObjectives.filter((item): item is string => typeof item === "string").map(item => item.toLocaleLowerCase("pt-BR").trim()) : []);
        const fresh = (value as { facts: unknown[] }).facts.filter(item => {
          if (!item || typeof item !== "object" || typeof (item as { objective?: unknown }).objective !== "string") return true;
          return !known.has((item as { objective: string }).objective.toLocaleLowerCase("pt-BR").trim());
        });
        const facts = validateCardFacts({ facts: fresh }, text);
        return { facts };
      }, onUsage, signal: request.signal, timeoutMs: 105000, maxOutputTokens: 14000,
      instructions: `Você transforma material em objetivos de aprendizagem em português. Leia o sentido do trecho, não sua diagramação. Extraia conceitos úteis: definições, regras, condições, exceções, etapas, números relevantes, fórmulas, comparações e relações causais. Não crie objetivos sobre espaçamento, travessão, quebras de linha, fonte, paginação, caracteres, posição de palavras ou outros artefatos de PDF/OCR. Um objetivo precisa testar compreensão do assunto, não a aparência da página. Para cada objetivo atômico forneça category, topic, objective e quote curta e literalmente presente no trecho. Não invente informação externa. Reutilize categorias existentes quando adequadas. Retorne [] quando o trecho trouxer apenas ruído, índice ou formatação. ${recovery}`,
      input: JSON.stringify({ texto: text, referencia: body.reference, categoriasExistentes: body.categories, tarefa: body.stage === "audit" ? "Audite o trecho contra os objetivos já identificados. Retorne SOMENTE fatos ensináveis omitidos; [] quando não houver lacunas. Não reformule fatos já cobertos." : "Inventário inicial", objetivosJaIdentificados: body.stage === "audit" ? body.existingObjectives : undefined }),
    }));
    if (body.stage !== "cards" || !Array.isArray(body.facts) || !body.facts.length || body.facts.length > 10) throw new InvalidAIRequest("Lote de conceitos inválido.");
    // Validate untrusted requests using the same grounding contract as generated inventories.
    const validated = validateCardFacts({ facts: body.facts }, text);
    const facts: CardFact[] = validated.map((fact, index) => {
      const id = body.facts instanceof Array ? body.facts[index]?.id : undefined;
      if (typeof id !== "string" || !id || id.length > 100) throw new InvalidAIRequest("Identificador de conceito inválido.");
      return { ...fact, id };
    });
    if (new Set(facts.map(fact => fact.id)).size !== facts.length) throw new InvalidAIRequest("Conceitos repetidos.");
    return savedReviewGeneration("detailed-cards-v2", body, onUsage => createStructuredResponse({
      schema: detailedCardSchema, schemaName: "detailed_cards", validate: value => ({ cards: validateDetailedCards(value, facts) }), onUsage, signal: request.signal, timeoutMs: 105000, maxOutputTokens: 12000,
      instructions: `Crie exatamente um flashcard para CADA factId, em português. Leia e compreenda o conceito sustentado pelo trecho. Pergunte sobre o significado, a regra, a aplicação ou a relação causal; nunca sobre o espaçamento do travessão, posição de palavras, pontuação visual, layout ou características do PDF. A pergunta deve nomear o assunto e fazer sentido fora da ordem do documento. A resposta deve ensinar o conceito com clareza; a explicação deve conectar a evidência à resposta. Preserve números, condições e exceções quando forem parte do conteúdo. essentialCriteria contém apenas os pontos indispensáveis para a resposta. Não acrescente afirmações sem apoio no trecho. Devolva todos os factIds exatamente uma vez e não repita perguntas. ${recovery}`,
      input: JSON.stringify({ texto: text, conceitos: facts, referencia: body.reference }),
    }));
  });
}
