import { createHash, randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { isCloudConfigured } from "./auth-config";
import { getDatabase } from "./db";
import { OpenAIRequestError } from "./openai";

// Separate, additive storage: never replaces nexo_user_state or a student's tracks.
export async function savedReviewGeneration<T>(kind: string, input: unknown, generate: (usage: (value: unknown) => void) => Promise<T>): Promise<T> {
  if (!isCloudConfigured()) return generate(() => {}); // Existing local-only installations remain usable.
  const userId = (await auth()).userId;
  if (!userId) throw new OpenAIRequestError("AUTH_REQUIRED", "Entre na sua conta para continuar.", 401, false);
  const sql = getDatabase();
  await sql`CREATE TABLE IF NOT EXISTS nexo_review_generations (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
    kind TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL,
    result JSONB, usage JSONB, estimated_cost_cents NUMERIC,
    lease_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, fingerprint)
  )`;
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
  const fingerprint = createHash("sha256").update(JSON.stringify({ version: 1, kind, model, input })).digest("hex");
  const id = randomUUID(), lease = randomUUID();
  const claimed = await sql`INSERT INTO nexo_review_generations (id,user_id,fingerprint,kind,model,status,lease_id)
    VALUES (${id},${userId},${fingerprint},${kind},${model},'processing',${lease})
    ON CONFLICT(user_id,fingerprint) DO UPDATE SET status='processing',lease_id=${lease},updated_at=NOW()
    WHERE nexo_review_generations.status='error' OR (nexo_review_generations.status='processing' AND nexo_review_generations.updated_at < NOW() - INTERVAL '3 minutes') RETURNING id`;
  if (!claimed.length) {
    const cached = await sql`SELECT status,result FROM nexo_review_generations WHERE user_id=${userId} AND fingerprint=${fingerprint}`;
    if (cached[0]?.status === "complete") return cached[0].result as T;
    throw new OpenAIRequestError("GENERATION_IN_PROGRESS", "Esta etapa já está sendo processada. Aguarde um pouco e tente novamente; o resultado será reutilizado.", 409, true);
  }
  const usage: unknown[] = [];
  try {
    const result = await generate(value => usage.push(value));
    await sql`UPDATE nexo_review_generations SET status='complete',result=${JSON.stringify(result)}::jsonb,usage=${JSON.stringify(usage)}::jsonb,updated_at=NOW() WHERE user_id=${userId} AND fingerprint=${fingerprint} AND lease_id=${lease}`;
    return result;
  } catch (error) {
    await sql`UPDATE nexo_review_generations SET status='error',usage=${JSON.stringify(usage)}::jsonb,updated_at=NOW() WHERE user_id=${userId} AND fingerprint=${fingerprint} AND lease_id=${lease}`;
    throw error;
  }
}
