"use client";

import { useEffect, useRef, useState } from "react";
import { requestAI } from "@/lib/ai-client";

export function StudyAIStatus() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try {
      await requestAI<{ connected: boolean }>("/api/learning/connection", {}, controller.signal);
      setMessage("Conectada · resposta estruturada validada agora.");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Não foi possível testar a conexão.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <details className="study-ai-status">
    <summary>Conexão da IA</summary>
    <p>Testa a geração no servidor. Seus cartões salvos continuam disponíveis.</p>
    <button type="button" className="review-secondary" disabled={busy} onClick={check}>{busy ? "Testando…" : "Testar conexão"}</button>
    <p role="status" aria-live="polite">{message}</p>
  </details>;
}
