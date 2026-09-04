"use client";

import { ArrowRight, Award, BrainCircuit, Check, CheckCircle2, Flame, Heart, Layers3, LoaderCircle, LockKeyhole, RotateCcw, Sparkles, Star, Target, Trophy, X } from "lucide-react";
import { useState } from "react";
import { ApiClientError, readApiResponse } from "@/lib/api-contract";
import { emptyPathProgress, type LearningExercise, type LearningLesson, type LearningPath, type PathProgress, type StudyMapRecord, type ThemeRecord } from "@/lib/learning";

const kindLabels: Record<LearningExercise["type"], string> = {
  multiple_choice: "Múltipla escolha", true_false: "Verdadeiro ou falso", fill_blank: "Complete a lacuna",
  matching: "Relacione as colunas", ordering: "Ordene as etapas", flashcard: "Flashcard",
  typed: "Resposta digitada", case_study: "Estudo de caso", ai_question: "Questão da IA",
  error_review: "Revisão de erro", mock_exam: "Simulado",
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s|]/g, "").replace(/\s+/g, " ").trim();
}

function answerIsCorrect(exercise: LearningExercise, answer: string) {
  const expected = normalize(exercise.answer);
  const received = normalize(answer);
  if (!received) return false;
  if (["multiple_choice", "true_false", "fill_blank", "ordering", "matching"].includes(exercise.type)) return received === expected;
  const keywords = expected.split(/\s+/).filter((word) => word.length > 4);
  return received === expected || (keywords.length > 0 && keywords.filter((word) => received.includes(word)).length / keywords.length >= 0.7);
}

function updateStreak(progress: PathProgress) {
  const today = new Date().toISOString().slice(0, 10);
  if (progress.lastStudyDate === today) return progress.streak;
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return progress.lastStudyDate === yesterday.toISOString().slice(0, 10) ? progress.streak + 1 : 1;
}

