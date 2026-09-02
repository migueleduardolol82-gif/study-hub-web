import { NextResponse } from "next/server";
import { archetypeResponseSchema, type GeneratedArchetype } from "@/lib/archetypes";
import { createTextResponse } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function slug(value: string, index: number) {
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `ai-${normalized || `path-${index + 1}`}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const area = safeText(body.area, 80);
    const role = safeText(body.role, 120);
    const goal = safeText(body.goal, 800);
    const context = safeText(body.context, 1200);
    const assessment = body.assessment && typeof body.assessment === "object" ? body.assessment : null;
    if (!area || !goal) return NextResponse.json({ error: "Informe sua área e o resultado que deseja construir." }, { status: 400 });

    const input = JSON.stringify({ area, role, goal, context, assessment });
    const raw = await createTextResponse({
      schema: archetypeResponseSchema as unknown as Record<string, unknown>,
      schemaName: "archetype_paths",
      instructions: `Você é um arquiteto de desenvolvimento humano responsável e orientado a evidências. Crie de 6 a 8 arquétipos profissionais distintos e escolhíveis para a área informada. Eles não são tipos místicos: são modelos de competência, comportamento e produção de resultados.

Use padrões recorrentes observáveis em casos públicos de alto desempenho da área: prática deliberada, produção, feedback, ética, julgamento, colaboração, saúde sustentável e criação de valor. Cite 2 ou 3 casos públicos amplamente documentados por arquétipo apenas como modelos de aprendizagem. Não invente biografias, números ou hábitos privados e não prometa que imitar alguém produz o mesmo resultado. Se não houver segurança sobre um nome específico, use uma organização, equipe ou tradição profissional verificável.

Personalize fitScore e justificativa com os atributos fornecidos, sem tratar renda, personalidade, gênero, país ou origem como mérito. Personalidade serve para adaptar a rota. O horizonte deve ser realista, de 3 a 10 anos. Cada marco deve ser verificável. O protocolo diário deve caber em uma rotina real; o plano semanal deve cobrir exatamente segunda a domingo e combinar o arquétipo principal com saúde e reflexão. Escreva em português do Brasil, com profundidade, clareza e sem linguagem clínica.`,
      input,
    });
    if (!raw) throw new Error("A IA retornou uma resposta vazia.");
    const parsed = JSON.parse(raw) as { summary: string; archetypes: GeneratedArchetype[] };
    const seen = new Set<string>();
    const archetypes = parsed.archetypes.map((archetype, index) => {
      let id = slug(archetype.name, index);
      if (seen.has(id)) id = `${id}-${index + 1}`;
      seen.add(id);
      return { ...archetype, id };
    });
    return NextResponse.json({ summary: parsed.summary, archetypes });
  } catch (error) {
    console.error("POST /api/archetypes/recommend", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar os arquétipos." }, { status: 500 });
  }
}
