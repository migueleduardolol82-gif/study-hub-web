import type { LearningPath } from "./learning.ts";

export type StudyQuestion = { id: string; question: string; answer: string; caveat: string; references: string[]; askedAt: string };

const terms = (text: string) => new Set((text.toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]{4,}/gu) || [])
  .filter(term => !["sobre", "como", "qual", "quais", "para", "mais", "essa", "esse", "com", "uma", "fazer"].includes(term)));

export function studyMaterial(path: LearningPath, question: string, maxLength = 22000) {
  const segments = path.cardProduction?.sources.map(source => ({ reference: source.reference, text: source.text }))
    || (path.source?.content ? Array.from({ length: Math.ceil(path.source.content.length / 2400) }, (_, index) => ({
      reference: `Material da trilha · trecho ${index + 1}`,
      text: path.source!.content.slice(index * 2400, (index + 1) * 2400),
    })) : []);
  const source = segments.length ? segments : path.units.flatMap(unit => unit.lessons.map(lesson => ({
    reference: lesson.references?.join(", ") || `${unit.title} · ${lesson.title} (resumo gerado)`,
    text: [lesson.studyNotes, ...lesson.exercises.map(exercise => `${exercise.prompt}\nResposta: ${exercise.answer}`)].filter(Boolean).join("\n"),
  })));
  const query = terms(question);
  const ranked = source.map((segment, index) => ({ ...segment, index,
    score: [...query].reduce((score, term) => score + (segment.text.toLocaleLowerCase("pt-BR").includes(term) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: typeof ranked = [];
  let remaining = maxLength;
  for (const segment of ranked) {
    if (remaining < 100 || selected.length >= 10) break;
    const text = segment.text.slice(0, Math.min(remaining, 3500));
    if (!text.trim()) continue;
    selected.push({ ...segment, text });
    remaining -= text.length + segment.reference.length + 8;
  }
  return { material: selected.map(segment => `[${segment.reference}]\n${segment.text}`).join("\n\n"), references: selected.map(segment => segment.reference) };
}
