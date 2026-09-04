import assert from "node:assert/strict";
import test from "node:test";
import { parseJsonSafely, SafeJsonError } from "../lib/safe-json.ts";

test("lê JSON puro", () => {
  assert.deepEqual(parseJsonSafely('{"success":true}'), { success: true });
});

test("extrai JSON de bloco Markdown", () => {
  assert.deepEqual(parseJsonSafely('Resposta:\n```json\n{"name":"Sábio"}\n```'), { name: "Sábio" });
});

test("extrai objeto quando a IA adiciona explicação", () => {
  assert.deepEqual(parseJsonSafely('Aqui está o resultado: {"items":[1,2]} Obrigado.'), { items: [1, 2] });
});

test("não interpreta texto de erro como JSON", () => {
  assert.throws(() => parseJsonSafely("An error occurred"), (error) => error instanceof SafeJsonError && error.code === "INVALID_JSON");
});

test("identifica resposta vazia", () => {
  assert.throws(() => parseJsonSafely("  "), (error) => error instanceof SafeJsonError && error.code === "EMPTY_RESPONSE");
});
