"use client";

import "./review-session.css";
import "./study-home.css";
import { StudyAIStatus } from "./study-ai-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadCardSources, produceFlashcards } from "@/lib/flashcard-production-client";
import { productionProgress } from "@/lib/flashcard-production";

import { BarChart3, BookOpen, BrainCircuit, Check, ChevronRight, Clock3, FileText, Gauge, Layers3, Library, LoaderCircle, LockKeyhole, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Target, Upload, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { requestAI } from "@/lib/ai-client";
import { ApiClientError } from "@/lib/api-contract";
import { emptyPathProgress, type LearningExercise, type LearningLesson, type LearningPath, type PathProgress, type StudyMapRecord, type ThemeRecord, type ThemeDifficulty } from "@/lib/learning";
import { DocumentUploadPanel } from "@/components/document-upload-panel";
import { analyzeStudyDocuments } from "@/lib/document-analysis-client";
import type { StudyDocument } from "@/lib/study-documents";
import { ReviewSession } from "@/components/review-session";
import { bank, modeLabels, newReviewSession, reviewModes, conceptKey, mergeQuestionBank, syncKnowledgeBase, type ReviewMode } from "@/lib/review-engine";

export function ActiveReview({ paths, setPaths, progressByPath, setProgressByPath, themes, maps, materialContext, documents, setDocuments, notify, requestedPathId, requestedDocumentId }: {
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
  requestedPathId?: string;
  requestedDocumentId?: string;
}) {
  const [activePathId, setActivePathId] = useState(() => paths.some(path => path.id === requestedPathId) ? requestedPathId || "" : paths[0]?.id || "");
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
  const [learningMode, setLearningMode] = useState<ReviewMode>("estudar");
  const [previewPath, setPreviewPath] = useState<LearningPath | null>(null);
  const [previewUnitIds, setPreviewUnitIds] = useState<string[]>([]);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [scope, setScope] = useState("all");
  const [background, setBackground] = useState(false);
  const [speedDuration, setSpeedDuration] = useState(60);
  const [creatorOpen, setCreatorOpen] = useState(Boolean(requestedDocumentId));
  const [studySection, setStudySection] = useState<"home" | "decks">("home");
  const [deckFilter, setDeckFilter] = useState<"all" | "active" | "complete">("all");
  const [deckQuery, setDeckQuery] = useState("");
  const [deckOpen, setDeckOpen] = useState(false);
  const [todayClock] = useState(() => Date.now());
  const [retryLesson, setRetryLesson] = useState<{ path: LearningPath; lesson: LearningLesson } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const outlineRequestId = useRef<string | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [generationError, setGenerationError] = useState<{ message: string; retryable: boolean } | null>(null);
  const activePath = paths.find((path) => path.id === activePathId) || paths[0];
  const progress = activePath ? progressByPath[activePath.id] || emptyPathProgress : emptyPathProgress;
  const flatLessons = activePath?.units.flatMap((unit) => unit.lessons) || [];
  const completed = new Set(progress.completedLessonIds);
  const percent = flatLessons.length ? Math.round(completed.size / flatLessons.length * 100) : 0;
  const wrongIds = Object.values(progress.lessonResults).flatMap((result) => result.wrongExerciseIds).filter((id) => (progress.mastery?.[id] || 0) < 2);
  const pathConceptRows = activePath ? Array.from(new Map(bank(activePath).map(row => [conceptKey(row.lesson, row.exercise), row])).values()) : [];
  const dueToday = pathConceptRows.filter(row => { const value = progress.conceptMastery?.[conceptKey(row.lesson, row.exercise)]; return value && Date.parse(value.dueAt) <= todayClock; }).length;
  const weakConcepts = pathConceptRows.filter(row => (progress.conceptMastery?.[conceptKey(row.lesson, row.exercise)]?.mastery || 0) < 60).length;
  const pathMastery = pathConceptRows.length ? Math.round(pathConceptRows.reduce((sum, row) => sum + (progress.conceptMastery?.[conceptKey(row.lesson, row.exercise)]?.mastery || 0), 0) / pathConceptRows.length) : 0;

  useEffect(() => {
    if (!paths.some(path => !path.knowledgeBase)) return;
    setPaths(current => current.map(path => path.knowledgeBase ? path : syncKnowledgeBase(path, path.updatedAt)));
  }, [paths, setPaths]);

  function openScope(path: LearningPath, selectedScope: string, mode = learningMode) {
    const currentProgress = progressByPath[path.id] || emptyPathProgress;
    if (currentProgress.reviewSession && !currentProgress.reviewSession.finished && !window.confirm("Iniciar uma nova sessão? As respostas já corrigidas serão preservadas, mas a sessão em andamento será substituída.")) return;
    const session = newReviewSession(path, currentProgress, mode, selectedScope, Date.now(), speedDuration);
    if (!session.items.length) { notify(mode === "hard" ? "Não há questões avançadas neste escopo. Amplie o banco com questões Hard." : mode === "revisao" ? "Nenhuma questão precisa de revisão neste escopo agora." : "Ainda não há questões compatíveis prontas neste escopo."); return; }
    setActivePathId(path.id);
    setProgressByPath(all => ({ ...all, [path.id]: { ...(all[path.id] || emptyPathProgress), reviewSession: session } }));
    setSessionOpen(true);
  }
  function openLesson(item: LearningLesson, path = activePath, mode = learningMode) {
    if (!path) return;
    const updated = { ...path, units: path.units.map(u => ({ ...u, lessons: u.lessons.map(l => l.id === item.id ? item : l) })) };
    openScope(updated, item.id, mode);
  }
  function resumeSession() {
    if (!activePath || !progress.reviewSession) return;
    const saved = progress.reviewSession;
    if (saved.mode === "speed" && !saved.deadline) setProgressByPath(all => ({ ...all, [activePath.id]: { ...all[activePath.id], reviewSession: { ...saved, deadline: Date.now() + (saved.remainingSeconds ?? 60) * 1000 } } }));
    setSessionOpen(true);
  }

  async function prepareLesson(path: LearningPath, item: LearningLesson, signal: AbortSignal, open = true, mode = learningMode) {
    if (item.exercises.length) { if (open) openLesson(item, path, mode); return; }
    setGenerationStage(`Preparando explicação e exercícios: ${item.title}`);
    setRetryLesson({ path, lesson: item });
    const unit = path.units.find((unit) => unit.lessons.some((candidate) => candidate.id === item.id));
    const lessons = path.units.flatMap((unit) => unit.lessons);
    const prepared = await requestAI<{ studyNotes: string; exercises: LearningExercise[] }>("/api/learning/generate", {
      ...path.source, theme: path.source?.theme || path.title, mode: "lesson", difficulty: item.difficulty, learningMode: "banco",
      lessonTitle: item.title, lessonDescription: item.description, unitTitle: unit?.title,
      lessonReferences: item.references,
      previousLessons: lessons.slice(0, lessons.findIndex((candidate) => candidate.id === item.id)).map((candidate) => candidate.title),
    }, signal);
    if (!Array.isArray(prepared.exercises) || prepared.exercises.length < 4) throw new Error("A lição chegou incompleta. Tente preparar esta lição novamente.");
    const ready = { ...item, ...prepared, preparation: "ready" as const, preparationError: undefined };
    setPaths((current) => current.map((candidate) => candidate.id !== path.id ? candidate : syncKnowledgeBase({ ...candidate, updatedAt: new Date().toISOString(), units: candidate.units.map((unit) => ({ ...unit, lessons: unit.lessons.map((lesson) => lesson.id === item.id ? ready : lesson) })) })));
    setRetryLesson(null);
    if (open) openLesson(ready, path, mode);
  }

  function showGenerationError(error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir esta etapa.";
    setGenerationError({ message, retryable: error instanceof ApiClientError ? error.retryable : true });
    notify(message);
  }

  async function detailedFlashcards(existing?: LearningPath) {
    if (requestRef.current) return;
    setStudySection("decks");
    setDeckOpen(true);
    const controller = new AbortController(); requestRef.current = controller;
    setBackground(true); setGenerationError(null); setRetryLesson(null);
    try {
      let path = existing;
      if (!path?.cardProduction) {
        setGenerationStage("Carregando o texto integral dos materiais…");
        const selected = existing ? documents.filter(doc => existing.documentIds?.includes(doc.id) && doc.status === "ready") : documents.filter(doc => doc.selected && doc.status === "ready");
        const extra = existing ? (selected.length ? "" : existing.source?.content || "") : [sourceText, includeMaterial ? materialContext : ""].filter(Boolean).join("\n\n");
        const sources = await loadCardSources(selected, extra, controller.signal);
        const now = new Date().toISOString();
        path = { ...(existing || { id: `path-${crypto.randomUUID()}`, title: prompt.trim() || selected[0]?.name || "Meu deck de estudos", units: [], createdAt: now, updatedAt: now, unlockAll: true, documentIds: selected.map(doc => doc.id) }), cardProduction: { version: 1, sources, status: "paused" } };
        const created = path;
        setPaths(current => existing ? current.map(item => item.id === created.id ? created : item) : [created, ...current]);
        setActivePathId(path.id); setCreatorOpen(false);
      }
      await produceFlashcards(path, saved => setPaths(current => current.map(item => item.id === saved.id ? { ...item, units: saved.units, knowledgeBase: saved.knowledgeBase, cardProduction: saved.cardProduction, updatedAt: saved.updatedAt } : item)), setGenerationStage, controller.signal);
    } catch (error) { if (!controller.signal.aborted) showGenerationError(error); }
    finally { requestRef.current = null; setBackground(false); setGenerationStage(""); }
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
        generationId: outlineRequestId.current ||= crypto.randomUUID(),
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
      outlineRequestId.current = null;
      notify(`Prévia de “${linked.title}” pronta. Revise as unidades antes de salvar.`);
    } catch (error) { showGenerationError(error); }
    finally { requestRef.current = null; setBusy(false); setGenerationStage(""); }
  }

  async function startLesson(item: LearningLesson, unlocked: boolean, path = activePath, mode = learningMode) {
    if (!unlocked || !path) return;
    if (item.exercises.length) { openLesson(item, path, mode); return; }
    if (requestRef.current) { notify("Esta lição ainda está sendo preparada. Você pode começar pelas lições prontas."); return; }
    const controller = new AbortController(); requestRef.current = controller;
    setActivePathId(path.id); setBusy(true); setGenerationError(null);
    try { await prepareLesson(path, item, controller.signal, true, mode); }
    catch (error) { showGenerationError(error); }
    finally { requestRef.current = null; setBusy(false); setGenerationStage(""); }
  }

  function markPreparation(pathId: string, lessonId: string, state: LearningLesson["preparation"], message?: string) {
    setPaths(all => all.map(path => path.id === pathId ? { ...path, units: path.units.map(unit => ({ ...unit, lessons: unit.lessons.map(lesson => lesson.id === lessonId ? { ...lesson, preparation: state, preparationError: message } : lesson) })) } : path));
  }
  async function prepareRemaining(path: LearningPath) {
    if (requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller; setBackground(true); setGenerationError(null);
    try {
      for (const item of path.units.flatMap(unit => unit.lessons).filter(lesson => !lesson.exercises.length)) {
        if (controller.signal.aborted) break;
        markPreparation(path.id, item.id, "processing");
        try { await prepareLesson(path, item, controller.signal, false); }
        catch (error) { markPreparation(path.id, item.id, "error", error instanceof Error ? error.message : "Falha nesta etapa."); throw error; }
      }
    } catch (error) { showGenerationError(error); }
    finally { requestRef.current = null; setBackground(false); setGenerationStage(""); }
  }
  async function expandBank() {
    if (!activePath || requestRef.current) return;
    const candidates = flatLessons.filter(lesson => lesson.exercises.length && (scope === "all" || lesson.id === scope || activePath.units.some(unit => unit.id === scope && unit.lessons.some(l => l.id === lesson.id)) || lesson.exercises.some(e => conceptKey(lesson, e) === scope)));
    if (!candidates.length) { notify("Prepare ao menos uma lição deste escopo antes de ampliar o banco."); return; }
    const controller = new AbortController(); requestRef.current = controller; setBackground(true); setGenerationError(null);
    try {
      for (const lesson of candidates) {
        let accumulated = lesson.exercises;
        for (let batch = 0; batch < 2; batch++) {
          setGenerationStage(`Ampliando ${lesson.title} · lote ${batch + 1} de 2`);
          const data = await requestAI<{ exercises: LearningExercise[] }>("/api/learning/generate", { mode: "bank", theme: activePath.title, lessonTitle: lesson.title, studyNotes: lesson.studyNotes || lesson.description, lessonReferences: lesson.references, concepts: lesson.keyConcepts, existingPrompts: accumulated.map(e => e.prompt), batchKind: learningMode === "hard" ? "hard" : "mixed" }, controller.signal);
          if (!Array.isArray(data.exercises) || !data.exercises.length) throw new Error("O lote chegou vazio. O banco anterior foi preservado.");
          accumulated = mergeQuestionBank(accumulated, data.exercises);
          setPaths(all => all.map(path => path.id === activePath.id ? syncKnowledgeBase({ ...path, updatedAt: new Date().toISOString(), units: path.units.map(unit => ({ ...unit, lessons: unit.lessons.map(l => l.id === lesson.id ? { ...l, exercises: mergeQuestionBank(l.exercises, data.exercises) } : l) })) }) : path));
        }
      }
    } catch (error) { showGenerationError(error); }
    finally { requestRef.current = null; setBackground(false); setGenerationStage(""); }
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
  function savePreview() { if (!previewPath) return; const selected = previewPath.units.filter((unit) => previewUnitIds.includes(unit.id)); if (!selected.length) { notify("Selecione pelo menos uma unidade."); return; } const saved = syncKnowledgeBase({ ...previewPath, units: selected, updatedAt: new Date().toISOString() }); setPaths((current) => [saved, ...current]); setProgressByPath((current) => ({ ...current, [saved.id]: { ...emptyPathProgress } })); setActivePathId(saved.id); setStudySection("decks"); setDeckOpen(true); setPreviewPath(null); setPreviewUnitIds([]); setCreatorOpen(false); notify(`Trilha “${saved.title}” salva. Preparando a primeira lição; você poderá começar assim que ela ficar pronta.`); void prepareRemaining(saved); }

  if (sessionOpen && activePath && progress.reviewSession) return <ReviewSession path={activePath} progress={progress} session={progress.reviewSession} setProgress={setProgressByPath} onClose={() => setSessionOpen(false)} />;

  const modeInfo: Record<Exclude<ReviewMode, "desafio">, { icon: React.ReactNode; text: string }> = {
    estudar: { icon: <BookOpen />, text: "Aprenda em blocos curtos, com explicação, exemplo e prática." },
    memorizar: { icon: <BrainCircuit />, text: "Cartões com alternativas de múltipla escolha e correção imediata." },
    flashcards: { icon: <Layers3 />, text: "Cartões com repetição espaçada e autoavaliação." },
    revisao: { icon: <RotateCcw />, text: "Prioriza erros, atrasos e conceitos perto de serem esquecidos." },
    speed: { icon: <Zap />, text: "Rodada cronometrada com sequência, precisão e pontuação." },
    hard: { icon: <ShieldCheck />, text: "Casos, exceções, cálculos e alternativas realmente próximas." },
    dominio: { icon: <Gauge />, text: "Mede aprendizado sem pistas, com questões menos repetidas." },
  };
  const unitMastery = (unitId: string) => {
    const rows = pathConceptRows.filter(row => row.unit.id === unitId);
    return rows.length ? Math.round(rows.reduce((sum, row) => sum + (progress.conceptMastery?.[conceptKey(row.lesson, row.exercise)]?.mastery || 0), 0) / rows.length) : 0;
  };
  const readyLessons = flatLessons.filter(item => item.exercises.length).length;
  const processingLessons = flatLessons.filter(item => item.preparation === "processing").length;
  const allAttempts = paths.flatMap(path => progressByPath[path.id]?.reviewHistory || []);
  const allCards = paths.reduce((count, path) => count + bank(path).length, 0);
  const allLessons = paths.flatMap(path => path.units.flatMap(unit => unit.lessons)).length;
  const completedLessons = paths.reduce((count, path) => count + (progressByPath[path.id]?.completedLessonIds.length || 0), 0);
  const accuracy = allAttempts.length ? Math.round(allAttempts.filter(attempt => attempt.grade.correct).length / allAttempts.length * 100) : null;
  const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(todayClock); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() - (6 - index));
    const key = localDate(day);
    return { key, label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day).replace(".", ""), count: allAttempts.filter(attempt => localDate(new Date(attempt.answeredAt)) === key).length };
  });
  const weeklyMax = Math.max(1, ...weeklyActivity.map(day => day.count));
  const weeklyTotal = weeklyActivity.reduce((sum, day) => sum + day.count, 0);
  const visibleDecks = paths.filter(path => {
    const lessons = path.units.flatMap(unit => unit.lessons);
    const done = (progressByPath[path.id] || emptyPathProgress).completedLessonIds.length;
    return path.title.toLocaleLowerCase("pt-BR").includes(deckQuery.toLocaleLowerCase("pt-BR")) && (deckFilter === "all" || (deckFilter === "complete" ? lessons.length > 0 && done >= lessons.length : done > 0 && done < lessons.length));
  });
  const openDeck = (path: LearningPath) => { setActivePathId(path.id); setScope("all"); setDeckOpen(true); setStudySection("decks"); };
  const openQuickCreator = () => { if (prompt.trim().length > 220) { setSourceText(prompt); setPrompt("Material para estudar"); } setCreatorOpen(true); };

  return <div className="review-home">
    <header className="review-home-top">
      <div><span className="eyebrow lime">ESTUDOS</span><h2>{studySection === "home" ? "Comece por aqui" : "Baralhos"}</h2></div>
      <div className="review-top-actions"><button className="review-secondary" onClick={() => { setStudySection("decks"); setDeckOpen(false); }}><Library /> Meus baralhos</button><button className="review-primary" onClick={() => setCreatorOpen(true)}><Plus /> Criar baralho</button></div>
    </header>

    <StudyAIStatus />
    <nav className="review-subtabs" aria-label="Seções de estudos"><button type="button" aria-current={studySection === "home" ? "page" : undefined} onClick={() => setStudySection("home")}>Início</button><button type="button" aria-current={studySection === "decks" ? "page" : undefined} onClick={() => { setStudySection("decks"); setDeckOpen(false); }}>Baralhos</button></nav>

    {studySection === "home" && <div className="study-landing">
      <section className="study-landing-hero"><div className="study-landing-symbol" aria-hidden="true"><BrainCircuit /></div><div><span className="eyebrow">SEU ESPAÇO DE APRENDIZADO</span><h3>O que vamos<br />estudar?</h3><p>Crie um baralho com texto ou material e volte a estudar de onde parou.</p></div></section>
      <div className="study-create-box"><label htmlFor="study-quick-prompt">Quero estudar...</label><textarea id="study-quick-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Escreva um tema ou cole um texto para criar seu baralho" /><button type="button" onClick={openQuickCreator}><Plus /> {prompt.trim() ? "Continuar criação" : "Criar baralho"}</button></div>
      <div className="study-quick-actions" aria-label="Formas de criar baralho"><Button variant="outline" onClick={() => setCreatorOpen(true)}><FileText /> Texto</Button><Button variant="outline" onClick={() => setCreatorOpen(true)}><Upload /> Carregar</Button><Button variant="outline" onClick={() => { setStudySection("decks"); setDeckOpen(false); }}><Layers3 /> Baralhos</Button></div>
      <section className="study-insights" aria-label="Seu progresso em Estudos">
        <div className="study-section-title"><h3>Seu progresso</h3><span>Dados dos seus baralhos</span></div>
        <div className="study-stat-grid"><Card className="study-stat-card"><Layers3 /><strong>{allCards}</strong><span>Cartões disponíveis</span></Card><Card className="study-stat-card"><BarChart3 /><strong>{weeklyTotal}</strong><span>Respostas em 7 dias</span></Card><Card className="study-stat-card"><Target /><strong>{accuracy === null ? "—" : `${accuracy}%`}</strong><span>Acertos no histórico</span></Card></div>
        <div className="study-chart-grid"><Card className="study-activity-card"><div><h4>Atividade da semana</h4><small>{weeklyTotal ? `${weeklyTotal} respostas registradas` : "Seu gráfico começa na primeira resposta"}</small></div><div className="study-bars" role="img" aria-label={`Respostas por dia nos últimos sete dias: ${weeklyActivity.map(day => `${day.label} ${day.count}`).join(", ")}`}>{weeklyActivity.map(day => <div key={day.key} className="study-bar-day"><span className="study-bar-track"><span style={{ height: `${day.count ? Math.max(10, day.count / weeklyMax * 100) : 3}%` }} /></span><small>{day.label}</small></div>)}</div></Card><Card className="study-completion-card"><h4>Conteúdo percorrido</h4><div className="study-progress-ring" style={{ "--progress": `${allLessons ? Math.round(completedLessons / allLessons * 100) : 0}%` } as React.CSSProperties}><strong>{allLessons ? Math.round(completedLessons / allLessons * 100) : 0}%</strong></div><Progress value={allLessons ? Math.round(completedLessons / allLessons * 100) : 0} aria-label="Lições concluídas" /><p>{completedLessons} de {allLessons} lições concluídas</p><Button variant="outline" onClick={() => { setStudySection("decks"); setDeckOpen(false); }}>Explorar baralhos <ChevronRight /></Button></Card></div>
      </section>
      {activePath?.id && <section className="study-landing-section"><div className="study-section-title"><h3>Continue de onde parou</h3><button onClick={() => openDeck(activePath)}>Ver baralho <ChevronRight /></button></div><button className="study-resume-card" onClick={() => progress.reviewSession && !progress.reviewSession.finished ? resumeSession() : openDeck(activePath)}><span className="study-deck-badge">{percent}%</span><span><b>{activePath.title}</b><small>{progress.reviewSession && !progress.reviewSession.finished ? `${modeLabels[progress.reviewSession.mode]} · questão ${progress.reviewSession.index + 1}` : `${bank(activePath).length} cartões · ${activePath.units.length} subdecks`}</small></span><ChevronRight /></button></section>}
      <section className="study-landing-section"><div className="study-section-title"><h3>Meus baralhos</h3><button onClick={() => { setStudySection("decks"); setDeckOpen(false); }}>Ver todos <ChevronRight /></button></div><div className="study-deck-list">{paths.slice(0, 3).map((path, index) => <button key={path.id} className="study-deck-card" style={{ "--deck-stripe": ["#25bea8", "#7784ef", "#f0ac53"][index % 3] } as React.CSSProperties} onClick={() => openDeck(path)}><span><b>{path.title}</b><small>{bank(path).length} cartões · {path.units.length} subdecks</small></span><ChevronRight /></button>)}{!paths.length && <p>Seu primeiro baralho começa com um texto ou arquivo.</p>}</div></section>
    </div>}

    {studySection === "decks" && !deckOpen && <section className="study-decks-index"><div className="study-section-title"><h3>Meus baralhos</h3><button onClick={() => setCreatorOpen(true)}><Plus /> Novo</button></div><label className="study-deck-search"><Search /><span className="sr-only">Buscar baralhos</span><input value={deckQuery} onChange={event => setDeckQuery(event.target.value)} placeholder="Buscar baralho" /></label><div className="study-deck-filters" aria-label="Filtrar baralhos">{([["all", "Todos"], ["active", "Em andamento"], ["complete", "Concluídos"]] as const).map(([id, label]) => <button key={id} aria-pressed={deckFilter === id} onClick={() => setDeckFilter(id)}>{label}</button>)}</div><div className="study-deck-list">{visibleDecks.map((path, index) => { const lessons = path.units.flatMap(unit => unit.lessons); const saved = progressByPath[path.id] || emptyPathProgress; const completion = lessons.length ? Math.round(saved.completedLessonIds.length / lessons.length * 100) : 0; return <button key={path.id} className="study-deck-card" style={{ "--deck-stripe": ["#25bea8", "#7784ef", "#f0ac53", "#f174aa", "#e8ce35"][index % 5] } as React.CSSProperties} onClick={() => openDeck(path)}><span><b>{path.title}</b><small>{bank(path).length} cartões · {path.units.length} subdecks · {completion}% concluído</small></span><ChevronRight /></button>; })}{!visibleDecks.length && <p>Nenhum baralho encontrado para este filtro.</p>}</div></section>}

    {studySection === "decks" && deckOpen && activePath ? <>
      <div className="study-deck-detail-heading"><button onClick={() => setDeckOpen(false)}>← Todos os baralhos</button><h3>{activePath.title}</h3><p>{bank(activePath).length} cartões · {activePath.units.length} subdecks</p></div>
      <section className="review-today">
        <div><span className="eyebrow">HOJE</span><h3>{dueToday ? `${dueToday} conceitos precisam de revisão` : "Seu próximo passo está pronto"}</h3><p>{weakConcepts} pontos com domínio abaixo de 60% · {wrongIds.length} erros ativos</p></div>
        <div className="today-actions">
          {dueToday > 0 && <button onClick={() => { setLearningMode("revisao"); openScope(activePath, "today", "revisao"); }}><Clock3 /> Revisar agora</button>}
          {wrongIds.length > 0 && <button onClick={() => { setLearningMode("revisao"); openScope(activePath, "errors", "revisao"); }}><Target /> Caderno de erros</button>}
          {!dueToday && !wrongIds.length && <button onClick={() => openScope(activePath, "weak", "estudar")}><Sparkles /> Continuar aprendendo</button>}
        </div>
      </section>

      <section className="review-track-hero">
        <div className="track-title"><span>TRILHA ATUAL</span><h1>{activePath.title}</h1><p>{activePath.units.length} unidades · {activePath.knowledgeBase?.concepts.length || pathConceptRows.length} conceitos · {bank(activePath).length} questões</p></div>
        <div className="track-metrics"><div><b>{pathMastery}%</b><span>domínio geral</span></div><div><b>{percent}%</b><span>progresso</span></div><div><b>{progress.streak}</b><span>dias seguidos</span></div></div>
        {progress.reviewSession && !progress.reviewSession.finished && <button className="continue-session" onClick={resumeSession}><span><small>CONTINUAR SESSÃO</small><b>{modeLabels[progress.reviewSession.mode]} · questão {progress.reviewSession.index + 1}</b></span><ChevronRight /></button>}
      </section>

      <section className="review-mode-picker">
        <div className="section-heading"><div><span className="eyebrow">ESCOLHA SUA EXPERIÊNCIA</span><h3>Como você quer estudar hoje?</h3></div>{background && <span className="background-status"><LoaderCircle className="spin" /> {generationStage || "Preparando conteúdo"}</span>}</div>
        <div className="review-mode-grid">{(reviewModes.filter(id => id !== "desafio") as Exclude<ReviewMode, "desafio">[]).map(id => <button key={id} className={learningMode === id ? "active" : ""} aria-pressed={learningMode === id} onClick={() => setLearningMode(id)}><span>{modeInfo[id].icon}</span><b>{modeLabels[id]}</b><small>{modeInfo[id].text}</small></button>)}</div>
        <div className="review-session-config">
          <label><span>O que deseja estudar?</span><select value={scope} onChange={event => setScope(event.target.value)}>
            <option value="all">Toda a trilha disponível</option><option value="today">Revisão de hoje</option><option value="errors">Somente erros</option><option value="weak">Pontos fracos</option><option value="favorites">Favoritos</option>
            {activePath.units.map(unit => <option key={unit.id} value={unit.id}>Unidade · {unit.title}</option>)}
            {Array.from(new Map(bank(activePath).map(row => [conceptKey(row.lesson, row.exercise), row.exercise.concept || row.lesson.title])).entries()).map(([key, label]) => <option key={key} value={key}>Conceito · {label}</option>)}
          </select></label>
          {learningMode === "speed" && <label><span>Tempo da rodada</span><select value={speedDuration} onChange={event => setSpeedDuration(Number(event.target.value))}><option value={30}>30 segundos</option><option value={60}>1 minuto</option><option value={120}>2 minutos</option><option value={300}>5 minutos</option></select></label>}
          <button className="review-start" onClick={() => openScope(activePath, scope)}><Zap /> Começar {modeLabels[learningMode]}</button>
        </div>
        {generationError && <div className="review-inline-error"><p>{generationError.message}</p>{generationError.retryable && <button onClick={() => retryLesson ? startLesson(retryLesson.lesson, true, retryLesson.path) : void prepareRemaining(activePath)}><RotateCcw /> Tentar novamente</button>}</div>}
      </section>

      <section className="review-units">
        <div className="detailed-card-production">
          <div><span className="eyebrow">FLASHCARDS</span><h3>Gerar cartões</h3><p>Organize o material por assunto e continue a geração quando quiser.</p></div>
          {activePath.cardProduction && (() => { const stats = productionProgress(activePath.cardProduction); return <div aria-live="polite"><strong>{stats.covered} cartões · {stats.covered}/{stats.facts} conceitos</strong><progress aria-label="Trechos analisados" value={stats.analyzed} max={stats.total || 1} /><details><summary>Detalhes da cobertura</summary><p>{stats.analyzed}/{stats.total} trechos analisados · {stats.audited}/{stats.total} verificados</p><p>{stats.complete ? "Geração concluída." : "Mantenha esta área aberta durante a geração. Os cartões prontos já podem ser estudados."} A auditoria da IA pode não identificar todas as omissões.</p></details>{activePath.cardProduction.error && <p role="alert">{activePath.cardProduction.error}</p>}</div>; })()}
          <div className="detailed-card-actions"><button className="review-primary" disabled={busy || background || (activePath.cardProduction ? productionProgress(activePath.cardProduction).complete : false)} onClick={() => void detailedFlashcards(activePath)}>{background ? "Gerando…" : activePath.cardProduction ? productionProgress(activePath.cardProduction).complete ? "Geração concluída" : "Retomar geração" : "Gerar flashcards do material"}</button>{background && <button onClick={() => requestRef.current?.abort()}>Pausar geração</button>}</div>
        </div>
        <div className="section-heading"><div><span className="eyebrow">CONTEÚDO DA TRILHA</span><h3>{activePath.cardProduction ? "Decks e subdecks" : "Unidades"}</h3></div><button className="review-secondary" onClick={() => setPaths(current => current.map(path => path.id === activePath.id ? { ...path, unlockAll: !path.unlockAll } : path))}>{activePath.unlockAll ? "Usar progressão" : "Liberar todas"}</button></div>
        <div className="unit-list">{activePath.units.map((unit, unitIndex) => {
          const lessonsBefore = activePath.units.slice(0, unitIndex).flatMap(item => item.lessons);
          const unlocked = Boolean(activePath.cardProduction) || Boolean(activePath.unlockAll) || unitIndex === 0 || lessonsBefore.every(item => completed.has(item.id));
          const unitReady = unit.lessons.filter(item => item.exercises.length).length;
          return <details key={unit.id} open={unitIndex === 0} className={unlocked ? "unit-row" : "unit-row locked"}>
            <summary><span className="unit-number">{unlocked ? String(unitIndex + 1).padStart(2, "0") : <LockKeyhole />}</span><span><b>{unit.title}</b><small>{unitReady}/{unit.lessons.length} lições prontas · {unitMastery(unit.id)}% domínio</small></span><progress value={unitMastery(unit.id)} max={100} /><ChevronRight /></summary>
            <div className="unit-lessons">{unit.lessons.map(item => <button key={item.id} disabled={!unlocked} onClick={() => void startLesson(item, unlocked)}><span className={item.exercises.length ? "ready-dot" : item.preparation === "processing" ? "processing-dot" : "waiting-dot"} /> <span><b>{item.title}</b><small>{item.exercises.length ? `${item.exercises.length} questões disponíveis` : item.preparation === "processing" ? "Processando" : item.preparation === "error" ? "Falhou — toque para tentar novamente" : "Aguardando"}</small></span><ChevronRight /></button>)}</div>
          </details>;
        })}</div>
        <div className="processing-summary"><span>{readyLessons} lições prontas</span><span>{processingLessons} processando</span><span>{Math.max(0, flatLessons.length - readyLessons - processingLessons)} aguardando</span><button disabled={background || busy} onClick={() => void prepareRemaining(activePath)}>{background ? "Processando…" : "Continuar processamento"}</button><button disabled={background || busy} onClick={() => void expandBank()}>Gerar novas variações</button></div>
      </section>
    </> : null}

    {creatorOpen && <div className="review-creator-backdrop" role="presentation"><section className="review-creator" role="dialog" aria-modal="true" aria-label="Criar nova trilha">
      <header><div><span className="eyebrow lime">NOVA TRILHA</span><h2>Transforme material em aprendizado ativo</h2></div><button aria-label="Fechar criação" onClick={() => setCreatorOpen(false)}><X /></button></header>
      <DocumentUploadPanel documents={documents} setDocuments={setDocuments} title="Adicionar materiais" notify={notify} />
      <div className="learning-generator-grid"><label><span>Tema existente</span><select value={themeId} onChange={event => { setThemeId(event.target.value); const selected = themes.find(item => item.id === event.target.value); if (selected) setDifficulty(selected.difficulty); }}><option value="">Nenhum</option>{themes.filter(theme => !theme.archived).map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><label><span>Organização existente</span><select value={mapId} onChange={event => setMapId(event.target.value)}><option value="">Nenhuma</option>{maps.filter(map => map.status !== "archived").map(map => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label><label><span>Nível</span><select value={difficulty} onChange={event => setDifficulty(event.target.value as ThemeDifficulty)}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label><label><span>Profundidade</span><select value={depth} onChange={event => setDepth(event.target.value)}><option value="rapido">Rápida</option><option value="equilibrado">Equilibrada</option><option value="aprofundado">Aprofundada</option></select></label><label><span>Unidades aproximadas</span><select value={requestedUnits} onChange={event => setRequestedUnits(Number(event.target.value))}><option value={0}>Automático</option>{Array.from({ length: 19 }, (_, index) => index + 2).map(count => <option key={count} value={count}>{count}</option>)}</select></label><label className="wide-field"><span>O que deseja aprender?</span><textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Ex.: ANCORD completa, com foco em regras, exceções e casos práticos." /></label><label className="wide-field"><span>Texto adicional</span><textarea value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="Cole aqui outro conteúdo, se quiser." /></label><label className="wide-field check-field"><input type="checkbox" checked={includeMaterial} disabled={!materialContext.trim()} onChange={event => setIncludeMaterial(event.target.checked)} /> Usar também os materiais da área de Estudos</label></div>
      <button className="review-start creator-generate" onClick={() => void detailedFlashcards()} disabled={busy || background}><Layers3 /> Criar deck de flashcards detalhados</button>
      <p>Usa o texto integral dos arquivos e do campo Texto adicional. Libera os primeiros cartões enquanto prepara os próximos; salva cada lote para retomar depois.</p>
      <button className="review-primary creator-generate" onClick={() => void generatePath()} disabled={busy || background}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />} {busy ? generationStage || "Analisando…" : "Analisar e criar estrutura de aulas"}</button>
      {generationError && <div className="review-inline-error"><p>{generationError.message}</p>{generationError.retryable && <button onClick={() => void generatePath()}><RotateCcw /> Tentar novamente</button>}</div>}
      {previewPath && <section className="review-preview"><div className="section-heading"><div><span className="eyebrow">CONFIRME A ESTRUTURA</span><h3>{previewPath.title}</h3></div><button onClick={addPreviewUnit}><Plus /> Unidade</button></div><p>Escolha o que será salvo. Você poderá ampliar o banco depois sem recriar a trilha.</p>{previewPath.units.map((unit, index) => <article key={unit.id}><label><input type="checkbox" checked={previewUnitIds.includes(unit.id)} onChange={event => setPreviewUnitIds(current => event.target.checked ? [...current, unit.id] : current.filter(id => id !== unit.id))} /><span><b>{index + 1}. {unit.title}</b><small>{unit.objective || unit.description}</small></span></label><div><button onClick={() => renamePreviewUnit(unit.id)}>Renomear</button><button onClick={() => editPreviewUnit(unit.id)}>Editar</button><button disabled={busy} onClick={() => void regeneratePreviewUnit(unit.id)}>Regenerar</button><button disabled={unit.lessons.length < 2} onClick={() => splitPreviewUnit(unit.id)}>Dividir</button><button disabled={index === 0} onClick={() => mergePreviewUnit(index)}>Juntar</button><button className="danger" onClick={() => deletePreviewUnit(unit.id)}>Excluir</button></div></article>)}<button className="review-start" onClick={savePreview}><Check /> Salvar e preparar primeira unidade</button></section>}
    </section></div>}
  </div>;
}
