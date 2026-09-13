"use client";

import { useEffect, useRef, useState } from "react";
import { requestAI } from "@/lib/ai-client";
import { emptyPathProgress, type LearningPath, type PathProgress } from "@/lib/learning";
import { bank, completeSession, conceptKey, modeLabels, recordAttempt, sessionStats, sessionXp, type ReviewSession as Session } from "@/lib/review-engine";
import { validateSemanticGrade, type SemanticGrade } from "@/lib/semantic-grading";
import { validateTutorAnswer, type TutorAnswer } from "@/lib/learning-tutor";

type Props = { path: LearningPath; progress: PathProgress; session: Session; setProgress: React.Dispatch<React.SetStateAction<Record<string, PathProgress>>>; onClose: () => void };
type TutorStyle = "child" | "detailed" | "question";
type TutorPanelProps = {
  open: boolean;
  style: TutorStyle;
  question: string;
  answer: TutorAnswer | null;
  busy: boolean;
  error: string;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
};

function TutorPanel({ open, style, question, answer, busy, error, onQuestionChange, onAsk }: TutorPanelProps) {
  if (!open) return null;
  const title = style === "child" ? "Explicação simples" : style === "detailed" ? "Explicação aprofundada" : "Tutor da trilha";
  return <div className="review-tutor-panel">
    <p>O tutor usa esta lição como fonte principal e identifica qualquer complemento externo.</p>
    <label><span>Sua dúvida</span><textarea value={question} onChange={event => onQuestionChange(event.target.value)} maxLength={3000} placeholder="Ex.: explique de outro jeito ou dê um exemplo." /></label>
    <button disabled={busy || !question.trim()} onClick={onAsk}>{busy ? "Explicando…" : "Perguntar"}</button>
    {error && <p role="alert" className="review-tutor-error">{error}</p>}
    {answer && <article aria-live="polite"><h4>{title}</h4><p>{answer.fromMaterial || "O material não traz informação suficiente para responder."}</p>{answer.complement && <><h4>Complementação da IA</h4><p>{answer.complement}</p></>}{answer.caveat && <p><small>{answer.caveat}</small></p>}{answer.suggestedQuestion && <p><b>Para testar:</b> {answer.suggestedQuestion}</p>}</article>}
  </div>;
}

