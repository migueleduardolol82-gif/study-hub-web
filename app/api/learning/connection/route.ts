import { aiRoute } from "@/lib/ai-route";
import { createStructuredResponse } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

// Uses the same provider, model and structured-output path as card generation.
// Deliberately uncached: a saved success cannot prove today's connection.
export async function POST(request: Request) {
  return aiRoute(request, "learning/connection", async () => {
    const started = Date.now();
    await createStructuredResponse({
      instructions: "Return the JSON object with ok equal to true.",
      input: "Connection test.",
      schemaName: "connection_test",
      schema: { type: "object", properties: { ok: { type: "boolean", enum: [true] } }, required: ["ok"], additionalProperties: false },
      maxOutputTokens: 1024,
      timeoutMs: 45000,
      signal: request.signal,
      validate(value) {
        if (!value || typeof value !== "object" || !("ok" in value) || value.ok !== true) throw new Error("Invalid connection response");
        return true;
      },
    });
    return { connected: true, elapsedMs: Date.now() - started };
  });
}
