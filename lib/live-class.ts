export type LiveFlashcard = {
  id: string;
  front: string;
  back: string;
  topic: string;
  sourceStart: number;
  sourceEnd: number;
};

export type LiveClassSegment = {
  id: string;
  start: number;
  end: number;
  transcript: string;
  title: string;
  explanation: string;
  keyPoints: string[];
  flashcards: LiveFlashcard[];
  status: "analyzing" | "ready" | "error";
  error?: string;
};

export type LiveClassSession = {
  id: string;
  title: string;
  source: "tab" | "microphone";
  status: "recording" | "processing" | "completed";
  createdAt: string;
  updatedAt: string;
  segments: LiveClassSegment[];
};

export function formatLiveTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

export function liveClassTranscript(session: LiveClassSession) {
  return session.segments
    .filter((segment) => segment.transcript.trim())
    .sort((a, b) => a.start - b.start)
    .map((segment) => `[${formatLiveTime(segment.start)}–${formatLiveTime(segment.end)}] ${segment.transcript.trim()}`)
    .join("\n\n");
}

export function liveClassFlashcards(session: LiveClassSession) {
  return session.segments.flatMap((segment) => segment.flashcards);
}

/** Restored sessions have no live recorder or in-flight work after a page reload. */
export function recoverLiveClasses(sessions: LiveClassSession[]): LiveClassSession[] {
  return sessions.map(session => ({...session,status:'completed',segments:session.segments.map(segment => segment.status === 'analyzing' ? {...segment,status:'error',error:segment.transcript.trim() ? 'A análise foi interrompida. A transcrição foi preservada; tente novamente.' : 'A captura foi interrompida antes de salvar a transcrição. O áudio temporário não está disponível.'} : segment)}));
}
