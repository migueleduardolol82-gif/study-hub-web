"use client";

import { ArrowRight, Award, BrainCircuit, Check, CheckCircle2, Flame, Heart, Layers3, LoaderCircle, LockKeyhole, Plus, RotateCcw, Sparkles, Star, Target, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { requestAI } from "@/lib/ai-client";
import { ApiClientError } from "@/lib/api-contract";
import { emptyPathProgress, type LearningExercise, type LearningLesson, type LearningPath, type PathProgress, type StudyMapRecord, type ThemeRecord, type ThemeDifficulty } from "@/lib/learning";
import { DocumentUploadPanel } from "@/components/document-upload-panel";
import { analyzeStudyDocuments } from "@/lib/document-analysis-client";
import type { StudyDocument } from "@/lib/study-documents";

const kindLabels: Record<LearningExercise["type"], string> = {
  multiple_choice: "Múltipla escolha", true_false: "Verdadeiro ou falso", fill_blank: "Complete a lacuna",
  matching: "Relacione as colunas", ordering: "Ordene as etapas", flashcard: "Flashcard",
  typed: "Resposta digitada", case_study: "Estudo de caso", ai_question: "Questão da IA",
  error_review: "Revisão de erro", mock_exam: "Simulado",
  open_question: "Pergunta aberta", calculation: "Cálculo", error_identification: "Identificação de erro", cumulative_review: "Revisão cumulativa",
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function answerIsCorrect(exercise: LearningExercise, answer: string) {
  const expected = normalize(exercise.answer);
  const received = normalize(answer);
  if (!received) return false;
  if (["multiple_choice", "true_false", "fill_blank", "ordering", "matching"].includes(exercise.type)) return received === expected;
  return received === expected;
}

function optionId(exercise: LearningExercise, index: number) { return `${exercise.id}:option:${index}`; }
function answerValue(exercise: LearningExercise, value: string) {
  const index = exercise.options.findIndex((_, position) => optionId(exercise, position) === value);
  return index >= 0 ? exercise.options[index] : value;
}

function updateStreak(progress: PathProgress) {
  const today = new Date().toISOString().slice(0, 10);
  if (progress.lastStudyDate === today) return progress.streak;
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return progress.lastStudyDate === yesterday.toISOString().slice(0, 10) ? progress.streak + 1 : 1;
}

export function ActiveReview({ paths, setPaths, progressByPath, setProgressByPath, themes, maps, materialContext, documents, setDocuments, notify }: {
  paths: LearningPath[];
  setPaths: React.Dispatch<React.SetStateAction<LearningPath[]>>;
  progressByPath: Record<string, PathProgress>;
  setProgressByPath: React.Dispatch<React.SetStateAction<Record<string, PathProgress>>>;
  themes: ThemeRecord[];
  maps: StudyMapRecord[];
  materialContext: string;
  documents: StudyDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<StudyDocument[]>>;
  notify: (message: string) => void;
}) {
  const [activePathId, setActivePathId] = useState(paths[0]?.id || "");
  const [themeId, setThemeId] = useState("");
  const [mapId, setMapId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [difficulty, setDifficulty] = useState<ThemeDifficulty>("iniciante");
  const [includeMaterial, setIncludeMaterial] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [depth, setDepth] = useState("equilibrado");
  const [requestedUnits, setRequestedUnits] = useState(0);
  const [learningMode, setLearningMode] = useState("estudar");
  const [previewPath, setPreviewPath] = useState<LearningPath | null>(null);
  const [previewUnitIds, setPreviewUnitIds] = useState<string[]>([]);
  const [speedSeconds, setSpeedSeconds] = useState(60);
  const [retryLesson, setRetryLesson] = useState<{ path: LearningPath; lesson: LearningLesson } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [generationError, setGenerationError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionWrong, setSessionWrong] = useState<string[]>([]);
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, { selected: string; correct: string; wasCorrect: boolean }>>({});
  const [hearts, setHearts] = useState(3);
  const [resultOpen, setResultOpen] = useState(false);

  const activePath = paths.find((path) => path.id === activePathId) || paths[0];
  const progress = activePath ? progressByPath[activePath.id] || emptyPathProgress : emptyPathProgress;
  const flatLessons = activePath?.units.flatMap((unit) => unit.lessons) || [];
  const completed = new Set(progress.completedLessonIds);
  const currentExercise = lesson?.exercises[exerciseIndex];
  const level = progress.xp ? Math.floor(progress.xp / 500) + 1 : 1;
  const percent = flatLessons.length ? Math.round(completed.size / flatLessons.length * 100) : 0;
  const wrongIds = Object.values(progress.lessonResults).flatMap((result) => result.wrongExerciseIds).filter((id) => (progress.mastery?.[id] || 0) < 2);
  const reviewRecommendations = activePath
    ? activePath.units.flatMap((unit) => unit.lessons).filter((item) => item.exercises.some((exercise) => wrongIds.includes(exercise.id))).slice(0, 3)
    : [];
  const errorEntries = activePath ? Object.entries(progress.lessonResults).flatMap(([lessonId, result]) => {
    const sourceLesson = flatLessons.find((item) => item.id === lessonId);
    return Object.entries(result.answers || {}).filter(([exerciseId, attempt]) => !attempt.wasCorrect && wrongIds.includes(exerciseId)).map(([exerciseId, attempt]) => ({ exerciseId, lesson: sourceLesson, exercise: sourceLesson?.exercises.find((item) => item.id === exerciseId), attempt }));
  }) : [];

  useEffect(() => {
    if (!lesson || resultOpen || learningMode !== "speed" || speedSeconds <= 0) return;
    const timer = window.setInterval(() => setSpeedSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [lesson, resultOpen, learningMode, speedSeconds]);

  function openLesson(item: LearningLesson) {
    setLesson(item); setExerciseIndex(0); setAnswer(""); setFeedback(null); setSessionCorrect(0); setSessionWrong([]); setSessionAnswers({}); setHearts(3); setResultOpen(false); setOrdered([]); setMatches({}); setRevealed(false); setSpeedSeconds(60);
  }

  async function prepareLesson(path: LearningPath, item: LearningLesson, signal: AbortSignal, open = true) {
    if (item.exercises.length) { if (open) openLesson(item); return; }
    setGenerationStage(`Preparando explicação e exercícios: ${item.title}`);
    setRetryLesson({ path, lesson: item });
    const unit = path.units.find((unit) => unit.lessons.some((candidate) => candidate.id === item.id));
    const lessons = path.units.flatMap((unit) => unit.lessons);
    const prepared = await requestAI<{ studyNotes: string; exercises: LearningExercise[] }>("/api/learning/generate", {
      ...path.source, theme: path.source?.theme || path.title, mode: "lesson", difficulty: learningMode === "hard" ? "avancado" : item.difficulty, learningMode,
      lessonTitle: item.title, lessonDescription: item.description, unitTitle: unit?.title,
      lessonReferences: item.references,
      previousLessons: lessons.slice(0, lessons.findIndex((candidate) => candidate.id === item.id)).map((candidate) => candidate.title),
    }, signal);
    if (!Array.isArray(prepared.exercises) || prepared.exercises.length < 4) throw new Error("A lição chegou incompleta. Tente preparar esta lição novamente.");
    const ready = { ...item, ...prepared };
    setPaths((current) => current.map((candidate) => candidate.id !== path.id ? candidate : { ...candidate, updatedAt: new Date().toISOString(), units: candidate.units.map((unit) => ({ ...unit, lessons: unit.lessons.map((lesson) => lesson.id === item.id ? ready : lesson) })) }));
    setRetryLesson(null);
    if (open) openLesson(ready);
  }

  function showGenerationError(error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir esta etapa.";
    setGenerationError({ message, retryable: error instanceof ApiClientError ? error.retryable : true });
    notify(message);
  }

  async function generatePath() {
    if (requestRef.current) return;
    const theme = themes.find((item) => item.id === themeId);
    const map = maps.find((item) => item.id === mapId);
    const title = theme?.name || map?.name || prompt.trim();
    if (!title) { notify("Escolha um tema, mapa ou descreva o que deseja aprender."); return; }
    const controller = new AbortController(); requestRef.current = controller;
    setBusy(true); setGenerationError(null); setRetryLesson(null); setGenerationStage("Organizando unidades e objetivos de cada lição…");
    try {
      const selectedDocuments = documents.filter((item) => item.selected && item.status === "ready");
      const documentSource = selectedDocuments.length ? await analyzeStudyDocuments(selectedDocuments, setGenerationStage, controller.signal) : "";
      setGenerationStage("Organizando unidades, referências e objetivos…");
      const path = await requestAI<LearningPath>("/api/learning/generate", {
        mode: "outline", theme: title, difficulty,
        depth, requestedUnits,
        goal: [prompt, theme?.objective, theme?.description, map?.objective].filter(Boolean).join("\n"),
        topics: map?.mapping.topics.map((topic) => topic.title) || [],
        content: [documentSource, sourceText, includeMaterial ? materialContext : ""].filter(Boolean).join("\n\n"),
      }, controller.signal);
      if (!path.id || !Array.isArray(path.units) || !path.units[0]?.lessons?.length) throw new Error("A trilha chegou incompleta.");
      const linked = { ...path, themeId: theme?.id, mapId: map?.id, documentIds: selectedDocuments.map((item) => item.id) };
      setPreviewPath(linked);
      setPreviewUnitIds(linked.units.map((unit) => unit.id));
      notify(`Prévia de “${linked.title}” pronta. Revise as unidades antes de salvar.`);
    } catch (error) { showGenerationError(error); }
    finally { requestRef.current = null; setBusy(false); setGenerationStage(""); }
  }

  async function startLesson(item: LearningLesson, unlocked: boolean, path = activePath) {
    if (!unlocked || !path || requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller;
    setActivePathId(path.id); setBusy(true); setGenerationError(null);
    try { await prepareLesson(path, item, controller.signal); }
    catch (error) { showGenerationError(error); }
    finally { requestRef.current = null; setBusy(false); setGenerationStage(""); }
  }

  function checkAnswer() {
    if (!currentExercise || feedback) return;
    const selected = answerValue(currentExercise, answer);
    const correct = answerIsCorrect(currentExercise, selected);
    setFeedback({ correct, message: correct ? currentExercise.explanation : `Resposta esperada: ${currentExercise.answer}. ${currentExercise.explanation}` });
    setSessionAnswers((current) => ({ ...current, [currentExercise.id]: { selected, correct: currentExercise.answer, wasCorrect: correct } }));
    if (correct) setSessionCorrect((value) => value + 1);
    else { setSessionWrong((current) => [...current, currentExercise.id]); setHearts((value) => Math.max(0, value - 1)); }
  }

  function finishLesson() {
    if (!lesson) return;
    const finalCorrect = sessionCorrect;
    const earned = Math.round(lesson.xp * (finalCorrect / lesson.exercises.length));
    const now = new Date().toISOString();
    if (activePath) setProgressByPath((current) => {
      const previous = current[activePath.id] || emptyPathProgress;
      const priorResult = previous.lessonResults[lesson.id];
      const priorXp = priorResult ? Math.round(lesson.xp * priorResult.correct / priorResult.total) : 0;
      const extraXp = Math.max(0, earned - priorXp);
      const achievements = [...previous.achievements];
      if (!achievements.includes("Primeira lição")) achievements.push("Primeira lição");
      if (previous.xp + extraXp >= 500 && !achievements.includes("500 XP")) achievements.push("500 XP");
      const mastery = { ...(previous.mastery || {}) };
      Object.entries(sessionAnswers).forEach(([exerciseId, attempt]) => { mastery[exerciseId] = attempt.wasCorrect ? (mastery[exerciseId] || 0) + 1 : 0; });
      const challengePassed = learningMode !== "desafio" || finalCorrect / lesson.exercises.length >= .7;
      const score = Math.round(finalCorrect / lesson.exercises.length * 100);
      const speedRecords = learningMode === "speed" ? { ...(previous.speedRecords || {}), [lesson.id]: Math.max(score, previous.speedRecords?.[lesson.id] || 0) } : previous.speedRecords || {};
      return { ...current, [activePath.id]: { ...previous, xp: previous.xp + extraXp, streak: updateStreak(previous), lastStudyDate: now.slice(0, 10), completedLessonIds: challengePassed ? [...new Set([...previous.completedLessonIds, lesson.id])] : previous.completedLessonIds, lessonResults: { ...previous.lessonResults, [lesson.id]: { correct: Math.max(finalCorrect, priorResult?.correct || 0), total: lesson.exercises.length, wrongExerciseIds: sessionWrong, completedAt: now, answers: sessionAnswers } }, achievements, mastery, speedRecords } };
    });
    setResultOpen(true);
  }

  function nextExercise() {
    if (!lesson) return;
    if (exerciseIndex < lesson.exercises.length - 1) { setExerciseIndex((value) => value + 1); setAnswer(""); setFeedback(null); setOrdered([]); setMatches({}); setRevealed(false); return; }
    finishLesson();
  }

  function moveUnit(index: number, direction: -1 | 1) {
    if (!activePath) return;
    const target = index + direction;
    if (target < 0 || target >= activePath.units.length) return;
    setPaths((current) => current.map((path) => {
      if (path.id !== activePath.id) return path;
      const units = [...path.units];
      [units[index], units[target]] = [units[target], units[index]];
      return { ...path, units, updatedAt: new Date().toISOString() };
    }));
  }

  function moveLesson(unitId: string, index: number, direction: -1 | 1) {
    if (!activePath) return;
    setPaths((current) => current.map((path) => path.id !== activePath.id ? path : { ...path, updatedAt: new Date().toISOString(), units: path.units.map((unit) => {
      if (unit.id !== unitId) return unit;
      const target = index + direction;
      if (target < 0 || target >= unit.lessons.length) return unit;
      const lessons = [...unit.lessons];
      [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
      return { ...unit, lessons };
    }) }));
  }

  function updatePreview(change: (path: LearningPath) => LearningPath) { setPreviewPath((current) => current ? change(current) : current); }
  function renamePreviewUnit(unitId: string) { const unit = previewPath?.units.find((item) => item.id === unitId); if (!unit) return; const title = window.prompt("Novo nome da unidade", unit.title)?.trim(); if (title) updatePreview((path) => ({ ...path, units: path.units.map((item) => item.id === unitId ? { ...item, title } : item) })); }
  function editPreviewUnit(unitId: string) { const unit = previewPath?.units.find((item) => item.id === unitId); if (!unit) return; const description = window.prompt("Descrição da unidade", unit.description)?.trim(); if (description === undefined) return; const objective = window.prompt("Objetivo de aprendizagem", unit.objective || "")?.trim(); if (objective === undefined) return; updatePreview((path) => ({ ...path, units: path.units.map((item) => item.id === unitId ? { ...item, description, objective } : item) })); }
  async function regeneratePreviewUnit(unitId: string) {
    if (!previewPath || requestRef.current) return;
    const currentUnit = previewPath.units.find((unit) => unit.id === unitId);
    if (!currentUnit) return;
    const controller = new AbortController(); requestRef.current = controller; setBusy(true); setGenerationError(null); setGenerationStage(`Regenerando apenas “${currentUnit.title}”…`);
    try {
      const selectedDocuments = documents.filter((item) => item.selected && item.status === "ready");
      const documentSource = selectedDocuments.length ? await analyzeStudyDocuments(selectedDocuments, setGenerationStage, controller.signal) : previewPath.source?.content || "";
      const replacement = await requestAI<LearningPath>("/api/learning/generate", { mode: "outline", theme: currentUnit.title, difficulty, depth, requestedUnits: 2, goal: `Regere a unidade ${currentUnit.title}: ${currentUnit.description}. As duas unidades devolvidas devem representar partes sequenciais desta mesma unidade.`, topics: currentUnit.contents || [], content: documentSource }, controller.signal);
      const merged = replacement.units.reduce((first, unit, index) => index === 0 ? unit : { ...first, description: `${first.description} ${unit.description}`, contents: [...(first.contents || []), ...(unit.contents || [])], concepts: [...(first.concepts || []), ...(unit.concepts || [])], references: [...new Set([...(first.references || []), ...(unit.references || [])])], lessons: [...first.lessons, ...unit.lessons] });
      updatePreview((path) => ({ ...path, units: path.units.map((unit) => unit.id === unitId ? { ...merged, id: unitId } : unit) }));
      notify(`A unidade “${currentUnit.title}” foi regenerada sem alterar as demais.`);
    } catch (error) { showGenerationError(error); }
    finally { requestRef.current = null; setBusy(false); setGenerationStage(""); }
  }
  function addPreviewUnit() { if (!previewPath) return; const id = `unit-${crypto.randomUUID()}`; updatePreview((path) => ({ ...path, units: [...path.units, { id, title: "Nova unidade", description: "Edite a descrição e as lições.", objective: "Defina o objetivo", contents: [], concepts: [], references: [], lessons: [] }] })); setPreviewUnitIds((current) => [...current, id]); }
  function deletePreviewUnit(unitId: string) { updatePreview((path) => ({ ...path, units: path.units.filter((unit) => unit.id !== unitId) })); setPreviewUnitIds((current) => current.filter((id) => id !== unitId)); }
  function splitPreviewUnit(unitId: string) { updatePreview((path) => { const index = path.units.findIndex((unit) => unit.id === unitId); const unit = path.units[index]; if (!unit || unit.lessons.length < 2) return path; const middle = Math.ceil(unit.lessons.length / 2); const id = `unit-${crypto.randomUUID()}`; setPreviewUnitIds((current) => [...current, id]); const units = [...path.units]; units.splice(index, 1, { ...unit, lessons: unit.lessons.slice(0, middle) }, { ...unit, id, title: `${unit.title} — continuação`, lessons: unit.lessons.slice(middle) }); return { ...path, units }; }); }
  function mergePreviewUnit(index: number) { updatePreview((path) => { if (index < 1) return path; const previous = path.units[index - 1]; const current = path.units[index]; const merged = { ...previous, title: `${previous.title} + ${current.title}`, description: `${previous.description} ${current.description}`, contents: [...(previous.contents || []), ...(current.contents || [])], concepts: [...(previous.concepts || []), ...(current.concepts || [])], references: [...new Set([...(previous.references || []), ...(current.references || [])])], lessons: [...previous.lessons, ...current.lessons] }; return { ...path, units: [...path.units.slice(0, index - 1), merged, ...path.units.slice(index + 1)] }; }); }
  function savePreview() { if (!previewPath) return; const selected = previewPath.units.filter((unit) => previewUnitIds.includes(unit.id)); if (!selected.length) { notify("Selecione pelo menos uma unidade."); return; } const saved = { ...previewPath, units: selected, updatedAt: new Date().toISOString() }; setPaths((current) => [saved, ...current]); setProgressByPath((current) => ({ ...current, [saved.id]: { ...emptyPathProgress } })); setActivePathId(saved.id); setPreviewPath(null); setPreviewUnitIds([]); notify(`Trilha “${saved.title}” salva. Abra uma lição para gerar a aula e as atividades.`); }

  if (lesson && currentExercise && !resultOpen) return <div className="lesson-player">
    <header><button onClick={() => setLesson(null)} aria-label="Sair da lição"><X /></button><div><span>{learningMode === "speed" ? `Speed Run · ${speedSeconds}s` : `Lição · ${learningMode}`}</span><i><b style={{ width: `${((exerciseIndex + 1) / lesson.exercises.length) * 100}%` }} /></i></div><span className="hearts"><Heart size={18} fill="currentColor" /> {hearts}</span></header>
    <main className="lesson-stage panel"><span className="exercise-kind">{kindLabels[currentExercise.type]}</span><h2>{currentExercise.prompt}</h2>
      {lesson.studyNotes && <details className="lesson-notes"><summary>Explicação e exemplo desta lição</summary><p>{lesson.studyNotes}</p></details>}
      {currentExercise.type === "ordering" ? <div className="learning-options"><p>Selecione os passos na ordem correta.</p>{currentExercise.options.map((option) => <button key={option} disabled={Boolean(feedback) || ordered.includes(option)} onClick={() => { const next = [...ordered, option]; setOrdered(next); setAnswer(next.length === currentExercise.options.length ? next.join("|") : ""); }}>{ordered.includes(option) ? `${ordered.indexOf(option) + 1}. ` : ""}{option}</button>)}<button disabled={Boolean(feedback)} onClick={() => { setOrdered([]); setAnswer(""); }}>Refazer ordem</button></div>
      : currentExercise.type === "matching" && currentExercise.answer.includes("=>") ? <div className="matching-options">{currentExercise.answer.split("|").map((pair) => pair.split("=>").map((part) => part.trim())).map(([left]) => <label key={left}><span>{left}</span><select disabled={Boolean(feedback)} value={matches[left] || ""} onChange={(event) => { const next = { ...matches, [left]: event.target.value }; setMatches(next); const pairs = currentExercise.answer.split("|").map((pair) => pair.split("=>").map((part) => part.trim())); setAnswer(pairs.every(([key]) => next[key]) ? pairs.map(([key]) => `${key}=>${next[key]}`).join("|") : ""); }}><option value="">Relacionar com…</option>{currentExercise.answer.split("|").map((pair) => pair.split("=>")[1].trim()).sort((a, b) => a.localeCompare(b)).map((right) => <option key={right} value={right}>{right}</option>)}</select></label>)}</div>
      : currentExercise.type === "flashcard" ? <div className="flashcard-recall">{!revealed ? <button className="outline-button" onClick={() => setRevealed(true)}>Pense na resposta e vire o cartão</button> : <><p>{currentExercise.answer}</p><button disabled={Boolean(feedback)} onClick={() => { setAnswer(currentExercise.answer); setFeedback({ correct: true, message: currentExercise.explanation }); setSessionCorrect((n) => n + 1); setSessionAnswers((items) => ({ ...items, [currentExercise.id]: { selected: "Lembrei", correct: currentExercise.answer, wasCorrect: true } })); }}>Lembrei</button><button disabled={Boolean(feedback)} onClick={() => { setAnswer("revisar"); setFeedback({ correct: false, message: currentExercise.explanation }); setSessionWrong((items) => [...items, currentExercise.id]); setSessionAnswers((items) => ({ ...items, [currentExercise.id]: { selected: "Preciso revisar", correct: currentExercise.answer, wasCorrect: false } })); setHearts((n) => Math.max(0, n - 1)); }}>Preciso revisar</button></>}</div>
      : currentExercise.options.length > 0 ? <div className="learning-options">{currentExercise.options.map((option, index) => { const id = optionId(currentExercise, index); return <button key={id} className={answer === id ? "selected" : ""} onClick={() => !feedback && setAnswer(id)} disabled={Boolean(feedback)}>{option}</button>; })}</div> : <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={Boolean(feedback)} placeholder={currentExercise.type === "case_study" ? "Analise o caso e justifique sua decisão..." : "Digite sua resposta..."} />}
      {feedback && <div className={`lesson-feedback ${feedback.correct ? "correct" : "wrong"}`} role="status">{feedback.correct ? <CheckCircle2 /> : <RotateCcw />}<p><strong>{feedback.correct ? "Resposta correta" : "Vamos revisar"}</strong>{feedback.message}{currentExercise.optionExplanations?.length ? <span className="option-explanations">{currentExercise.options.map((option, index) => <small key={option}><b>{option}:</b> {currentExercise.optionExplanations?.[index]}</small>)}</span> : null}{currentExercise.sourceReference && <small className="source-reference">Fonte: {currentExercise.sourceReference}</small>}</p></div>}
      <div className="lesson-action-bar"><button type="button" onClick={() => setLesson(null)}>Sair</button><button type="button" disabled={Boolean(feedback)} onClick={nextExercise}>Pular</button>{learningMode === "speed" && speedSeconds === 0 ? <button className="primary-button lesson-next" onClick={finishLesson}>Finalizar Speed Run</button> : <button className="primary-button lesson-next" disabled={!answer.trim() || (currentExercise.type === "flashcard" && !feedback)} onClick={feedback ? nextExercise : checkAnswer}>{feedback ? exerciseIndex === lesson.exercises.length - 1 ? "Concluir lição" : "Continuar" : "Verificar"} <ArrowRight size={17} /></button>}</div>
    </main>
  </div>;

  if (lesson && resultOpen) {
    const score = Math.round(sessionCorrect / lesson.exercises.length * 100);
    return <section className="lesson-result panel"><Trophy size={46} /><span className="eyebrow">{learningMode === "desafio" ? "DESAFIO FINALIZADO" : "LIÇÃO CONCLUÍDA"}</span><h2>{lesson.title}</h2><div><article><strong>{score}%</strong><small>acerto</small></article><article><strong>+{Math.round(lesson.xp * sessionCorrect / lesson.exercises.length)}</strong><small>XP</small></article><article><strong>{sessionWrong.length}</strong><small>para revisar</small></article></div><p>{learningMode === "desafio" && score < 70 ? "Você precisa de 70% para liberar a próxima etapa. Revise os erros e tente novamente." : sessionWrong.length ? "Os erros foram salvos e voltarão nas recomendações de revisão." : "Desempenho perfeito. A próxima lição foi desbloqueada."}</p>{learningMode === "speed" && <p>Recorde nesta lição: {Math.max(score, progress.speedRecords?.[lesson.id] || 0)}%.</p>}<button className="primary-button" onClick={() => { setLesson(null); setResultOpen(false); }}>Voltar ao caminho</button></section>;
  }

  return <div className="learning-page">
    <section className="learning-hero"><div><span className="eyebrow lime">APRENDIZADO ATIVO</span><h2>Um caminho progressivo para qualquer tema.</h2><p>Unidades, lições, erros e conquistas ficam ligados ao seu tema, mapa e conta.</p></div>{activePath && <div className="learning-stats"><span><Star /> <strong>{progress.xp} XP</strong></span><span><Flame /> <strong>{progress.streak} dias</strong></span><span><Trophy /> <strong>Nível {level}</strong></span></div>}</section>

    <DocumentUploadPanel documents={documents} setDocuments={setDocuments} title="Criar unidades com arquivos" notify={notify} />

    <section className="learning-modes panel"><span className="eyebrow">MODO DE APRENDIZAGEM</span><div>{[
      ["estudar", "Estudar"], ["memorizar", "Memorizar"], ["speed", "Speed Run"], ["hard", "Hard Mode"], ["revisao", "Revisão"], ["desafio", "Desafio"],
    ].map(([id, label]) => <button type="button" key={id} aria-pressed={learningMode === id} className={learningMode === id ? "active" : ""} onClick={() => setLearningMode(id)}>{label}</button>)}</div><small>O modo escolhido adapta explicações, dificuldade e exercícios da próxima lição preparada.</small></section>

    <section className="learning-generator panel"><div className="panel-heading"><div><span className="eyebrow">GERADOR DE TRILHAS COM IA</span><h3>Converta seu material em unidades e exercícios</h3></div><Sparkles /></div><div className="learning-generator-grid"><label><span>Tema</span><select value={themeId} onChange={(event) => { setThemeId(event.target.value); const selected = themes.find((item) => item.id === event.target.value); if (selected) setDifficulty(selected.difficulty); }}><option value="">Escolher tema</option>{themes.filter((theme) => !theme.archived).map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><label><span>Mapa</span><select value={mapId} onChange={(event) => setMapId(event.target.value)}><option value="">Escolher mapa</option>{maps.filter((map) => map.status !== "archived").map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label><label><span>Nível inicial</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as ThemeDifficulty)}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label><label><span>Profundidade</span><select value={depth} onChange={(event) => setDepth(event.target.value)}><option value="rapido">Rápida</option><option value="equilibrado">Equilibrada</option><option value="aprofundado">Aprofundada</option></select></label><label><span>Quantidade aproximada</span><select value={requestedUnits} onChange={(event) => setRequestedUnits(Number(event.target.value))}><option value={0}>Automática</option>{Array.from({ length: 19 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} unidades</option>)}</select></label><label className="wide-field"><span>Pedido personalizado</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: ensine do zero, priorize prática e crie estudos de caso..." /></label><label className="wide-field"><span>Texto de referência (opcional)</span><textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Cole um trecho específico que deseja estudar." /></label><label className="wide-field check-field"><input type="checkbox" checked={includeMaterial} disabled={!materialContext.trim()} onChange={(event) => setIncludeMaterial(event.target.checked)} /> Usar também a apostila e a aula da área de Estudos</label></div><button className="primary-button" onClick={generatePath} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />} {busy ? "Gerando por etapas…" : "Analisar fontes e criar prévia"}</button>{busy && <p className="generation-status" role="status"><LoaderCircle className="spin" size={16} />{generationStage}<button className="text-button" onClick={() => requestRef.current?.abort()}>Interromper</button></p>}<p className="generation-help">Cada parte dos arquivos é analisada e guardada. Se houver falha, tente novamente: as partes prontas serão reutilizadas.</p>{generationError && <div className="inline-error"><span>{generationError.message}</span>{generationError.retryable && <button disabled={busy} onClick={() => retryLesson ? startLesson(retryLesson.lesson, true, retryLesson.path) : generatePath()}><RotateCcw size={15} /> Tentar novamente</button>}</div>}</section>

    {previewPath && <section className="unit-preview panel"><div className="panel-heading"><div><span className="eyebrow">PRÉVIA ANTES DE SALVAR</span><h3>{previewPath.title}</h3></div><button type="button" className="outline-button compact" onClick={addPreviewUnit}><Plus /> Adicionar unidade</button></div><p>Selecione, edite, regenere, divida, junte e reorganize. As referências usadas permanecem visíveis.</p><div>{previewPath.units.map((unit, index) => <article key={unit.id}><label><input type="checkbox" checked={previewUnitIds.includes(unit.id)} onChange={(event) => setPreviewUnitIds((current) => event.target.checked ? [...current, unit.id] : current.filter((id) => id !== unit.id))} /><span><strong>Unidade {index + 1}: {unit.title}</strong><small>{unit.objective || unit.description}</small></span></label><p>{unit.contents?.join(" · ")}</p><small>{unit.references?.join("; ")}</small><div><button type="button" onClick={() => renamePreviewUnit(unit.id)}>Renomear</button><button type="button" onClick={() => editPreviewUnit(unit.id)}>Editar conteúdo</button><button type="button" disabled={busy} onClick={() => void regeneratePreviewUnit(unit.id)}>Regenerar unidade</button><button type="button" disabled={unit.lessons.length < 2} onClick={() => splitPreviewUnit(unit.id)}>Dividir</button><button type="button" disabled={index === 0} onClick={() => mergePreviewUnit(index)}>Juntar à anterior</button><button type="button" disabled={index === 0} onClick={() => updatePreview((path) => { const units = [...path.units]; [units[index - 1], units[index]] = [units[index], units[index - 1]]; return { ...path, units }; })}>↑</button><button type="button" disabled={index === previewPath.units.length - 1} onClick={() => updatePreview((path) => { const units = [...path.units]; [units[index + 1], units[index]] = [units[index], units[index + 1]]; return { ...path, units }; })}>↓</button><button type="button" className="danger" onClick={() => deletePreviewUnit(unit.id)}>Excluir</button></div></article>)}</div><button className="primary-button wide" type="button" onClick={savePreview}><Check /> Salvar {previewUnitIds.length} unidade(s)</button></section>}

    {paths.length > 0 && <div className="path-selector">{paths.map((path) => <button disabled={busy} key={path.id} className={path.id === activePath?.id ? "active" : ""} onClick={() => setActivePathId(path.id)}><BrainCircuit size={16} />{path.title}</button>)}</div>}
    {activePath ? <div className="learning-layout"><aside className="path-summary panel"><span className="eyebrow">PROGRESSO DA TRILHA</span><strong>{percent}%</strong><i><b style={{ width: `${percent}%` }} /></i><small>{completed.size} de {flatLessons.length} lições</small><div><span><Award size={16} /> {progress.achievements.length} conquistas</span><span><Layers3 size={16} /> {activePath.units.length} unidades</span></div><button className="outline-button compact" onClick={() => setPaths((current) => current.map((path) => path.id === activePath.id ? { ...path, unlockAll: !path.unlockAll } : path))}>{activePath.unlockAll ? "Usar progressão" : "Liberar todas"}</button>{reviewRecommendations.length > 0 && <section><strong>Caderno de erros · {wrongIds.length}</strong>{reviewRecommendations.map((item) => <button key={item.id} onClick={() => { setLearningMode("revisao"); void startLesson(item, true); }}><Target size={14} /> {item.title}</button>)}{errorEntries.slice(0, 4).map((entry) => <article className="error-entry" key={entry.exerciseId}><small>{entry.exercise?.prompt}</small><span>Sua resposta: {entry.attempt.selected}</span><span>Correta: {entry.attempt.correct}</span>{entry.exercise?.explanation && <p>{entry.exercise.explanation}</p>}</article>)}</section>}</aside><main className="learning-path">{activePath.units.map((unit, unitIndex) => <section key={unit.id} className="learning-unit"><header><div><span>UNIDADE {unitIndex + 1}</span><h3>{unit.title}</h3><p>{unit.description}</p>{unit.objective && <small>Objetivo: {unit.objective}</small>}{unit.references?.length ? <small>Fontes: {unit.references.join("; ")}</small> : null}</div><div className="order-controls"><button disabled={unitIndex === 0} onClick={() => moveUnit(unitIndex, -1)} aria-label="Mover unidade para cima">↑</button><button disabled={unitIndex === activePath.units.length - 1} onClick={() => moveUnit(unitIndex, 1)} aria-label="Mover unidade para baixo">↓</button></div></header><div>{unit.lessons.map((item, localIndex) => { const lessonIndex = flatLessons.findIndex((candidate) => candidate.id === item.id); const unlocked = Boolean(activePath.unlockAll) || lessonIndex === 0 || completed.has(flatLessons[lessonIndex - 1]?.id) || completed.has(item.id); const done = completed.has(item.id); return <article className="lesson-node" key={item.id}><button disabled={!unlocked || busy} className={`${unlocked ? "unlocked" : "locked"} ${done ? "done" : ""}`} onClick={() => startLesson(item, unlocked)}><span>{done ? <Check /> : unlocked ? <Star /> : <LockKeyhole />}</span><div><strong>{item.title}</strong><small>{item.difficulty} · {item.exercises.length ? `${item.exercises.length} exercícios` : "Preparar ao abrir"} · {item.xp} XP</small></div></button><div className="order-controls"><button disabled={localIndex === 0} onClick={() => moveLesson(unit.id, localIndex, -1)} aria-label="Mover lição para cima">↑</button><button disabled={localIndex === unit.lessons.length - 1} onClick={() => moveLesson(unit.id, localIndex, 1)} aria-label="Mover lição para baixo">↓</button></div></article>; })}<article className="unit-challenge"><button disabled={busy} onClick={() => { const last = unit.lessons.at(-1); if (last) { setLearningMode("desafio"); void startLesson(last, true); } }}><Trophy /> Desafio da unidade · mínimo 70%</button></article></div></section>)}</main></div> : <section className="entity-empty panel"><BrainCircuit size={32} /><strong>Nenhuma trilha criada</strong><p>Escolha um tema, mapa ou material e peça à IA para construir seu caminho personalizado.</p></section>}
  </div>;
}
