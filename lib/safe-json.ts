export class SafeJsonError extends Error {
  readonly code: "EMPTY_RESPONSE" | "INVALID_JSON";

  constructor(code: SafeJsonError["code"], message: string) {
    super(message);
    this.name = "SafeJsonError";
    this.code = code;
  }
}

function extractBalancedJson(text: string) {
  const start = [...text].findIndex((character) => character === "{" || character === "[");
  if (start < 0) return "";

  const opening = text[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let escaped = false;
  let quoted = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return "";
}

export function parseJsonSafely(text: string): unknown {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    throw new SafeJsonError("EMPTY_RESPONSE", "A resposta recebida está vazia.");
  }

  const candidates = [normalized];
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  const balanced = extractBalancedJson(fenced || normalized);
  if (balanced) candidates.push(balanced);

  for (const candidate of [...new Set(candidates)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // A próxima forma segura será tentada.
    }
  }

  throw new SafeJsonError("INVALID_JSON", "A resposta recebida não contém JSON válido.");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getNestedMessage(value: unknown) {
  if (!isRecord(value)) return "";
  if (typeof value.message === "string") return value.message;
  if (typeof value.error === "string") return value.error;
  if (isRecord(value.error) && typeof value.error.message === "string") return value.error.message;
  return "";
}
