import assert from "node:assert/strict";
import test from "node:test";
import { ApiClientError, readApiResponse } from "../lib/api-contract.ts";
import { createStructuredResponse, OpenAIRequestError } from "../lib/openai.ts";

test("cliente aceita envelope JSON de sucesso", async () => {
  const response = new Response(JSON.stringify({ success: true, data: { value: 42 } }), { headers: { "Content-Type": "application/json" } });
  assert.deepEqual(await readApiResponse<{ value: number }>(response), { value: 42 });
});

test("cliente não tenta interpretar página ou texto de erro como JSON", async () => {
  const response = new Response("An error occurred", { status: 500, headers: { "Content-Type": "text/plain" } });
  await assert.rejects(() => readApiResponse(response), (error) => error instanceof ApiClientError && error.code === "INVALID_SERVER_RESPONSE" && error.retryable);
});

test("cliente lê erro padronizado sem expor detalhes técnicos", async () => {
  const response = new Response(JSON.stringify({ success: false, error: { code: "OPENAI_RATE_LIMIT", message: "Limite atingido.", retryable: true } }), { status: 429, headers: { "Content-Type": "application/json" } });
  await assert.rejects(() => readApiResponse(response), (error) => error instanceof ApiClientError && error.code === "OPENAI_RATE_LIMIT" && error.message === "Limite atingido.");
});

test("camada OpenAI classifica texto de erro sem lançar SyntaxError", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key-not-real";
  globalThis.fetch = async () => new Response("An error occurred", { status: 502, headers: { "Content-Type": "text/plain" } });
  try {
    await assert.rejects(
      () => createStructuredResponse({ instructions: "test", input: "test", validate: (value) => value }),
      (error) => error instanceof OpenAIRequestError && error.code === "OPENAI_UNAVAILABLE" && error.technicalMessage === "An error occurred",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("camada OpenAI extrai JSON cercado por Markdown", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key-not-real";
  globalThis.fetch = async () => new Response(JSON.stringify({ output_text: "Aqui está:\n```json\n{\"ok\":true}\n```" }), { headers: { "Content-Type": "application/json" } });
  try {
    const result = await createStructuredResponse({ instructions: "test", input: "test", validate(value) { return value as { ok: boolean }; } });
    assert.deepEqual(result, { ok: true });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
