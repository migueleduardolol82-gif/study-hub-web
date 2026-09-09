"use client";

import { ArrowRight, Award, BrainCircuit, Check, CheckCircle2, Flame, Heart, Layers3, LoaderCircle, LockKeyhole, RotateCcw, Sparkles, Star, Target, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { requestAI } from "@/lib/ai-client";
import { ApiClientError } from "@/lib/api-contract";
import { emptyPathProgress, type LearningExercise, type LearningLesson, type LearningPath, type PathProgress, type StudyMapRecord, type ThemeRecord, type ThemeDifficulty } from "@/lib/learning";

const kindLabels: Record<LearningExercise["type"], string> = {
  multiple_choice: "Múltipla escolha", true_false: "Verdadeiro ou falso", fill_blank: "Complete a lacuna",
  matching: "Relacione as colunas", ordering: "Ordene as etapas", flashcard: "Flashcard",
  typed: "Resposta digitada", case_study: "Estudo de caso", ai_question: "Questão da IA",
  error_review: "Revisão de erro", mock_exam: "Simulado",
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
  const [generationStage, setGenerationStage] = useState("");
  const [difficulty, setDifficulty] = useState<ThemeDifficulty>("iniciante");
  const [includeMaterial, setIncludeMaterial] = useState(false);
  const [sourceText, setSourceText] = useState("");
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

  function openLesson(item: LearningLesson) {
    setLesson(item); setExerciseIndex(0); setAnswer(""); setFeedback(null); setSessionCorrect(0); setSessionWrong([]); setHearts(3); setResultOpen(false); setOrdered([]); setMatches({}); setRevealed(false);
  }

  async function prepareLesson(path: LearningPath, item: LearningLesson, signal: AbortSignal, open = true) {
    if (item.exercises.length) { if (open) openLesson(item); return; }
    setGenerationStage(`Preparando explicação e exercícios: ${item.title}`);
    setRetryLesson({ path, lesson: item });
    const unit = path.units.find((unit) => unit.lessons.some((candidate) => candidate.id === item.id));
    const lessons = path.units.flatMap((unit) => unit.lessons);
    const prepared = await requestAI<{ studyNotes: string; exercises: LearningExercise[] }>("/api/learning/generate", {
      ...path.source, theme: path.source?.theme || path.title, mode: "lesson", difficulty: item.difficulty,
      lessonTitle: item.title, lessonDescription: item.description, unitTitle: unit?.title,
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
      const path = await requestAI<LearningPath>("/api/learning/generate", {
        mode: "outline", theme: title, difficulty,
        goal: [prompt, theme?.objective, theme?.description, map?.objective].filter(Boolean).join("\n"),
        topics: map?.mapping.topics.map((topic) => topic.title) || [],
        content: [sourceText, includeMaterial ? materialContext : ""].filter(Boolean).join("\n\n"),
      }, controller.signal);
      if (!path.id || !Array.isArray(path.units) || !path.units[0]?.lessons?.length) throw new Error("A trilha chegou incompleta.");
      const linked = { ...path, themeId: theme?.id, mapId: map?.id };
      setPaths((current) => [linked, ...current]);
      setProgressByPath((current) => ({ ...current, [linked.id]: { ...emptyPathProgress } }));
      setActivePathId(linked.id);
      await prepareLesson(linked, linked.units[0].lessons[0], controller.signal, false);
      notify(`Trilha “${linked.title}” salva e primeira lição pronta. As próximas são preparadas ao abrir.`);
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
    const correct = answerIsCorrect(currentExercise, answer);
    setFeedback({ correct, message: correct ? currentExercise.explanation : `Resposta esperada: ${currentExercise.answer}. ${currentExercise.explanation}` });
    if (correct) setSessionCorrect((value) => value + 1);
    else { setSessionWrong((current) => [...current, currentExercise.id]); setHearts((value) => Math.max(0, value - 1)); }
  }

  function nextExercise() {
    if (!lesson) return;
    if (exerciseIndex < lesson.exercises.length - 1) { setExerciseIndex((value) => value + 1); setAnswer(""); setFeedback(null); setOrdered([]); setMatches({}); setRevealed(false); return; }
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
      return { ...current, [activePath.id]: { ...previous, xp: previous.xp + extraXp, streak: updateStreak(previous), lastStudyDate: now.slice(0, 10), completedLessonIds: [...new Set([...previous.completedLessonIds, lesson.id])], lessonResults: { ...previous.lessonResults, [lesson.id]: { correct: Math.max(finalCorrect, priorResult?.correct || 0), total: lesson.exercises.length, wrongExerciseIds: sessionWrong, completedAt: now } }, achievements } };
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
      {lesson.studyNotes && <details className="lesson-notes"><summary>Explicação e exemplo desta lição</summary><p>{lesson.studyNotes}</p></details>}
      {currentExercise.type === "ordering" ? <div className="learning-options"><p>Selecione os passos na ordem correta.</p>{currentExercise.options.map((option) => <button key={option} disabled={Boolean(feedback) || ordered.includes(option)} onClick={() => { const next = [...ordered, option]; setOrdered(next); setAnswer(next.length === currentExercise.options.length ? next.join("|") : ""); }}>{ordered.includes(option) ? `${ordered.indexOf(option) + 1}. ` : ""}{option}</button>)}<button disabled={Boolean(feedback)} onClick={() => { setOrdered([]); setAnswer(""); }}>Refazer ordem</button></div>
      : currentExercise.type === "matching" && currentExercise.answer.includes("=>") ? <div className="matching-options">{currentExercise.answer.split("|").map((pair) => pair.split("=>").map((part) => part.trim())).map(([left]) => <label key={left}><span>{left}</span><select disabled={Boolean(feedback)} value={matches[left] || ""} onChange={(event) => { const next = { ...matches, [left]: event.target.value }; setMatches(next); const pairs = currentExercise.answer.split("|").map((pair) => pair.split("=>").map((part) => part.trim())); setAnswer(pairs.every(([key]) => next[key]) ? pairs.map(([key]) => `${key}=>${next[key]}`).join("|") : ""); }}><option value="">Relacionar com…</option>{currentExercise.answer.split("|").map((pair) => pair.split("=>")[1].trim()).sort((a, b) => a.localeCompare(b)).map((right) => <option key={right} value={right}>{right}</option>)}</select></label>)}</div>
      : currentExercise.type === "flashcard" ? <div className="flashcard-recall">{!revealed ? <button className="outline-button" onClick={() => setRevealed(true)}>Pense na resposta e vire o cartão</button> : <><p>{currentExercise.answer}</p><button disabled={Boolean(feedback)} onClick={() => { setAnswer(currentExercise.answer); setFeedback({ correct: true, message: currentExercise.explanation }); setSessionCorrect((n) => n + 1); }}>Lembrei</button><button disabled={Boolean(feedback)} onClick={() => { setAnswer("revisar"); setFeedback({ correct: false, message: currentExercise.explanation }); setSessionWrong((items) => [...items, currentExercise.id]); setHearts((n) => Math.max(0, n - 1)); }}>Preciso revisar</button></>}</div>
      : currentExercise.options.length > 0 ? <div className="learning-options">{currentExercise.options.map((option) => <button key={option} className={answer === option ? "selected" : ""} onClick={() => !feedback && setAnswer(option)} disabled={Boolean(feedback)}>{option}</button>)}</div> : <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={Boolean(feedback)} placeholder={currentExercise.type === "case_study" ? "Analise o caso e justifique sua decisão..." : "Digite sua resposta..."} />}
      {feedback && <div className={`lesson-feedback ${feedback.correct ? "correct" : "wrong"}`} role="status">{feedback.correct ? <CheckCircle2 /> : <RotateCcw />}<p><strong>{feedback.correct ? "Resposta correta" : "Vamos revisar"}</strong>{feedback.message}</p></div>}
      <button className="primary-button lesson-next" disabled={!answer.trim() || (currentExercise.type === "flashcard" && !feedback)} onClick={feedback ? nextExercise : checkAnswer}>{feedback ? exerciseIndex === lesson.exercises.length - 1 ? "Concluir lição" : "Continuar" : "Verificar"} <ArrowRight size={17} /></button>
    </main>
  </div>;

  if (lesson && resultOpen) {
    const score = Math.round(sessionCorrect / lesson.exercises.length * 100);
    return <section className="lesson-result panel"><Trophy size={46} /><span className="eyebrow">LIÇÃO CONCLUÍDA</span><h2>{lesson.title}</h2><div><article><strong>{score}%</strong><small>acerto</small></article><article><strong>+{Math.round(lesson.xp * sessionCorrect / lesson.exercises.length)}</strong><small>XP</small></article><article><strong>{sessionWrong.length}</strong><small>para revisar</small></article></div><p>{sessionWrong.length ? "Os erros foram salvos e voltarão nas recomendações de revisão." : "Desempenho perfeito. A próxima lição foi desbloqueada."}</p><button className="primary-button" onClick={() => { setLesson(null); setResultOpen(false); }}>Voltar ao caminho</button></section>;
  }

  return <div className="learning-page">
    <section className="learning-hero"><div><span className="eyebrow lime">APRENDIZADO ATIVO</span><h2>Um caminho progressivo para qualquer tema.</h2><p>Unidades, lições, erros e conquistas ficam ligados ao seu tema, mapa e conta.</p></div>{activePath && <div className="learning-stats"><span><Star /> <strong>{progress.xp} XP</strong></span><span><Flame /> <strong>{progress.streak} dias</strong></span><span><Trophy /> <strong>Nível {level}</strong></span></div>}</section>

    <section className="learning-generator panel"><div className="panel-heading"><div><span className="eyebrow">GERADOR DE TRILHAS COM IA</span><h3>Converta seu material em unidades e exercícios</h3></div><Sparkles /></div><div className="learning-generator-grid"><label><span>Tema</span><select value={themeId} onChange={(event) => { setThemeId(event.target.value); const selected = themes.find((item) => item.id === event.target.value); if (selected) setDifficulty(selected.difficulty); }}><option value="">Escolher tema</option>{themes.filter((theme) => !theme.archived).map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><label><span>Mapa</span><select value={mapId} onChange={(event) => setMapId(event.target.value)}><option value="">Escolher mapa</option>{maps.filter((map) => map.status !== "archived").map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label><label><span>Nível inicial</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as ThemeDifficulty)}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label><label className="wide-field"><span>Pedido personalizado</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: ensine do zero, priorize prática e crie estudos de caso..." /></label><label className="wide-field"><span>Texto de referência (opcional)</span><textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Cole um trecho específico que deseja estudar." /></label><label className="wide-field check-field"><input type="checkbox" checked={includeMaterial} disabled={!materialContext.trim()} onChange={(event) => setIncludeMaterial(event.target.checked)} /> Usar também a apostila e a aula da área de Estudos</label></div><button className="primary-button" onClick={generatePath} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />} {busy ? "Gerando por etapas…" : "Gerar unidades e lições"}</button>{busy && <p className="generation-status" role="status"><LoaderCircle className="spin" size={16} />{generationStage}<button className="text-button" onClick={() => requestRef.current?.abort()}>Interromper</button></p>}<p className="generation-help">O caminho é salvo primeiro; cada lição ganha explicações e exercícios ao ser aberta. Uma falha não apaga as etapas prontas.</p>{generationError && <div className="inline-error"><span>{generationError.message}</span>{generationError.retryable && <button disabled={busy} onClick={() => retryLesson ? startLesson(retryLesson.lesson, true, retryLesson.path) : generatePath()}><RotateCcw size={15} /> Tentar novamente</button>}</div>}</section>

    {paths.length > 0 && <div className="path-selector">{paths.map((path) => <button disabled={busy} key={path.id} className={path.id === activePath?.id ? "active" : ""} onClick={() => setActivePathId(path.id)}><BrainCircuit size={16} />{path.title}</button>)}</div>}
    {activePath ? <div className="learning-layout"><aside className="path-summary panel"><span className="eyebrow">PROGRESSO DA TRILHA</span><strong>{percent}%</strong><i><b style={{ width: `${percent}%` }} /></i><small>{completed.size} de {flatLessons.length} lições</small><div><span><Award size={16} /> {progress.achievements.length} conquistas</span><span><Layers3 size={16} /> {activePath.units.length} unidades</span></div>{reviewRecommendations.length > 0 && <section><strong>Revisar agora</strong>{reviewRecommendations.map((item) => <button key={item.id} onClick={() => startLesson(item, true)}><Target size={14} /> {item.title}</button>)}</section>}</aside><main className="learning-path">{activePath.units.map((unit, unitIndex) => <section key={unit.id} className="learning-unit"><header><div><span>UNIDADE {unitIndex + 1}</span><h3>{unit.title}</h3><p>{unit.description}</p></div><div className="order-controls"><button disabled={unitIndex === 0} onClick={() => moveUnit(unitIndex, -1)} aria-label="Mover unidade para cima">↑</button><button disabled={unitIndex === activePath.units.length - 1} onClick={() => moveUnit(unitIndex, 1)} aria-label="Mover unidade para baixo">↓</button></div></header><div>{unit.lessons.map((item, localIndex) => { const lessonIndex = flatLessons.findIndex((candidate) => candidate.id === item.id); const unlocked = lessonIndex === 0 || completed.has(flatLessons[lessonIndex - 1]?.id) || completed.has(item.id); const done = completed.has(item.id); return <article className="lesson-node" key={item.id}><button disabled={!unlocked || busy} className={`${unlocked ? "unlocked" : "locked"} ${done ? "done" : ""}`} onClick={() => startLesson(item, unlocked)}><span>{done ? <Check /> : unlocked ? <Star /> : <LockKeyhole />}</span><div><strong>{item.title}</strong><small>{item.difficulty} · {item.exercises.length ? `${item.exercises.length} exercícios` : "Preparar ao abrir"} · {item.xp} XP</small></div></button><div className="order-controls"><button disabled={localIndex === 0} onClick={() => moveLesson(unit.id, localIndex, -1)} aria-label="Mover lição para cima">↑</button><button disabled={localIndex === unit.lessons.length - 1} onClick={() => moveLesson(unit.id, localIndex, 1)} aria-label="Mover lição para baixo">↓</button></div></article>; })}</div></section>)}</main></div> : <section className="entity-empty panel"><BrainCircuit size={32} /><strong>Nenhuma trilha criada</strong><p>Escolha um tema, mapa ou material e peça à IA para construir seu caminho personalizado.</p></section>}
  </div>;
}
