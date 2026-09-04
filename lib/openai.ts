export const OPENAI_API_URL = "https://api.openai.com/v1";

import { getNestedMessage, isRecord, parseJsonSafely, SafeJsonError } from "./safe-json.ts";

export type OpenAIErrorCode =
  | "OPENAI_KEY_MISSING"
  | "OPENAI_AUTH_FAILED"
  | "OPENAI_RATE_LIMIT"
  | "OPENAI_TIMEOUT"
  | "OPENAI_UNAVAILABLE"
  | "EMPTY_AI_RESPONSE"
  | "MALFORMED_AI_RESPONSE";

export class OpenAIRequestError extends Error {
  readonly code: OpenAIErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly technicalMessage: string;

  constructor(code: OpenAIErrorCode, message: string, status: number, retryable: boolean, technicalMessage = message) {
    super(message);
    this.name = "OpenAIRequestError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.technicalMessage = technicalMessage;
  }
}

export function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new OpenAIRequestError(
      "OPENAI_KEY_MISSING",
      "A inteligência artificial ainda não foi configurada.",
      503,
      false,
      "OPENAI_API_KEY não está definida no ambiente do servidor.",
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
  timeoutMs = 55_000,
}: {
  instructions: string;
  input: string;
  schema?: Record<string, unknown>;
  schemaName?: string;
  timeoutMs?: number;
}) {
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
  const body: Record<string, unknown> = {
    model,
    instructions,
    input,
  };

  // Os modelos GPT-5 raciocinam antes de responder. Esforço baixo mantém a
  // geração estruturada profunda, mas evita gastar boa parte da janela da
  // função em raciocínio invisível.
  if (/^gpt-5(?:[.-]|$)/i.test(model)) {
    body.reasoning = { effort: "low" };
  }

  if (schema) {
    body.text = {
      format: { type: "json_schema", name: schemaName, strict: true, schema },
    };
  }

  let response: Response;
  let rawBody: string;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${OPENAI_API_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAIKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // Inclui a leitura do corpo no mesmo timeout. Alguns provedores enviam os
    // cabeçalhos antes de concluir a geração; limitar apenas fetch() deixaria a
    // leitura pendurada fora da janela controlada.
    rawBody = await response.text();
  } catch (error) {
    if (error instanceof OpenAIRequestError) throw error;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new OpenAIRequestError(
      timedOut ? "OPENAI_TIMEOUT" : "OPENAI_UNAVAILABLE",
      timedOut ? "A IA demorou mais que o esperado. Tente novamente." : "A IA está temporariamente indisponível.",
      503,
      true,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  let payload: unknown = null;
  if (contentType.includes("application/json") && rawBody.trim()) {
    try {
      payload = parseJsonSafely(rawBody);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const technical = getNestedMessage(payload) || rawBody.slice(0, 500) || `HTTP ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      throw new OpenAIRequestError("OPENAI_AUTH_FAILED", "A configuração da IA precisa ser revisada.", response.status, false, technical);
    }
    if (response.status === 429) {
      throw new OpenAIRequestError("OPENAI_RATE_LIMIT", "O limite de uso da IA foi atingido. Aguarde e tente novamente.", 429, true, technical);
    }
    throw new OpenAIRequestError("OPENAI_UNAVAILABLE", "A IA não conseguiu processar esta solicitação agora.", response.status, response.status >= 500, technical);
  }
  if (!contentType.includes("application/json") || !isRecord(payload)) {
    throw new OpenAIRequestError("MALFORMED_AI_RESPONSE", "A IA devolveu uma resposta inválida. Tente novamente.", 502, true, rawBody.slice(0, 500));
  }

  const output = extractOutputText(payload);
  if (!output.trim()) {
    throw new OpenAIRequestError("EMPTY_AI_RESPONSE", "A IA devolveu uma resposta vazia. Tente novamente.", 502, true);
  }
  return output;
}

export async function createStructuredResponse<T>({
  validate,
  ...options
}: Parameters<typeof createTextResponse>[0] & { validate: (value: unknown) => T }) {
  const output = await createTextResponse(options);
  try {
    return validate(parseJsonSafely(output));
  } catch (error) {
    if (error instanceof OpenAIRequestError) throw error;
    const technical = error instanceof Error ? error.message : String(error);
    throw new OpenAIRequestError(
      error instanceof SafeJsonError && error.code === "EMPTY_RESPONSE" ? "EMPTY_AI_RESPONSE" : "MALFORMED_AI_RESPONSE",
      "A IA devolveu conteúdo em formato inválido. Tente novamente.",
      502,
      true,
      technical,
    );
  }
}
