export type TimerPhase = "focus" | "shortBreak" | "longBreak";
export type TimerSettings = { technique: "free" | "pomodoro"; focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number; cycles: number };
export type TimerSnapshot = { settings: TimerSettings; phase: TimerPhase; remainingSeconds: number; running: boolean; endsAt: number | null; sessionId: string; sessionMinutes: number; topic: string; completedCycles: number };
export const defaultTimerSettings: TimerSettings = { technique: "free", focusMinutes: 50, shortBreakMinutes: 5, longBreakMinutes: 15, cycles: 4 };

export function phaseMinutes(settings: TimerSettings, phase: TimerPhase) {
  return phase === "focus" ? settings.focusMinutes : phase === "shortBreak" ? settings.shortBreakMinutes : settings.longBreakMinutes;
}
export function initialTimer(settings = defaultTimerSettings): TimerSnapshot {
  return { settings, phase: "focus", remainingSeconds: settings.focusMinutes * 60, running: false, endsAt: null, sessionId: "", sessionMinutes: settings.focusMinutes, topic: "", completedCycles: 0 };
}
export function remainingTime(snapshot: TimerSnapshot, now: number) {
  return snapshot.running && snapshot.endsAt !== null ? Math.max(0, Math.ceil((snapshot.endsAt - now) / 1000)) : snapshot.remainingSeconds;
}
export function nextTimerPhase(snapshot: TimerSnapshot): TimerSnapshot {
  const cycles = snapshot.completedCycles + (snapshot.phase === "focus" ? 1 : 0);
  const phase: TimerPhase = snapshot.settings.technique === "free" ? snapshot.phase : snapshot.phase !== "focus" ? "focus" : cycles % snapshot.settings.cycles === 0 ? "longBreak" : "shortBreak";
  const minutes = phaseMinutes(snapshot.settings, phase);
  return { ...snapshot, phase, completedCycles: cycles, running: false, endsAt: null, sessionId: "", remainingSeconds: snapshot.settings.technique === "free" ? 0 : minutes * 60, sessionMinutes: minutes };
}
export function restoreTimer(value: unknown): TimerSnapshot {
  const fallback = initialTimer();
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<TimerSnapshot>;
  const settings = candidate.settings;
  if (!settings || !["free", "pomodoro"].includes(settings.technique) || [settings.focusMinutes, settings.shortBreakMinutes, settings.longBreakMinutes].some((n) => !Number.isInteger(n) || n < 1 || n > 1440) || !Number.isInteger(settings.cycles) || settings.cycles < 1 || settings.cycles > 12) return fallback;
  if (!["focus", "shortBreak", "longBreak"].includes(String(candidate.phase)) || !Number.isFinite(candidate.remainingSeconds) || Number(candidate.remainingSeconds) < 0 || Number(candidate.remainingSeconds) > 86400 || !Number.isFinite(candidate.sessionMinutes) || Number(candidate.sessionMinutes) < 1 || Number(candidate.sessionMinutes) > 1440) return initialTimer(settings);
  const running = candidate.running === true && typeof candidate.endsAt === "number" && Number.isFinite(candidate.endsAt) && Boolean(candidate.sessionId);
  return { settings, phase: candidate.phase!, remainingSeconds: Number(candidate.remainingSeconds), running, endsAt: running ? candidate.endsAt! : null, sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : "", sessionMinutes: Number(candidate.sessionMinutes), topic: typeof candidate.topic === "string" ? candidate.topic : "", completedCycles: Number.isInteger(candidate.completedCycles) && Number(candidate.completedCycles) >= 0 ? Number(candidate.completedCycles) : 0 };
}
