"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, FileVideo, LoaderCircle, Mic, MonitorUp, Play, RotateCcw, Square, Trash2, Video } from "lucide-react";
import { readApiResponse } from "@/lib/api-contract";
import { formatLiveTime, liveClassFlashcards, liveClassTranscript, type LiveClassSession, type LiveClassSegment } from "@/lib/live-class";

type Props = {
  sessions: LiveClassSession[];
  setSessions: Dispatch<SetStateAction<LiveClassSession[]>>;
  onCreateReview: (session: LiveClassSession) => void;
};

const nowTitle = () => `Aula de ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

export function LiveClassStudio({ sessions, setSessions, onCreateReview }: Props) {
  const [title, setTitle] = useState(nowTitle);
  const [source, setSource] = useState<"tab" | "microphone">("tab");
  const [activeId, setActiveId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const capturedStream = useRef<MediaStream | null>(null);
  const activeSessionId = useRef("");
  const nextOffset = useRef(0);
  const lastChunkAt = useRef(0);
  const queue = useRef(Promise.resolve());
  const chunkCache = useRef(new Map<string, Blob>());
  const transcriptContext = useRef(new Map<string, string>());
  const recording = Boolean(activeId);

  useEffect(() => () => {
    capturedStream.current?.getTracks().forEach(track => track.stop());
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  function updateSegment(sessionId: string, segmentId: string, update: Partial<LiveClassSegment>) {
    setSessions(current => current.map(session => session.id !== sessionId ? session : {
      ...session, updatedAt: new Date().toISOString(),
      segments: session.segments.map(segment => segment.id === segmentId ? { ...segment, ...update } : segment),
    }));
  }

  async function processChunk(sessionId: string, segmentId: string, blob: Blob) {
    try {
      const form = new FormData();
      form.append("audio", new File([blob], `trecho.${blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"}`, { type: blob.type || "audio/webm" }));
      const transcribed = await readApiResponse<{ transcript: string }>(await fetch("/api/live-class/transcribe", { method: "POST", body: form }));
      updateSegment(sessionId, segmentId, { transcript: transcribed.transcript, error: undefined });
      if (!transcribed.transcript) {
        updateSegment(sessionId, segmentId, { status: "ready", title: "Sem fala identificada", explanation: "Este trecho não continha fala suficiente para gerar material de estudo.", keyPoints: [], flashcards: [] });
        chunkCache.current.delete(segmentId);
        return;
      }
      const previousContext = transcriptContext.current.get(sessionId) || "";
      const analyzed = await readApiResponse<{ title: string; explanation: string; keyPoints: string[]; flashcards: { front: string; back: string; topic: string }[] }>(await fetch("/api/live-class/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: transcribed.transcript, context: previousContext.slice(-6_000) }),
      }));
      transcriptContext.current.set(sessionId, `${previousContext}\n${transcribed.transcript}`.slice(-8_000));
      setSessions(current => current.map(session => session.id !== sessionId ? session : {
        ...session, updatedAt: new Date().toISOString(),
        segments: session.segments.map(segment => segment.id !== segmentId ? segment : {
          ...segment, status: "ready", title: analyzed.title, explanation: analyzed.explanation, keyPoints: analyzed.keyPoints,
          flashcards: analyzed.flashcards.map(card => ({ ...card, id: crypto.randomUUID(), sourceStart: segment.start, sourceEnd: segment.end })),
        }),
      }));
      chunkCache.current.delete(segmentId);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível processar este trecho.";
      updateSegment(sessionId, segmentId, { status: "error", error: message });
    }
  }

  function enqueueChunk(blob: Blob, timecode: number) {
    if (!blob.size || !activeSessionId.current) return;
    const sessionId = activeSessionId.current;
    const segmentId = crypto.randomUUID();
    const currentTime = Number.isFinite(timecode) && timecode > lastChunkAt.current ? timecode : lastChunkAt.current + 30_000;
    const duration = Math.max(1, Math.round((currentTime - lastChunkAt.current) / 1000));
    const start = nextOffset.current;
    const end = start + duration;
    lastChunkAt.current = currentTime;
    nextOffset.current = end;
    const placeholder: LiveClassSegment = { id: segmentId, start, end, transcript: "", title: "Processando trecho…", explanation: "", keyPoints: [], flashcards: [], status: "analyzing" };
    chunkCache.current.set(segmentId, blob);
    setSessions(current => current.map(session => session.id === sessionId ? { ...session, updatedAt: new Date().toISOString(), segments: [...session.segments, placeholder] } : session));
    queue.current = queue.current.then(() => processChunk(sessionId, segmentId, blob));
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setError("Este navegador não oferece gravação ao vivo. Atualize o navegador ou use o envio normal de vídeo abaixo.");
      return;
    }
    try {
      const stream = source === "tab"
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error(source === "tab" ? "Nenhum áudio foi compartilhado. Selecione a aba da aula e marque ‘Compartilhar áudio’." : "O microfone não forneceu áudio.");
      }
      const audioStream = new MediaStream(stream.getAudioTracks());
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = mime ? new MediaRecorder(audioStream, { mimeType: mime, audioBitsPerSecond: 64_000 }) : new MediaRecorder(audioStream);
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const session: LiveClassSession = { id, title: title.trim() || nowTitle(), source, status: "recording", createdAt, updatedAt: createdAt, segments: [] };
      setSessions(current => [session, ...current]);
      setActiveId(id); setExpandedId(id);
      activeSessionId.current = id; nextOffset.current = 0; lastChunkAt.current = 0;
      transcriptContext.current.set(id, "");
      capturedStream.current = stream; recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = event => enqueueChunk(event.data, event.timecode);
      mediaRecorder.onstop = () => {
        const stoppedId = activeSessionId.current;
        setActiveId("");
        setSessions(current => current.map(item => item.id === stoppedId ? { ...item, status: "processing", updatedAt: new Date().toISOString() } : item));
        queue.current.finally(() => setSessions(current => current.map(item => item.id === stoppedId ? { ...item, status: "completed", updatedAt: new Date().toISOString() } : item)));
        stream.getTracks().forEach(track => track.stop());
        capturedStream.current = null; recorder.current = null; activeSessionId.current = "";
      };
      stream.getTracks().forEach(track => { track.onended = () => { if (mediaRecorder.state !== "inactive") mediaRecorder.stop(); }; });
      mediaRecorder.start(30_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a captura.");
    }
  }

  function stopRecording() {
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
  }

  function retrySegment(sessionId: string, segmentId: string) {
    const blob = chunkCache.current.get(segmentId);
    if (!blob) { setError("O áudio temporário deste trecho não está mais disponível. A transcrição já salva foi mantida."); return; }
    updateSegment(sessionId, segmentId, { status: "analyzing", error: undefined });
    queue.current = queue.current.then(() => processChunk(sessionId, segmentId, blob));
  }

  function chooseVideo(file?: File) {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(file ? URL.createObjectURL(file) : "");
    if (file) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  return <section className="live-class panel">
    <header className="live-class-header">
      <div><span className="eyebrow lime">AULA AO VIVO</span><h2>Aprenda enquanto assiste.</h2><p>A cada 30 segundos, a fala vira transcrição, explicação e flashcards com o minuto de origem.</p></div>
      {recording ? <button type="button" className="live-stop" onClick={stopRecording}><Square size={17}/> Encerrar aula</button> : null}
    </header>

    <div className="live-setup">
      <label><span>Nome da aula</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={120}/></label>
      <div className="live-source" role="group" aria-label="Fonte do áudio">
        <button type="button" className={source === "tab" ? "active" : ""} disabled={recording} onClick={() => setSource("tab")}><MonitorUp size={19}/><span><strong>Aba do navegador</strong><small>Computador · marque compartilhar áudio</small></span></button>
        <button type="button" className={source === "microphone" ? "active" : ""} disabled={recording} onClick={() => setSource("microphone")}><Mic size={19}/><span><strong>Microfone</strong><small>Celular ou aula presencial</small></span></button>
      </div>
      <label className="live-video-picker"><input type="file" accept="video/*" onChange={event => chooseVideo(event.target.files?.[0])}/><FileVideo size={19}/><span><strong>Abrir vídeo nesta página</strong><small>Depois escolha “Aba do navegador” e compartilhe esta aba com áudio.</small></span></label>
      {videoUrl ? <video className="live-video" controls playsInline src={videoUrl}/> : null}
      {!recording ? <button type="button" className="primary-button live-start" onClick={startRecording}><Play size={18}/> Iniciar Aula ao Vivo</button> : <div className="live-recording"><i/><span>Capturando áudio</span><small>Você pode continuar assistindo. Não feche esta página.</small></div>}
      {error ? <div className="inline-error" role="alert">{error}<button type="button" onClick={() => setError("")}>Fechar</button></div> : null}
      <p className="live-privacy">A captura só começa após sua autorização. Não grave pessoas ou conteúdos sem permissão.</p>
    </div>

    {sessions.length ? <div className="live-history">
      <h3>Aulas salvas</h3>
      {sessions.map(session => {
        const open = expandedId === session.id;
        const cards = liveClassFlashcards(session);
        const ready = session.segments.filter(segment => segment.status === "ready").length;
        return <article key={session.id} className="live-session">
          <button type="button" className="live-session-head" onClick={() => setExpandedId(open ? "" : session.id)}>
            <span className={session.status}><Video size={18}/></span><div><strong>{session.title}</strong><small>{new Date(session.createdAt).toLocaleString("pt-BR")} · {ready}/{session.segments.length} trechos · {cards.length} flashcards</small></div>{session.status === "recording" || session.status === "processing" ? <LoaderCircle className="spin"/> : <Check/>}{open ? <ChevronUp/> : <ChevronDown/>}
          </button>
          {open ? <div className="live-session-body">
            {session.segments.length ? session.segments.map(segment => <article className={`live-segment ${segment.status}`} key={segment.id}>
              <span>{formatLiveTime(segment.start)}–{formatLiveTime(segment.end)}</span><h4>{segment.title}</h4>
              {segment.status === "analyzing" ? <p><LoaderCircle className="spin" size={16}/> Transcrevendo e preparando o conteúdo…</p> : null}
              {segment.transcript ? <details><summary>Ver transcrição</summary><p>{segment.transcript}</p></details> : null}
              {segment.explanation ? <div className="live-explanation"><strong>Explicação</strong><p>{segment.explanation}</p></div> : null}
              {segment.keyPoints.length ? <ul>{segment.keyPoints.map(point => <li key={point}>{point}</li>)}</ul> : null}
              {segment.flashcards.length ? <div className="live-cards">{segment.flashcards.map(card => <details key={card.id}><summary>{card.front}</summary><p>{card.back}</p><small>{card.topic} · {formatLiveTime(card.sourceStart)}</small></details>)}</div> : null}
              {segment.status === "error" ? <div className="inline-error"><span>{segment.error}</span><button type="button" onClick={() => retrySegment(session.id, segment.id)}><RotateCcw size={15}/> Tentar novamente</button></div> : null}
            </article>) : <p className="live-empty">O primeiro trecho aparecerá em até 30 segundos.</p>}
            <div className="live-session-actions">
              <button type="button" className="primary-button" disabled={!cards.length || session.status !== "completed"} onClick={() => onCreateReview(session)}><BookOpen size={17}/> Levar para Revisão Ativa</button>
              <button type="button" className="outline-button" disabled={!liveClassTranscript(session)} onClick={() => navigator.clipboard.writeText(liveClassTranscript(session))}>Copiar transcrição</button>
              <button type="button" className="text-button danger" disabled={session.id === activeId} onClick={() => { if (window.confirm(`Excluir a aula “${session.title}” e seus ${cards.length} flashcards?`)) setSessions(current => current.filter(item => item.id !== session.id)); }}><Trash2 size={15}/> Excluir</button>
            </div>
          </div> : null}
        </article>;
      })}
    </div> : null}
  </section>;
}
