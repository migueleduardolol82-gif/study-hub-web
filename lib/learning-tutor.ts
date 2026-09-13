import { isRecord } from "./safe-json.ts";

export type TutorAnswer = { fromMaterial: string; complement: string; caveat: string; suggestedQuestion: string };
export const tutorAnswerSchema = {
  type: "object", additionalProperties: false,
  required: ["fromMaterial", "complement", "caveat", "suggestedQuestion"],
  properties: { fromMaterial: { type: "string" }, complement: { type: "string" }, caveat: { type: "string" }, suggestedQuestion: { type: "string" } },
};
export function validateTutorAnswer(value: unknown): TutorAnswer {
  if (!isRecord(value)) throw new Error("Resposta do tutor inválida.");
  const read = (key: keyof TutorAnswer, limit: number) => {
    const content = value[key];
    if (typeof content !== "string" || content.length > limit) throw new Error("Resposta do tutor inválida.");
    return content.trim();
  };
  const answer = { fromMaterial: read("fromMaterial", 5000), complement: read("complement", 5000), caveat: read("caveat", 1200), suggestedQuestion: read("suggestedQuestion", 1200) };
  if (!answer.fromMaterial && !answer.complement) throw new Error("O tutor não devolveu uma explicação.");
  return answer;
}