export function ActiveReview({ paths, setPaths, progressByPath, setProgressByPath, themes, maps, materialContext, notify }: {
  paths: LearningPath[];
  setPaths: React.Dispatch<React.SetStateAction<LearningPath[]>>;
  progressByPath: Record<string, PathProgress>;
  setProgressByPath: React.Dispatch<React.SetStateAction<Record<string, PathProgress>>>;
  themes: ThemeRecord[];
  maps: StudyMapRecord[];
  materialContext: string;
  notify: (message: string) => void;
}) {
  const [activePathId, setActivePathId] = useState(paths[0]?.id || "");
  const [themeId, setThemeId] = useState("");
  const [mapId, setMapId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [generationError, setGenerationError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionWrong, setSessionWrong] = useState<string[]>([]);
  const [hearts, setHearts] = useState(3);
  const [resultOpen, setResultOpen] = useState(false);

  const activePath = paths.find((path) => path.id === activePathId) || paths[0];
  const progress = activePath ? progressByPath[activePath.id] || emptyPathProgress : emptyPathProgress;
  const flatLessons = activePath?.units.flatMap((unit) => unit.lessons) || [];
  const completed = new Set(progress.completedLessonIds);
  const currentExercise = lesson?.exercises[exerciseIndex];
  const level = progress.xp ? Math.floor(progress.xp / 500) + 1 : 1;
  const percent = flatLessons.length ? Math.round(completed.size / flatLessons.length * 100) : 0;
  const wrongIds = Object.values(progress.lessonResults).flatMap((result) => result.wrongExerciseIds);
  const reviewRecommendations = activePath
    ? activePath.units.flatMap((unit) => unit.lessons).filter((item) => item.exercises.some((exercise) => wrongIds.includes(exercise.id))).slice(0, 3)
    : [];

  async function generatePath() {
    const theme = themes.find((item) => item.id === themeId);
    const map = maps.find((item) => item.id === mapId);
    const title = theme?.name || map?.name || prompt.trim();
    if (!title) { notify("Escolha um tema, mapa ou descreva o que deseja aprender."); return; }
    setBusy(true); setGenerationError(null);
    try {
      const response = await fetch("/api/learning/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: title, goal: prompt || theme?.objective || map?.objective, topics: map?.mapping.topics.map((topic) => topic.title) || [], content: materialContext }),
      });
      const path = await readApiResponse<LearningPath>(response);
      const linked = { ...path, themeId: theme?.id, mapId: map?.id };
      setPaths((current) => [linked, ...current]);
      setProgressByPath((current) => ({ ...current, [linked.id]: { ...emptyPathProgress } }));
      setActivePathId(linked.id);
      notify(`Trilha “${linked.title}” criada com conteúdo real da IA.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível gerar a trilha.";
      setGenerationError({ message, retryable: error instanceof ApiClientError ? error.retryable : true });
      notify(message);
    } finally { setBusy(false); }
  }

  function startLesson(item: LearningLesson, unlocked: boolean) {
    if (!unlocked) return;
    setLesson(item); setExerciseIndex(0); setAnswer(""); setFeedback(null); setSessionCorrect(0); setSessionWrong([]); setHearts(3); setResultOpen(false);
  }

  function checkAnswer() {
    if (!currentExercise || feedback) return;
    const correct = answerIsCorrect(currentExercise, answer);
    setFeedback({ correct, message: correct ? currentExercise.explanation : `Resposta esperada: ${currentExercise.answer}. ${currentExercise.explanation}` });
    if (correct) setSessionCorrect((value) => value + 1);
    else { setSessionWrong((current) => [...current, currentExercise.id]); setHearts((value) => Math.max(0, value - 1)); }
  }

  function nextExercise() {
    if (!lesson) return;
    if (exerciseIndex < lesson.exercises.length - 1) { setExerciseIndex((value) => value + 1); setAnswer(""); setFeedback(null); return; }
    const finalCorrect = sessionCorrect;
    const earned = Math.round(lesson.xp * (finalCorrect / lesson.exercises.length));
    const now = new Date().toISOString();
    if (activePath) setProgressByPath((current) => {
      const previous = current[activePath.id] || emptyPathProgress;
      const achievements = [...previous.achievements];
      if (!achievements.includes("Primeira lição")) achievements.push("Primeira lição");
      if (previous.xp + earned >= 500 && !achievements.includes("500 XP")) achievements.push("500 XP");
      return { ...current, [activePath.id]: { ...previous, xp: previous.xp + earned, streak: updateStreak(previous), lastStudyDate: now.slice(0, 10), completedLessonIds: [...new Set([...previous.completedLessonIds, lesson.id])], lessonResults: { ...previous.lessonResults, [lesson.id]: { correct: finalCorrect, total: lesson.exercises.length, wrongExerciseIds: sessionWrong, completedAt: now } }, achievements } };
    });
    setResultOpen(true);
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

  if (lesson && currentExercise && !resultOpen) return <div className="lesson-player">
    <header><button onClick={() => setLesson(null)} aria-label="Sair da lição"><X /></button><div><span>Lição</span><i><b style={{ width: `${((exerciseIndex + 1) / lesson.exercises.length) * 100}%` }} /></i></div><span className="hearts"><Heart size={18} fill="currentColor" /> {hearts}</span></header>
    <main className="lesson-stage panel"><span className="exercise-kind">{kindLabels[currentExercise.type]}</span><h2>{currentExercise.prompt}</h2>
      {currentExercise.options.length > 0 ? <div className="learning-options">{currentExercise.options.map((option) => <button key={option} className={answer === option ? "selected" : ""} onClick={() => !feedback && setAnswer(option)} disabled={Boolean(feedback)}>{option}</button>)}</div> : <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={Boolean(feedback)} placeholder={currentExercise.type === "case_study" ? "Analise o caso e justifique sua decisão..." : "Digite sua resposta..."} />}
      {feedback && <div className={`lesson-feedback ${feedback.correct ? "correct" : "wrong"}`} role="status">{feedback.correct ? <CheckCircle2 /> : <RotateCcw />}<p><strong>{feedback.correct ? "Resposta correta" : "Vamos revisar"}</strong>{feedback.message}</p></div>}
      <button className="primary-button lesson-next" disabled={!answer.trim()} onClick={feedback ? nextExercise : checkAnswer}>{feedback ? exerciseIndex === lesson.exercises.length - 1 ? "Concluir lição" : "Continuar" : "Verificar"} <ArrowRight size={17} /></button>
    </main>
  </div>;

  if (lesson && resultOpen) {
    const score = Math.round(sessionCorrect / lesson.exercises.length * 100);
    return <section className="lesson-result panel"><Trophy size={46} /><span className="eyebrow">LIÇÃO CONCLUÍDA</span><h2>{lesson.title}</h2><div><article><strong>{score}%</strong><small>acerto</small></article><article><strong>+{Math.round(lesson.xp * sessionCorrect / lesson.exercises.length)}</strong><small>XP</small></article><article><strong>{sessionWrong.length}</strong><small>para revisar</small></article></div><p>{sessionWrong.length ? "Os erros foram salvos e voltarão nas recomendações de revisão." : "Desempenho perfeito. A próxima lição foi desbloqueada."}</p><button className="primary-button" onClick={() => { setLesson(null); setResultOpen(false); }}>Voltar ao caminho</button></section>;
  }

  return <div className="learning-page">
    <section className="learning-hero"><div><span className="eyebrow lime">APRENDIZADO ATIVO</span><h2>Um caminho progressivo para qualquer tema.</h2><p>Unidades, lições, erros e conquistas ficam ligados ao seu tema, mapa e conta.</p></div>{activePath && <div className="learning-stats"><span><Star /> <strong>{progress.xp} XP</strong></span><span><Flame /> <strong>{progress.streak} dias</strong></span><span><Trophy /> <strong>Nível {level}</strong></span></div>}</section>

    <section className="learning-generator panel"><div className="panel-heading"><div><span className="eyebrow">GERADOR DE TRILHAS COM IA</span><h3>Converta seu material em unidades e exercícios</h3></div><Sparkles /></div><div className="learning-generator-grid"><label><span>Tema</span><select value={themeId} onChange={(event) => setThemeId(event.target.value)}><option value="">Escolher tema</option>{themes.filter((theme) => !theme.archived).map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><label><span>Mapa</span><select value={mapId} onChange={(event) => setMapId(event.target.value)}><option value="">Escolher mapa</option>{maps.filter((map) => map.status !== "archived").map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label><label className="wide-field"><span>Pedido personalizado</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: ensine do zero, priorize prática e crie estudos de caso..." /></label></div><button className="primary-button" onClick={generatePath} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />} Gerar unidades e lições</button>{generationError && <div className="inline-error"><span>{generationError.message}</span>{generationError.retryable && <button onClick={generatePath}><RotateCcw size={15} /> Tentar novamente</button>}</div>}</section>

    {paths.length > 0 && <div className="path-selector">{paths.map((path) => <button key={path.id} className={path.id === activePath?.id ? "active" : ""} onClick={() => setActivePathId(path.id)}><BrainCircuit size={16} />{path.title}</button>)}</div>}
    {activePath ? <div className="learning-layout"><aside className="path-summary panel"><span className="eyebrow">PROGRESSO DA TRILHA</span><strong>{percent}%</strong><i><b style={{ width: `${percent}%` }} /></i><small>{completed.size} de {flatLessons.length} lições</small><div><span><Award size={16} /> {progress.achievements.length} conquistas</span><span><Layers3 size={16} /> {activePath.units.length} unidades</span></div>{reviewRecommendations.length > 0 && <section><strong>Revisar agora</strong>{reviewRecommendations.map((item) => <button key={item.id} onClick={() => startLesson(item, true)}><Target size={14} /> {item.title}</button>)}</section>}</aside><main className="learning-path">{activePath.units.map((unit, unitIndex) => <section key={unit.id} className="learning-unit"><header><div><span>UNIDADE {unitIndex + 1}</span><h3>{unit.title}</h3><p>{unit.description}</p></div><div className="order-controls"><button disabled={unitIndex === 0} onClick={() => moveUnit(unitIndex, -1)} aria-label="Mover unidade para cima">↑</button><button disabled={unitIndex === activePath.units.length - 1} onClick={() => moveUnit(unitIndex, 1)} aria-label="Mover unidade para baixo">↓</button></div></header><div>{unit.lessons.map((item, localIndex) => { const lessonIndex = flatLessons.findIndex((candidate) => candidate.id === item.id); const unlocked = lessonIndex === 0 || completed.has(flatLessons[lessonIndex - 1]?.id) || completed.has(item.id); const done = completed.has(item.id); return <article className="lesson-node" key={item.id}><button className={`${unlocked ? "unlocked" : "locked"} ${done ? "done" : ""}`} onClick={() => startLesson(item, unlocked)}><span>{done ? <Check /> : unlocked ? <Star /> : <LockKeyhole />}</span><div><strong>{item.title}</strong><small>{item.difficulty} · {item.exercises.length} exercícios · {item.xp} XP</small></div></button><div className="order-controls"><button disabled={localIndex === 0} onClick={() => moveLesson(unit.id, localIndex, -1)} aria-label="Mover lição para cima">↑</button><button disabled={localIndex === unit.lessons.length - 1} onClick={() => moveLesson(unit.id, localIndex, 1)} aria-label="Mover lição para baixo">↓</button></div></article>; })}</div></section>)}</main></div> : <section className="entity-empty panel"><BrainCircuit size={32} /><strong>Nenhuma trilha criada</strong><p>Escolha um tema, mapa ou material e peça à IA para construir seu caminho personalizado.</p></section>}
  </div>;
}