// Read the wall clock at event time, never while computing a rendered verdict.
const eventTime = () => Date.now();
export function ReviewSession({ path, progress, session, setProgress, onClose }: Props) {
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null);
  const [draft, setDraft] = useState(session.draft);
  const [revealed, setRevealed] = useState(session.revealed);
  const [taught, setTaught] = useState(session.taught);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorAnswer, setTutorAnswer] = useState<TutorAnswer | null>(null);
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorError, setTutorError] = useState("");
  const [tutorStyle, setTutorStyle] = useState<TutorStyle>("question");
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const enteredAt = useRef(0);
  const scroll = useRef<HTMLDivElement>(null);
  const current = session.items[session.index];
  const row = bank(path).find(r => r.exercise.id === current?.exerciseId && r.lesson.id === current.lessonId);
  const exercise = row?.exercise;
  const attempt = session.answers.find(a => a.exerciseId === current?.exerciseId);
  const stats = sessionStats(session);
  const seconds = session.deadline ? Math.max(0, Math.ceil((session.deadline - now) / 1000)) : 0;
  const expired = session.mode === "speed" && Boolean(session.deadline) && seconds <= 0;
  const flashcard = session.mode === "flashcards" || exercise?.type === "flashcard" && session.mode !== "dominio";
  const mastery = row ? progress.conceptMastery?.[conceptKey(row.lesson, row.exercise)]?.mastery || 0 : 0;
  const update = (change: Partial<Session>) => setProgress(all => { const p = all[path.id] || emptyPathProgress; if (p.reviewSession?.id !== session.id) return all; return { ...all, [path.id]: { ...p, reviewSession: { ...p.reviewSession, ...change } } }; });
  const persistTransient = () => update({ draft, revealed, taught });

  useEffect(() => {
    mounted.current = true;
    enteredAt.current = Date.now();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const resize = () => { const v = window.visualViewport; if (v) setViewport({ top: v.offsetTop, height: v.height }); };
    resize(); window.visualViewport?.addEventListener("resize", resize); window.visualViewport?.addEventListener("scroll", resize);
    return () => { mounted.current = false; request.current?.abort(); document.body.style.overflow = original; window.visualViewport?.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("scroll", resize); };
  }, []);
  useEffect(() => {
    if (session.mode !== "speed" || session.finished || !session.deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [session.mode, session.finished, session.deadline]);

  function handleGrade(grade: SemanticGrade, selected: string, selectedOptionId: string | undefined, at: number) {
    if (!row || attempt) return;
    const answer = { id: `${session.id}:${row.exercise.id}`, sessionId: session.id, exerciseId: row.exercise.id, lessonId: row.lesson.id, concept: conceptKey(row.lesson, row.exercise), mode: session.mode, selected, selectedOptionId, grade, answeredAt: new Date(at).toISOString(), elapsedMs: at - enteredAt.current };
    setProgress(all => {
      const p = all[path.id] || emptyPathProgress;
      if (p.reviewSession?.id !== session.id || p.reviewSession.finished || p.reviewSession.answers.some(a => a.id === answer.id)) return all;
      return { ...all, [path.id]: { ...recordAttempt(p, answer), reviewSession: { ...p.reviewSession, answers: [...p.reviewSession.answers, answer] } } };
    });
  }
  async function check() {
    if (!exercise || !row || attempt || request.current || expired || (session.deadline && eventTime() >= session.deadline) || !draft.trim()) return;
    setError("");
    const option = exercise.options.findIndex((_, i) => draft === `${exercise.id}:option:${i}`);
    const selected = option >= 0 ? exercise.options[option] : draft.trim();
    update({ draft, revealed, taught });
    if (option >= 0 || ["matching", "ordering"].includes(exercise.type)) {
      const canonical = (s: string) => s.split("|").map(p => p.trim()).join("|");
      const correct = canonical(selected) === canonical(exercise.answer);
      handleGrade({ correct, missingPoints: [], feedback: exercise.explanation, referenceAnswer: exercise.answer }, selected, option >= 0 ? draft : undefined, eventTime());
      return;
    }
    const controller = new AbortController(); request.current = controller; setGrading(true);
    try {
      const response = await requestAI<unknown>("/api/learning/grade", { question: exercise.prompt, answer: selected, referenceAnswer: exercise.answer, criteria: exercise.essentialCriteria || [], context: [row.lesson.studyNotes, exercise.explanation, exercise.sourceReference].filter(Boolean).join("\n").slice(0, 20000) }, controller.signal);
      if (mounted.current) handleGrade(validateSemanticGrade(response), selected, undefined, eventTime());
    } catch { if (mounted.current) setError("Não foi possível corrigir agora. Sua resposta foi preservada e não foi registrada como erro. Tente novamente."); }
    finally { request.current = null; if (mounted.current) setGrading(false); }
  }
  function finish(finalSession = session) { setProgress(all => ({ ...all, [path.id]: completeSession(all[path.id], finalSession, path) })); }
  function next(skip = false) {
    if (grading) return;
    if (expired || session.index + 1 >= session.items.length) { finish(skip && current ? { ...session, skipped: [...session.skipped, current.exerciseId] } : session); return; }
    update({ index: session.index + 1, draft: "", revealed: false, taught: false, skipped: skip && current ? [...session.skipped, current.exerciseId] : session.skipped });
    setDraft(""); setRevealed(false); setTaught(false); setError(""); setTutorOpen(false); setTutorQuestion(""); setTutorAnswer(null); setTutorError(""); setTutorStyle("question"); enteredAt.current = Date.now(); scroll.current?.scrollTo({ top: 0, behavior: "instant" });
  }
  function close() {
    request.current?.abort();
    update({ draft, revealed, taught, ...(session.mode === "speed" && !session.finished ? { remainingSeconds: seconds, deadline: undefined } : {}) });
    onClose();
  }
  async function askTutor(question = tutorQuestion, style: TutorStyle = "question") {
    const clean = question.trim();
    if (!clean || !exercise || !row || tutorBusy) return;
    setTutorOpen(true); setTutorStyle(style); setTutorQuestion(clean); setTutorBusy(true); setTutorError(""); setTutorAnswer(null);
    try {
      const answer = await requestAI<unknown>("/api/learning/tutor", {
        question: clean,
        style,
        material: [row.lesson.studyNotes, row.lesson.description, exercise.sourceReference, exercise.explanation].filter(Boolean).join("\n\n").slice(0, 24000),
        context: JSON.stringify({ trail: path.title, unit: row.unit.title, concept: exercise.concept || row.lesson.title, currentQuestion: exercise.prompt, userAnswer: draft }).slice(0, 10000),
      });
      if (mounted.current) setTutorAnswer(validateTutorAnswer(answer));
    } catch { if (mounted.current) setTutorError("O tutor não conseguiu responder agora. Sua sessão continua salva."); }
    finally { if (mounted.current) setTutorBusy(false); }
  }

  const teaching = exercise && row ? exercise.teaching || row.lesson.studyNotes || row.lesson.description : "";
  const teachingParagraphs = teaching.split(/\n{2,}/).map(paragraph => paragraph.trim()).filter(Boolean);
  const teachingHighlights = exercise && row ? exercise.teachingHighlights?.length ? exercise.teachingHighlights : (exercise.essentialCriteria?.slice(0, 5) || row.lesson.keyConcepts?.slice(0, 5) || []) : [];
  const lessonExamples = row?.lesson.examples || [];
  const teachingExample = exercise ? exercise.example || lessonExamples[session.index % Math.max(lessonExamples.length, 1)] : "";
  const memoryTip = exercise?.memoryTip || "";
  const comparisonRows = exercise?.comparisonRows || [];
  const openTutor = (style: TutorStyle) => {
    if (style === "question") { setTutorStyle(style); setTutorOpen(true); setTutorAnswer(null); setTutorError(""); return; }
    const prompt = style === "child" ? "Explique este conceito como para uma criança curiosa, usando uma analogia simples sem perder os pontos importantes." : "Aprofunde este conceito passo a passo, conectando causas, consequências e um exemplo prático.";
    void askTutor(prompt, style);
  };

  return <section className="review-app" aria-label="Sessão de revisão" style={viewport ? { top: viewport.top, height: viewport.height } : undefined}>
    <header className="review-app-header"><button onClick={close} aria-label="Salvar e sair da sessão">Sair</button><div><small>{path.title} · {modeLabels[session.mode]}</small><strong>{Math.min(session.index + 1, session.items.length)} / {session.items.length}</strong><progress value={session.finished ? session.items.length : session.index} max={session.items.length || 1} /></div>{session.mode === "speed" && <strong aria-label="Segundos restantes">{seconds}s</strong>}</header>
    <div className="review-app-scroll" ref={scroll}>
      {session.finished ? <div className="review-result"><span className="eyebrow">SESSÃO FINALIZADA</span><h2>{stats.accuracy}% de precisão</h2><p>{stats.answered} respondidas · {stats.correct} corretas · {stats.wrong} erradas</p><p>{stats.unanswered} não respondidas — não entram no caderno de erros.</p><p>Melhor sequência: {stats.bestStreak} · Pontuação: {stats.points} · +{sessionXp(session)} XP</p>{session.answers.filter(a => !a.grade.correct).map(a => <details key={a.id}><summary>{bank(path).find(r => r.exercise.id === a.exerciseId)?.exercise.prompt || "Revisar erro"}</summary><p>Sua resposta: {a.selected}</p><p>{a.grade.feedback}</p><p>Referência: {a.grade.referenceAnswer}</p></details>)}<button onClick={close}>Voltar à trilha</button></div>
      : !exercise || !row ? <div><h2>Esta questão não está mais disponível.</h2><p>O conteúdo pode ter sido editado. Seu histórico permanece salvo.</p><button onClick={() => next(true)}>Pular questão indisponível</button></div>
      : <article className="review-question" key={exercise.id}>
        <div className="review-question-meta"><small>{row.unit.title} · {exercise.concept || row.lesson.title}</small><span>Domínio {mastery}%</span></div>
        {session.mode === "estudar" && !taught ? <div className="review-teaching">
          <span className="review-lesson-step">APRENDA O CONCEITO</span>
          <section className="review-teaching-card">
            <h2>{exercise.concept || row.lesson.title}</h2>
            <div className="review-teaching-copy">{teachingParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            {teachingHighlights.length > 0 && <div className="review-key-points"><h3>Pontos essenciais</h3><ul>{teachingHighlights.map(point => <li key={point}>{point}</li>)}</ul></div>}
            {comparisonRows.length > 0 && <div className="review-comparison" role="region" aria-label="Comparação do conteúdo"><table><thead><tr><th>Conceito</th><th>Como identificar</th></tr></thead><tbody>{comparisonRows.map(row => <tr key={`${row.term}:${row.explanation}`}><th scope="row">{row.term}</th><td>{row.explanation}</td></tr>)}</tbody></table></div>}
            {teachingExample && <div className="review-example"><h3>Exemplo</h3><p>{teachingExample}</p></div>}
            {memoryTip && <aside className="review-memory-tip"><h3>Dica para não esquecer</h3><p>{memoryTip}</p></aside>}
            <p className="review-source">Fonte: {exercise.sourceReference || "conteúdo da trilha"}</p>
          </section>
          <div className="review-explain-actions" aria-label="Opções de explicação">
            <button onClick={() => openTutor("child")}>Explique para uma criança</button>
            <button onClick={() => openTutor("detailed")}>Mais detalhes</button>
            <button onClick={() => openTutor("question")}>Fazer uma pergunta</button>
          </div>
          <TutorPanel open={tutorOpen} style={tutorStyle} question={tutorQuestion} answer={tutorAnswer} busy={tutorBusy} error={tutorError} onQuestionChange={setTutorQuestion} onAsk={() => void askTutor(tutorQuestion, tutorStyle)} />
        </div> : <>
          <h2>{exercise.prompt}</h2>
          {flashcard ? <div className="review-flashcard">{!revealed ? <button onClick={() => setRevealed(true)}>Revelar resposta</button> : <><p>{exercise.answer}</p><div><button disabled={Boolean(attempt)} onClick={() => handleGrade({ correct: true, missingPoints: [], feedback: exercise.explanation, referenceAnswer: exercise.answer }, "Autoavaliação: lembrei", undefined, eventTime())}>Acertei</button><button disabled={Boolean(attempt)} onClick={() => handleGrade({ correct: false, missingPoints: [], feedback: exercise.explanation, referenceAnswer: exercise.answer }, "Autoavaliação: não lembrei", undefined, eventTime())}>Errei</button></div></>}</div>
          : exercise.type === "ordering" ? <div className="review-options"><p>Toque nos passos na ordem correta.</p>{current.optionOrder.map(i => <button key={i} disabled={grading || Boolean(attempt) || draft.split("|").includes(exercise.options[i])} onClick={() => setDraft(currentDraft => [currentDraft, exercise.options[i]].filter(Boolean).join("|"))}>{exercise.options[i]}</button>)}<p>Sua ordem: {draft.replaceAll("|", " → ")}</p><button disabled={grading || Boolean(attempt)} onClick={() => setDraft("")}>Refazer ordem</button></div>
          : exercise.type === "matching" ? <div className="review-options">{exercise.answer.split("|").map(pair => pair.split("=>").map(p => p.trim())).map(([left], index) => <label key={left}>{left}<select disabled={grading || Boolean(attempt)} value={draft.split("|")[index]?.split("=>")[1] || ""} onChange={e => { const values = draft.split("|"); values[index] = `${left}=>${e.target.value}`; setDraft(values.join("|")); }}><option value="">Selecione</option>{exercise.answer.split("|").map(p => p.split("=>")[1]?.trim()).sort().map(right => <option key={right}>{right}</option>)}</select></label>)}</div>
          : exercise.options.length ? <div className="review-options">{current.optionOrder.map(i => { const id = `${exercise.id}:option:${i}`; return <button key={id} disabled={grading || Boolean(attempt) || expired} aria-pressed={draft === id} onClick={() => setDraft(id)}>{exercise.options[i]}</button>; })}</div>
          : <label className="review-written"><span>Sua resposta</span><textarea autoComplete="off" maxLength={6000} value={draft} disabled={grading || Boolean(attempt)} onChange={e => setDraft(e.target.value)} onBlur={persistTransient} placeholder="Explique com suas palavras." /></label>}
          {error && <div role="alert" className="review-service-error"><p>{error}</p><button onClick={() => void check()} disabled={grading}>Tentar novamente</button></div>}
          {attempt && <section className={`review-verdict ${attempt.grade.correct ? "correct" : "wrong"}`} role="status"><h3>{attempt.grade.correct ? "Correto" : "Errado"}</h3>{session.mode !== "speed" && <><p>{attempt.grade.feedback}</p><h4>Resposta de referência</h4><p>{attempt.grade.referenceAnswer}</p><small>Esta é uma forma de responder, não a única aceita.</small>{exercise.optionExplanations?.length ? <details><summary>Por que cada alternativa?</summary>{exercise.options.map((o, i) => <p key={i}><b>{o}:</b> {exercise.optionExplanations?.[i]}</p>)}</details> : null}<p><small>Fonte: {exercise.sourceReference || "Referência não informada nesta questão."}</small></p></>}</section>}
          {session.mode !== "speed" && <section className="review-tutor"><div className="review-tutor-chips"><button onClick={() => openTutor("child")}>Explique para uma criança</button><button onClick={() => openTutor("detailed")}>Mais detalhes</button><button onClick={() => tutorOpen ? setTutorOpen(false) : openTutor("question")}>{tutorOpen ? "Fechar tutor" : "Fazer uma pergunta"}</button></div><TutorPanel open={tutorOpen} style={tutorStyle} question={tutorQuestion} answer={tutorAnswer} busy={tutorBusy} error={tutorError} onQuestionChange={setTutorQuestion} onAsk={() => void askTutor(tutorQuestion, tutorStyle)} /></section>}
        </>}
      </article>}
    </div>
    {!session.finished && <footer className="review-app-actions">{session.mode === "estudar" && !taught ? <button className="review-understood" onClick={() => { setTaught(true); setTutorOpen(false); scroll.current?.scrollTo({ top: 0, behavior: "smooth" }); }}>Entendi, continuar</button> : <><button disabled={grading || Boolean(attempt)} onClick={() => next(true)}>Pular</button>{expired ? <button onClick={() => finish()}>Finalizar Speed Run</button> : attempt ? <button onClick={() => next()}>{session.index + 1 === session.items.length ? "Concluir" : "Próxima"}</button> : <button disabled={grading || flashcard || !draft.trim()} onClick={() => void check()}>{grading ? "Corrigindo…" : "Responder"}</button>}</>}</footer>}
  </section>;
}
