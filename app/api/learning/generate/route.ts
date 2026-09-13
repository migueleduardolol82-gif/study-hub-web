import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { inputText, inputTopics, relevantMaterial, specialistInstructions } from "@/lib/ai-pedagogy";
import { lessonContentSchema, outlineSchema, questionBatchSchema, validateQuestionBatch, validateLessonContent, validateOutline } from "@/lib/learning-generation";
import { createStructuredResponse } from "@/lib/openai";
import type { ThemeDifficulty } from "@/lib/learning";

import { savedReviewGeneration } from "@/lib/review-generation-store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  return aiRoute(request, "/api/learning/generate", async (body) => {
    const theme = inputText(body.theme, 300);
    if (!theme) throw new InvalidAIRequest("Informe o assunto que deseja aprender.");
    if (body.mode && body.mode !== "outline" && body.mode !== "lesson" && body.mode !== "bank") throw new InvalidAIRequest("Etapa de geração inválida.");
    const goal = inputText(body.goal, 2000) || `Dominar os fundamentos e aplicações de ${theme}.`;
    const difficulty = (["iniciante", "intermediario", "avancado"].includes(String(body.difficulty)) ? body.difficulty : "iniciante") as ThemeDifficulty;
    const topics = inputTopics(body.topics);
    const content = inputText(body.content, 100000);
    const requestedUnits = Math.max(0, Math.min(20, Number(body.requestedUnits) || 0));
    const depth = inputText(body.depth, 40) || "equilibrado";
    if (body.mode === "lesson" || body.mode === "bank") {
      const title = inputText(body.lessonTitle, 200);
      if (!title) throw new InvalidAIRequest("Selecione a lição que deseja preparar.");
      if (body.mode === "bank") return savedReviewGeneration("question-batch", body, onUsage => createStructuredResponse({
        schema: questionBatchSchema, schemaName: "question_batch", validate: validateQuestionBatch,
        timeoutMs: 105000, maxOutputTokens: 12000, signal: request.signal, onUsage,
        instructions: `${specialistInstructions} Amplie o banco com 6 a 10 questões inéditas por lote. Nunca repita enunciados existentes. Cubra conceitos ainda pouco representados. Inclua essentialCriteria indispensáveis, concept estável dentre os conceitos fornecidos quando possível, difficulty verdadeira, teaching como uma miniaula clara em 2 a 4 parágrafos curtos e example didático. Preencha teachingHighlights com 2 a 6 ideias essenciais, memoryTip com uma analogia ou regra de memória fiel à fonte e comparisonRows com comparações realmente úteis (ou [] quando não ajudarem). Critérios devem ser necessários à pergunta, não detalhes opcionais da referência. Varie definição, aplicação, comparação, interpretação, exceções, cálculo e cenário conforme o assunto. No pedido hard, todas as questões devem ser avançadas: casos que relacionem conceitos, raciocínio, alternativas próximas e pegadinhas plausíveis; nunca dificuldade meramente cosmética. Não invente conteúdo ausente das fontes. Use multiple_choice com 4 alternativas, true_false com Verdadeiro/Falso, ordering com answer separado por | e matching com options=[] e 3 a 5 pares termo=>definição separados por |. Em alternativas simples answer deve corresponder exatamente à opção correta, com optionExplanations na mesma ordem. Sem opções use []. Sempre indique sourceReference. Não crie error_review.`,
        input: JSON.stringify({ tema: theme, licao: title, tipoDeLote: body.batchKind === "hard" ? "hard" : "variado, incluindo algumas questões avançadas", conceitos: inputTopics(body.concepts), questoesExistentes: inputTopics(body.existingPrompts), material: inputText(body.studyNotes, 20000) || relevantMaterial(content, title, 30000), referencias: inputTopics(body.lessonReferences) }),
      }));
      return savedReviewGeneration("lesson-content", body, onUsage => createStructuredResponse({
        onUsage, schema: lessonContentSchema, schemaName: "learning_lesson", validate: validateLessonContent,
        timeoutMs: 105000, maxOutputTokens: 10000, signal: request.signal,
        instructions: `${specialistInstructions} Prepare SOMENTE a lição indicada. Escreva studyNotes aprofundado com teoria, definições, fórmulas e resolução passo a passo quando existirem. Preencha resumo, conceitos, exemplos, erros comuns e referências. Gere 4 a 10 exercícios focados e variados para um banco reutilizável por todos os modos. Inclua pelo menos duas questões avançadas de aplicação/caso e duas objetivas rápidas. Cada questão deve ter essentialCriteria (somente pontos indispensáveis pedidos), concept com nome estável, difficulty real, teaching como miniaula em 2 a 4 parágrafos curtos, example ilustrativo, teachingHighlights com 2 a 6 pontos essenciais, memoryTip com analogia ou regra de memória fiel e comparisonRows com até 6 comparações úteis ou [] quando não forem necessárias. A explicação deve ensinar antes de cobrar, destacar diferenças importantes e permanecer legível no celular. Não exija palavras literais na resposta aberta. Não expanda para outras lições. Em multiple_choice forneça 4 alternativas plausíveis e apenas uma correta. Em true_false use [Verdadeiro,Falso]. Para cada alternativa inclua optionExplanations na mesma ordem explicando por que está certa ou errada; quando não houver opções use []. sourceReference deve apontar documento e página/slide/seção ou declarar 'Complementação externa'. Se houver alternativas, answer deve ser exatamente uma delas, exceto ordering: opções embaralhadas e answer com todos os passos separados por |. Em matching: options vazio e answer com 3 a 5 pares únicos no formato termo=>definição|termo=>definição. Em typed, cálculo e fill_blank: resposta objetiva. Em flashcard: options vazio. Não use error_review sem erros reais fornecidos. No modo hard use casos complexos e alternativas próximas; no speed use enunciados curtos; no memorizar priorize flashcards e recuperação ativa; no estudar priorize explicação antes da prática; no desafio misture a unidade.`,
        input: JSON.stringify({ tema: theme, objetivo: goal, nivel: difficulty, modo: inputText(body.learningMode, 40), unidade: inputText(body.unitTitle, 200), licao: title, habilidade: inputText(body.lessonDescription, 2000), referenciasDaLicao: inputTopics(body.lessonReferences), preRequisitos: inputTopics(body.previousLessons), topicos: topics, material: relevantMaterial(content, `${theme} ${title}`, 50000) }),
      }));
    }
    return savedReviewGeneration("track-outline", body, async onUsage => {
    const path = await createStructuredResponse({
      onUsage, schema: outlineSchema, schemaName: "learning_outline", validate: validateOutline,
      timeoutMs: 105000, maxOutputTokens: 12000, signal: request.signal,
      instructions: `${specialistInstructions} Crie somente o planejamento detalhado da trilha, com 2 a 20 unidades e 1 a 8 lições por unidade. Use a quantidade solicitada quando informada; no automático, estime pela densidade, capítulos e variedade do material, sem reduzir documentos extensos a poucas unidades genéricas. Cada unidade deve ter objetivo verificável, conteúdos, conceitos e referências exatas. Comece no nível informado e avance gradualmente, incluindo revisões e desafio final. Una repetições entre documentos, preserve complementos e sinalize contradições na descrição. Não gere exercícios nem aulas completas nesta etapa. Não crie conteúdo ausente das fontes; qualquer complementação externa deve estar claramente identificada.`,
      input: JSON.stringify({ tema: theme, objetivo: goal, nivelInicial: difficulty, profundidade: depth, quantidadeAproximadaDeUnidades: requestedUnits || "automática pela densidade", topicos: topics, materialAnalisadoIntegralmenteEmEtapas: content }),
    });
    return { ...path, source: { theme, goal, topics, content, difficulty } };
    });
  });
}
