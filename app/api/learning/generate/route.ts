import { aiRoute, InvalidAIRequest } from "@/lib/ai-route";
import { inputText, inputTopics, relevantMaterial, specialistInstructions } from "@/lib/ai-pedagogy";
import { lessonContentSchema, outlineSchema, validateLessonContent, validateOutline } from "@/lib/learning-generation";
import { createStructuredResponse } from "@/lib/openai";
import type { ThemeDifficulty } from "@/lib/learning";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  return aiRoute(request, "/api/learning/generate", async (body) => {
    const theme = inputText(body.theme, 300);
    if (!theme) throw new InvalidAIRequest("Informe o assunto que deseja aprender.");
    if (body.mode && body.mode !== "outline" && body.mode !== "lesson") throw new InvalidAIRequest("Etapa de geração inválida.");
    const goal = inputText(body.goal, 2000) || `Dominar os fundamentos e aplicações de ${theme}.`;
    const difficulty = (["iniciante", "intermediario", "avancado"].includes(String(body.difficulty)) ? body.difficulty : "iniciante") as ThemeDifficulty;
    const topics = inputTopics(body.topics);
    const content = inputText(body.content, 60000);
    if (body.mode === "lesson") {
      const title = inputText(body.lessonTitle, 200);
      if (!title) throw new InvalidAIRequest("Selecione a lição que deseja preparar.");
      return createStructuredResponse({
        schema: lessonContentSchema, schemaName: "learning_lesson", validate: validateLessonContent,
        timeoutMs: 105000, maxOutputTokens: 6500, signal: request.signal,
        instructions: `${specialistInstructions} Prepare SOMENTE a lição indicada. Escreva studyNotes com uma explicação de 150 a 250 palavras, um exemplo resolvido e os erros comuns. Gere 4 a 6 exercícios focados e variados, com explicações de 2 a 4 frases. Não expanda para outras lições. Escolha tipos adequados à habilidade, sem forçar todos na mesma lição. Inclua aplicação prática e recuperação de pré-requisitos. Em multiple_choice forneça 4 alternativas plausíveis e apenas uma correta. Em true_false use [Verdadeiro,Falso]. Se houver alternativas, answer deve ser exatamente uma delas, exceto ordering: opções embaralhadas e answer com todos os passos separados por |. Em matching: options vazio e answer com 3 a 5 pares únicos no formato termo=>definição|termo=>definição. Em typed e fill_blank: resposta curta e única. Em case_study e mock_exam prefira quatro alternativas com decisão justificada. Em flashcard: options vazio, resposta-modelo e explicação. Não use error_review sem erros reais fornecidos.`,
        input: JSON.stringify({ tema: theme, objetivo: goal, nivel: difficulty, unidade: inputText(body.unitTitle, 200), licao: title, habilidade: inputText(body.lessonDescription, 2000), preRequisitos: inputTopics(body.previousLessons), topicos: topics, material: relevantMaterial(content, `${theme} ${title}`) }),
      });
    }
    const path = await createStructuredResponse({
      schema: outlineSchema, schemaName: "learning_outline", validate: validateOutline,
      timeoutMs: 105000, maxOutputTokens: 4500, signal: request.signal,
      instructions: `${specialistInstructions} Crie somente o planejamento da trilha: 3 a 5 unidades com 2 a 4 lições cada. Descrições de uma frase com habilidade concreta e verificável. Comece no nível informado e avance gradualmente, incluindo revisões e um estudo de caso final. Não gere exercícios, respostas, aulas completas nem XP nesta etapa; esses conteúdos serão preparados por lição. Prefira 3 unidades com 2 lições para objetivos curtos e expanda a abrangência quando o pedido exigir.`,
      input: JSON.stringify({ tema: theme, objetivo: goal, nivelInicial: difficulty, topicos: topics, material: relevantMaterial(content, `${theme} ${goal}`) }),
    });
    return { ...path, source: { theme, goal, topics, content, difficulty } };
  });
}
