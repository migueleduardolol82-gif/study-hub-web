"use client";
import { Clock3, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { initialTimer, nextTimerPhase, phaseMinutes, remainingTime, type TimerPhase, type TimerSettings, type TimerSnapshot } from "@/lib/study-timer";

export function useStudyTimer(snapshot: TimerSnapshot, setSnapshot: React.Dispatch<React.SetStateAction<TimerSnapshot>>, ready: boolean, onComplete: (snapshot: TimerSnapshot) => void) {
  const [seconds, setSeconds] = useState(snapshot.remainingSeconds);
  const completedIds = useRef(new Set<string>());
  useEffect(() => {
    if (!ready) return;
    function tick() {
      const left = remainingTime(snapshot, Date.now());
      setSeconds(left);
      if (snapshot.running && left === 0 && !completedIds.current.has(snapshot.sessionId)) {
        completedIds.current.add(snapshot.sessionId);
        setSnapshot(nextTimerPhase(snapshot));
        onComplete(snapshot);
      }
    }
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [snapshot, setSnapshot, ready, onComplete]);
  return snapshot.running ? seconds : snapshot.remainingSeconds;
}

const phaseLabels: Record<TimerPhase, string> = { focus: "Foco", shortBreak: "Pausa curta", longBreak: "Pausa longa" };

export function StudyTimer({ snapshot, setSnapshot, seconds, topic, ready }: { snapshot: TimerSnapshot; setSnapshot: React.Dispatch<React.SetStateAction<TimerSnapshot>>; seconds: number; topic: string; ready: boolean }) {
  const [error, setError] = useState("");
  const settings = snapshot.settings;
  function configure(next: TimerSettings) {
    if (snapshot.running) return;
    if (JSON.stringify(next) === JSON.stringify(settings)) { setError(""); return; }
    setSnapshot(initialTimer(next));
    setError("");
  }
  function duration(key: "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "cycles", raw: string) {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > (key === "cycles" ? 12 : 1440)) { setError(key === "cycles" ? "Informe de 1 a 12 ciclos." : "Informe de 1 a 1440 minutos."); return; }
    configure({ ...settings, [key]: value });
  }
  function selectPhase(phase: TimerPhase) {
    const minutes = phaseMinutes(settings, phase);
    setSnapshot({ ...snapshot, phase, running: false, endsAt: null, remainingSeconds: minutes * 60, sessionMinutes: minutes, sessionId: "", topic: "" });
  }
  function toggle() {
    if (snapshot.running) { setSnapshot({ ...snapshot, running: false, remainingSeconds: remainingTime(snapshot, Date.now()), endsAt: null }); return; }
    const left = snapshot.remainingSeconds || phaseMinutes(settings, snapshot.phase) * 60;
    setSnapshot({ ...snapshot, running: true, remainingSeconds: left, endsAt: Date.now() + left * 1000, sessionId: snapshot.sessionId || crypto.randomUUID(), topic: snapshot.sessionId ? snapshot.topic : topic });
  }
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return <section className="timer-panel panel">
    <div className="panel-heading"><div><span className="eyebrow">SESSÃO DE ESTUDO</span><h3>{settings.technique === "pomodoro" ? "Pomodoro" : "Tempo livre"}</h3></div><Clock3 size={20} /></div>
    <div className="segmented timer-technique"><button disabled={snapshot.running || !ready} aria-pressed={settings.technique === "free"} className={settings.technique === "free" ? "active" : ""} onClick={() => configure({ ...settings, technique: "free", focusMinutes: 50 })}>Tempo livre</button><button disabled={snapshot.running || !ready} aria-pressed={settings.technique === "pomodoro"} className={settings.technique === "pomodoro" ? "active" : ""} onClick={() => configure({ ...settings, technique: "pomodoro", focusMinutes: 25 })}>Pomodoro</button></div>
    <div className="timer-settings">
      <label><span>Foco (minutos)</span><input key={`focus-${settings.technique}-${settings.focusMinutes}`} type="number" min="1" max="1440" defaultValue={settings.focusMinutes} disabled={snapshot.running || !ready} onBlur={(event) => duration("focusMinutes", event.target.value)} /></label>
      <label><span>Pausa curta (minutos)</span><input key={`short-${settings.shortBreakMinutes}`} type="number" min="1" max="1440" defaultValue={settings.shortBreakMinutes} disabled={snapshot.running || !ready} onBlur={(event) => duration("shortBreakMinutes", event.target.value)} /></label>
      {settings.technique === "pomodoro" && <><label><span>Pausa longa (minutos)</span><input key={`long-${settings.longBreakMinutes}`} type="number" min="1" max="1440" defaultValue={settings.longBreakMinutes} disabled={snapshot.running || !ready} onBlur={(event) => duration("longBreakMinutes", event.target.value)} /></label><label><span>Ciclos até pausa longa</span><input key={`cycles-${settings.cycles}`} type="number" min="1" max="12" defaultValue={settings.cycles} disabled={snapshot.running || !ready} onBlur={(event) => duration("cycles", event.target.value)} /></label></>}
    </div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="timer-phases">{(["focus", "shortBreak", ...(settings.technique === "pomodoro" ? ["longBreak" as const] : [])] as TimerPhase[]).map((phase) => <button key={phase} disabled={snapshot.running || !ready} aria-pressed={snapshot.phase === phase} className={snapshot.phase === phase ? "active" : ""} onClick={() => selectPhase(phase)}>{phaseLabels[phase]}</button>)}</div>
    <div className="flip-clock" role="timer" aria-label={`${minutes} minutos e ${remainder} segundos`}>{[...minutes].map((value, i) => <span className="flip-card" key={`m-${i}`}><span>{value}</span><i /></span>)}<b>:</b>{[...remainder].map((value, i) => <span className="flip-card" key={`s-${i}`}><span>{value}</span><i /></span>)}</div>
    <div className="timer-topic"><span />{snapshot.sessionId ? snapshot.topic : topic}</div>
    {settings.technique === "pomodoro" && <p className="timer-help">{snapshot.completedCycles} blocos de foco concluídos. Pausa longa a cada {settings.cycles} blocos. Inicie cada etapa quando estiver pronto.</p>}
    <div className="timer-controls"><button disabled={!ready} className="icon-button" onClick={() => selectPhase(snapshot.phase)} aria-label="Reiniciar cronômetro"><RotateCcw size={19} /></button><button disabled={!ready || Boolean(error)} className="timer-main" onClick={toggle}>{snapshot.running ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {snapshot.running ? "Pausar" : "Começar"}</button><button disabled={!ready} className="icon-button" onClick={() => setSnapshot({ ...snapshot, running: false, endsAt: null, remainingSeconds: 0, sessionId: "" })} aria-label="Encerrar sem concluir"><Square size={18} /></button></div>
    <small className="timer-help">O XP é registrado ao concluir o foco, com a duração escolhida. Pausas e sessões encerradas antes do fim não geram XP.</small>
  </section>;
}
