import test from "node:test";
import assert from "node:assert/strict";
import { studyMaterial } from "../lib/study-context.ts";
import type { LearningPath } from "../lib/learning.ts";

const path = (id: string, texts: string[]): LearningPath => ({
  id, title: id, createdAt: "now", updatedAt: "now", units: [],
  cardProduction: { version: 1, status: "complete", sources: texts.map((text, index) => ({ id: String(index), reference: `${id} · p.${index + 1}`, text, completedFactIds: [] })) },
});

test("chat consulta só o material da trilha escolhida e prioriza o trecho pertinente", () => {
  const botany = path("botânica", ["As raízes absorvem água.", "A fotossíntese usa luz para produzir açúcares."]);
  const finance = path("finanças", ["Juros simples incidem apenas sobre o capital inicial."]);
  const answer = studyMaterial(botany, "Como funciona a fotossíntese?");
  assert.match(answer.material, /fotossíntese/);
  assert.equal(answer.references[0], "botânica · p.2");
  assert.doesNotMatch(answer.material, /Juros simples/);
  assert.doesNotMatch(studyMaterial(finance, "fotossíntese").material, /fotossíntese/);
});

test("material extenso pode recuperar um trecho do fim sem exceder o limite", () => {
  const content = `${"Texto sem relação. ".repeat(2000)}A mitose tem fases específicas.`;
  const result = studyMaterial({ id: "p", title: "p", createdAt: "now", updatedAt: "now", units: [], source: { theme: "p", goal: "p", topics: [], difficulty: "iniciante", content } }, "Quais são as fases da mitose?");
  assert.match(result.material, /mitose/);
  assert.ok(result.material.length <= 24000);
});
