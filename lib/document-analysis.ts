import { isRecord } from "./safe-json.ts";

const text = { type: "string" };
export const documentAnalysisSchema = {
  type: "object", additionalProperties: false,
  required: ["summary", "topics", "definitions", "formulas", "examples", "warnings", "references"],
  properties: {
    summary: text,
    topics: { type: "array", items: text, maxItems: 12 },
    definitions: { type: "array", items: text, maxItems: 12 },
    formulas: { type: "array", items: text, maxItems: 10 },
    examples: { type: "array", items: text, maxItems: 8 },
    warnings: { type: "array", items: text, maxItems: 8 },
    references: { type: "array", items: text, maxItems: 8 },
  },
} as const;

export type DocumentAnalysis = { summary: string; topics: string[]; definitions: string[]; formulas: string[]; examples: string[]; warnings: string[]; references: string[] };

export function validateDocumentAnalysis(value: unknown): DocumentAnalysis {
  if (!isRecord(value) || typeof value.summary !== "string" || !value.summary.trim()) throw new Error("Análise documental inválida.");
  const list = (name: keyof Omit<DocumentAnalysis, "summary">, max: number) => {
    const current = value[name];
    if (!Array.isArray(current) || current.length > max || current.some((item) => typeof item !== "string")) throw new Error(`Campo documental inválido: ${name}`);
    return current.map((item) => String(item).trim()).filter(Boolean);
  };
  return { summary: value.summary.trim(), topics: list("topics", 12), definitions: list("definitions", 12), formulas: list("formulas", 10), examples: list("examples", 8), warnings: list("warnings", 8), references: list("references", 8) };
}

export function analysisAsSource(name: string, locator: string, analysis: DocumentAnalysis) {
  return [`FONTE: ${name} — ${locator}`, `SÍNTESE: ${analysis.summary}`, `TÓPICOS: ${analysis.topics.join("; ")}`, `DEFINIÇÕES: ${analysis.definitions.join("; ")}`, `FÓRMULAS: ${analysis.formulas.join("; ")}`, `EXEMPLOS: ${analysis.examples.join("; ")}`, `ALERTAS/CONTRADIÇÕES: ${analysis.warnings.join("; ")}`].join("\n");
}
