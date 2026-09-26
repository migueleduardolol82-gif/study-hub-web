"use client";

import { useEffect, useState } from "react";
import { requestAI } from "@/lib/ai-client";

type Inspiration = { line: string; actor: string; day: string };
const fallback = "O próximo passo ganha força quando você decide começar.";
const pending = new Map<string, Promise<Inspiration>>();

function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function HomeInspiration() {
  const [inspiration, setInspiration] = useState<Inspiration | null>(null);
  useEffect(() => {
    let active = true;
    const day = localDay();
    const key = `mers-inspiration-v1:${day}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "null") as Inspiration | null;
      if (cached?.day === day && typeof cached.line === "string" && typeof cached.actor === "string") {
        queueMicrotask(() => { if (active) setInspiration(cached); });
        return () => { active = false; };
      }
    } catch { /* A frase em cache é opcional. */ }
    let request = pending.get(day);
    if (!request) {
      request = requestAI<Inspiration>("/api/home/inspiration", {day});
      pending.set(day, request);
      void request.finally(() => pending.delete(day)).catch(() => undefined);
    }
    void request.then(result => {
      if (!active || result.day !== day) return;
      setInspiration(result);
      try { localStorage.setItem(key, JSON.stringify(result)); } catch { /* A frase continua nesta sessão. */ }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  return <div className="home-inspiration"><span className="eyebrow">INSPIRAÇÃO DE HOJE</span><h2>{inspiration?.line || fallback}</h2><p>{inspiration ? `Texto original inspirado na trajetória de ${inspiration.actor}` : "Um passo de cada vez."}</p></div>;
}
