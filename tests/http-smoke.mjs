import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 3107;
const server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "start", "--", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, OPENAI_API_KEY: "", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "", DATABASE_URL: "", POSTGRES_URL: "", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) return response;
    } catch {
      // Aguarda o servidor de produção ficar pronto.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor não iniciou.\n${output}`);
}

try {
  const home = await waitUntilReady();
  const html = await home.text();
  assert.match(html, /NEXO/);
  assert.match(html, /Mapas de Estudos/);
  assert.match(html, /Revisão Ativa/);

  const signIn = await fetch(`http://127.0.0.1:${port}/sign-in`);
  assert.equal(signIn.status, 200);
  assert.match(await signIn.text(), /Login aguardando configuração/);

  const invalid = await fetch(`http://127.0.0.1:${port}/api/archetypes/recommend`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{invalid",
  });
  assert.equal(invalid.status, 400);
  assert.match(invalid.headers.get("content-type") || "", /application\/json/);
  assert.deepEqual(await invalid.json(), { success: false, error: { code: "INVALID_REQUEST", message: "A solicitação enviada é inválida.", retryable: false } });

  const missingKey = await fetch(`http://127.0.0.1:${port}/api/archetypes/recommend`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: "Tecnologia", goal: "Criar produtos digitais" }),
  });
  assert.equal(missingKey.status, 503);
  const payload = await missingKey.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "OPENAI_KEY_MISSING");
  assert.equal(typeof payload.error.message, "string");
  assert.equal(JSON.stringify(payload).includes("sk-"), false);

  const tutorMissingKey = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Explique juros compostos" }),
  });
  assert.equal(tutorMissingKey.status, 503);
  const tutorPayload = await tutorMissingKey.json();
  assert.equal(tutorPayload.error.code, "OPENAI_KEY_MISSING");
  assert.equal(JSON.stringify(tutorPayload).includes("OPENAI_API_KEY"), false);

  const invalidMedia = await fetch(`http://127.0.0.1:${port}/api/transcribe`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceUrl: "http://localhost/video.mp4" }),
  });
  assert.equal(invalidMedia.status, 400);
  const invalidMediaPayload = await invalidMedia.json();
  assert.equal(invalidMediaPayload.error.code, "INVALID_MEDIA");
  assert.equal(invalidMediaPayload.success, false);

  const invalidShape = await fetch(`http://127.0.0.1:${port}/api/learning/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "[]",
  });
  assert.equal(invalidShape.status, 400);
  assert.equal((await invalidShape.json()).error.code, "INVALID_REQUEST");

  const userData = await fetch(`http://127.0.0.1:${port}/api/user-data`);
  assert.equal(userData.status, 503);
  assert.equal((await userData.json()).error.code, "CLOUD_NOT_CONFIGURED");

  console.log("HTTP smoke: páginas, login, IA, mídia e contratos de erro verificados.");
} finally {
  server.kill("SIGTERM");
}
