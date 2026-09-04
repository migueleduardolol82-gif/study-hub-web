import { isRecord, parseJsonSafely } from "./safe-json.ts";

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "AUTH_REQUIRED"
  | "OPENAI_KEY_MISSING"
  | "OPENAI_AUTH_FAILED"
  | "OPENAI_RATE_LIMIT"
  | "OPENAI_TIMEOUT"
  | "OPENAI_UNAVAILABLE"
  | "EMPTY_AI_RESPONSE"
  | "MALFORMED_AI_RESPONSE"
  | "ARCHETYPE_GENERATION_FAILED"
  | "CURRICULUM_GENERATION_FAILED"
  | "UNKNOWN_ERROR";

export type ApiFailure = {
  success: false;
  error: {
    code: ApiErrorCode | string;
    message: string;
    retryable?: boolean;
  };
};

export type ApiSuccess<T> = { success: true; data: T };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export function success<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function failure(
  code: ApiFailure["error"]["code"],
  message: string,
  retryable = false,
): ApiFailure {
  return { success: false, error: { code, message, retryable } };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;

  constructor(message: string, code = "UNKNOWN_ERROR", status = 500, retryable = false) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const text = await response.text();
  if (!contentType.includes("application/json")) {
    throw new ApiClientError(
      response.ok ? "O servidor devolveu uma resposta em formato inesperado." : "O serviço encontrou uma falha temporária.",
      "INVALID_SERVER_RESPONSE",
      response.status,
      response.status >= 500,
    );
  }

  let payload: unknown;
  try {
    payload = parseJsonSafely(text);
  } catch {
    throw new ApiClientError(
      "O servidor devolveu uma resposta inválida. Tente novamente.",
      "INVALID_SERVER_RESPONSE",
      response.status,
      response.status >= 500,
    );
  }

  if (!isRecord(payload) || typeof payload.success !== "boolean") {
    throw new ApiClientError(
      "O servidor devolveu uma resposta incompleta. Tente novamente.",
      "INVALID_SERVER_RESPONSE",
      response.status,
      response.status >= 500,
    );
  }

  if (!response.ok || payload.success === false) {
    const error = isRecord(payload.error) ? payload.error : {};
    throw new ApiClientError(
      typeof error.message === "string" ? error.message : "Não foi possível concluir esta ação.",
      typeof error.code === "string" ? error.code : "UNKNOWN_ERROR",
      response.status,
      error.retryable === true,
    );
  }

  if (!("data" in payload)) {
    throw new ApiClientError("A resposta do servidor está incompleta.", "INVALID_SERVER_RESPONSE", response.status);
  }
  return payload.data as T;
}
