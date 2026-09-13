import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { createStructuredResponse } from "@/lib/openai";
import { semanticGradeSchema, semanticGradingInstructions, validateSemanticGrade } from "@/lib/semantic-grading";
import { savedReviewGeneration } from "@/lib/review-generation-store";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return aiRoute(request, "/api/learning/grade", async body => {
    for (const key of ["question", "answer", "referenceAnswer"]) {
      if (typeof body[key] !== "string" || !body[key].trim() || body[key].length > 6000) throw new InvalidAIRequest("Envie a pergunta, a resposta e a referência completas, com até 6.000 caracteres cada.");
    }
    if (body.context !== undefined && (typeof body.context !== "string" || body.context.length > 20000)) throw new InvalidAIRequest("Contexto da questão inválido.");
    if (body.criteria !== undefined && (!Array.isArray(body.criteria) || body.criteria.length > 20 || body.criteria.some(p => typeof p !== "string" || !p.trim() || p.length > 1000))) throw new InvalidAIRequest("Critérios da questão inválidos.");
    return savedReviewGeneration("semantic-grade", body, onUsage => createStructuredResponse({
      schema: semanticGradeSchema, schemaName: "semantic_binary_grade", validate: validateSemanticGrade,
      instructions: semanticGradingInstructions,
      input: JSON.stringify({ question: body.question, studentAnswer: body.answer, essentialCriteria: body.criteria || [], context: body.context || "", referenceAnswer: body.referenceAnswer }),
      timeoutMs: 45000, maxOutputTokens: 1800, signal: request.signal, onUsage,
    }));
  });
}
