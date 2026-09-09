import { ApiClientError, readApiResponse } from "./api-contract.ts";

export async function requestAI<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 125000);
  try {
    return await readApiResponse<T>(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal }));
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (controller.signal.aborted) throw new ApiClientError("Esta etapa demorou mais que o esperado. O conteúdo já salvo foi mantido; tente esta etapa novamente.", "OPENAI_TIMEOUT", 504, true);
    if (signal?.aborted) throw new ApiClientError("Geração interrompida. O conteúdo já salvo foi mantido.", "GENERATION_CANCELLED", 499, true);
    throw new ApiClientError("Não foi possível conectar à IA. Confira sua conexão e tente novamente.", "NETWORK_ERROR", 503, true);
  } finally { clearTimeout(timeout); }
}
