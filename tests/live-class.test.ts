import assert from "node:assert/strict";
import test from "node:test";
import { recoverLiveClasses, formatLiveTime, liveClassFlashcards, liveClassTranscript, type LiveClassSession } from "../lib/live-class.ts";

const session: LiveClassSession = {
  id: "aula-1", title: "Renda fixa", source: "tab", status: "completed",
  createdAt: "2026-09-10T12:00:00Z", updatedAt: "2026-09-10T12:01:00Z",
  segments: [{
    id: "seg-2", start: 30, end: 60, transcript: "Segundo trecho.", title: "Parte 2", explanation: "Explicação 2", keyPoints: [], status: "ready",
    flashcards: [{ id: "card-2", front: "Pergunta 2", back: "Resposta 2", topic: "Tema", sourceStart: 30, sourceEnd: 60 }],
  }, {
    id: "seg-1", start: 0, end: 30, transcript: "Primeiro trecho.", title: "Parte 1", explanation: "Explicação 1", keyPoints: [], status: "ready",
    flashcards: [{ id: "card-1", front: "Pergunta 1", back: "Resposta 1", topic: "Tema", sourceStart: 0, sourceEnd: 30 }],
  }],
};

test("formata o minuto de origem sem valores inválidos", () => {
  assert.equal(formatLiveTime(0), "00:00");
  assert.equal(formatLiveTime(125), "02:05");
  assert.equal(formatLiveTime(Number.NaN), "00:00");
});

test("transcrição consolidada mantém a ordem temporal", () => {
  assert.equal(liveClassTranscript(session), "[00:00–00:30] Primeiro trecho.\n\n[00:30–01:00] Segundo trecho.");
});

test("flashcards preservam as referências do trecho", () => {
  const cards = liveClassFlashcards(session);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map(card => card.sourceStart).sort((a, b) => a - b), [0, 30]);
});

test("reload recovers interrupted analysis without losing transcript or completed cards",()=>{const original={...session,status:'processing' as const,segments:[...session.segments,{id:'pending',start:60,end:90,transcript:'Texto já salvo',title:'Processando',explanation:'',keyPoints:[],flashcards:[],status:'analyzing' as const}]};const before=JSON.stringify(original);const restored=recoverLiveClasses([original])[0];assert.equal(restored.status,'completed');assert.equal(restored.segments[2].status,'error');assert.equal(restored.segments[2].transcript,'Texto já salvo');assert.deepEqual(restored.segments.slice(0,2),session.segments);assert.equal(JSON.stringify(original),before);});
