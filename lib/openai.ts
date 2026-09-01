export const OPENAI_API_URL = "https://api.openai.com/v1";

export function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "A inteligência artificial ainda não foi configurada. Adicione OPENAI_API_KEY nas variáveis da Vercel.",
    );
  }
  return key;
}

type ResponseContent = { type?: string; text?: string };
type ResponseOutput = { content?: ResponseContent[] };

export function extractOutputText(payload: {
  output_text?: string;
  output?: ResponseOutput[];
}) {
  if (payload.output_text) return payload.output_text;
  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text ?? ""
  );
}

export async function createTextResponse({
  instructions,
  input,
  schema,
  schemaName = "study_response",
}: {
  instructions: string;
  input: string;
  schema?: Record<string, unknown>;
  schemaName?: string;
}) {
  const body: Record<string, unknown> = {
    model: process.env.OPENAI_TEXT_MODEL || "gpt-5-mini",
    instructions,
    input,
  };

  if (schema) {
    body.text = {
      format: { type: "json_schema", name: schemaName, strict: true, schema },
    };
  }

  const response = await fetch(`${OPENAI_API_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "A OpenAI não conseguiu processar esta solicitação.");
  }
  return extractOutputText(payload);
}
