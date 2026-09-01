"use client";

import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  Flame,
  Gauge,
  Layers3,
  Link2,
  LoaderCircle,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Target,
  Upload,
  Video,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "dashboard" | "sessions" | "mapping" | "review";
type TopicStatus = "covered" | "partial" | "gap";
type Topic = {
  title: string;
  status: TopicStatus;
  confidence: number;
  videoEvidence: string;
  syllabusReference: string;
  action: string;
};
type Mapping = {
  summary: string;
  coverage: number;
  topics: Topic[];
  nextSteps: string[];
};
type Goal = { id: number; title: string; done: boolean };
type Quiz = { question: string; options: string[]; answer: number; explanation: string };
type Flashcard = { front: string; back: string; topic: string };

const demoMapping: Mapping = {
  summary:
    "A aula cobriu bem a estrutura dos fundos e os participantes, mas deixou lacunas em tributação e marcação a mercado.",
  coverage: 72,
  topics: [
    {
      title: "Estrutura e funcionamento dos fundos",
      status: "covered",
      confidence: 94,
      videoEvidence: "Explicado entre 08:12 e 21:40, com exemplo de fundo de renda fixa.",
      syllabusReference: "Módulo 2 · páginas 18–24",
      action: "Revisão rápida em 7 dias",
    },
    {
      title: "Prestadores de serviços",
      status: "covered",
      confidence: 89,
      videoEvidence: "Administrador, gestor e custodiante foram diferenciados na aula.",
      syllabusReference: "Módulo 2 · páginas 25–29",
      action: "Gerar 3 flashcards",
    },
    {
      title: "Marcação a mercado",
      status: "partial",
      confidence: 68,
      videoEvidence: "O conceito foi citado, sem exemplo numérico ou efeito na cota.",
      syllabusReference: "Módulo 3 · páginas 41–46",
      action: "Rever páginas 43–46",
    },
    {
      title: "Tributação e come-cotas",
      status: "gap",
      confidence: 97,
      videoEvidence: "Nenhuma explicação identificada na transcrição.",
      syllabusReference: "Módulo 4 · páginas 57–66",
      action: "Estudar antes do próximo simulado",
    },
  ],
  nextSteps: [
    "Rever marcação a mercado com um exemplo prático",
    "Estudar tributação e come-cotas",
    "Fazer uma revisão ativa de 10 minutos",
  ],
};

const demoQuiz: Quiz[] = [
  {
    question: "Qual participante toma as decisões de compra e venda dos ativos do fundo?",
    options: ["Administrador", "Gestor", "Custodiante", "Auditor"],
    answer: 1,
    explanation: "O gestor define a estratégia e executa as decisões de investimento dentro da política do fundo.",
  },
  {
    question: "O que a marcação a mercado procura refletir na cota?",
    options: ["O custo original", "O valor contábil", "O preço atual dos ativos", "A rentabilidade futura"],
    answer: 2,
    explanation: "Ela atualiza os ativos pelo valor pelo qual poderiam ser negociados no mercado naquele momento.",
  },
];

const demoCards: Flashcard[] = [
  {
    front: "Qual é a principal função do administrador fiduciário?",
    back: "Cuidar do funcionamento do fundo e garantir o cumprimento das normas e do regulamento.",
    topic: "Estrutura dos fundos",
  },
  {
    front: "Por que a marcação a mercado pode alterar uma cota diariamente?",
    back: "Porque os preços e as taxas dos ativos variam no mercado, mudando o valor atualizado da carteira.",
    topic: "Marcação a mercado",
  },
  {
    front: "O que é o come-cotas?",
    back: "É a antecipação semestral do IR em certos fundos, realizada pela redução do número de cotas.",
    topic: "Tributação",
  },
];

const initialGoals: Goal[] = [
  { id: 1, title: "Concluir módulo de fundos", done: true },
  { id: 2, title: "Revisar 30 flashcards", done: true },
  { id: 3, title: "Fazer simulado com 80%", done: false },
  { id: 4, title: "Estudar tributação", done: false },
];

const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "Visão geral", icon: BarChart3 },
  { id: "sessions", label: "Sessões", icon: Video },
  { id: "mapping", label: "Mapa de conteúdo", icon: Layers3 },
  { id: "review", label: "Revisão ativa", icon: BrainCircuit },
];

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  return fallback;
}

function StatusPill({ status }: { status: TopicStatus }) {
  const labels = { covered: "Coberto", partial: "Parcial", gap: "Lacuna" };
  return <span className={`status-pill ${status}`}>{labels[status]}</span>;
}

function FlipNumber({ value }: { value: string }) {
  return (
    <span className="flip-card" aria-label={value}>
      <span>{value}</span>
      <i />
    </span>
  );
}

export function StudyHub() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(50 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [sessionMode, setSessionMode] = useState<"focus" | "break">("focus");
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [goalText, setGoalText] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [syllabusName, setSyllabusName] = useState("");
  const [mapping, setMapping] = useState<Mapping>(demoMapping);
  const [quiz, setQuiz] = useState<Quiz[]>(demoQuiz);
  const [flashcards, setFlashcards] = useState<Flashcard[]>(demoCards);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "Olá, Miguel. Posso explicar um trecho, criar exemplos ou montar uma revisão com base na sua aula." },
  ]);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("nexo-goals-v1");
      if (stored) setGoals(JSON.parse(stored));
    } catch {
      window.localStorage.removeItem("nexo-goals-v1");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("nexo-goals-v1", JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          setNotice("Sessão concluída. Seu tempo foi registrado.");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const minutes = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
  const seconds = (timerSeconds % 60).toString().padStart(2, "0");
  const completedGoals = goals.filter((goal) => goal.done).length;
  const goalProgress = goals.length ? Math.round((completedGoals / goals.length) * 100) : 0;
  const mappedTopics = mapping.topics.filter((topic) => topic.status === "covered").length;
  const activeCard = flashcards[cardIndex] || demoCards[0];
  const activeQuiz = quiz[quizIndex] || demoQuiz[0];

  const context = useMemo(
    () => `TRANSCRIÇÃO:\n${transcript}\n\nAPOSTILA:\n${syllabus}\n\nMAPEAMENTO:\n${JSON.stringify(mapping)}`,
    [transcript, syllabus, mapping],
  );

  function resetTimer(mode = sessionMode) {
    setTimerRunning(false);
    setTimerSeconds(mode === "focus" ? 50 * 60 : 10 * 60);
  }

  function changeMode(mode: "focus" | "break") {
    setSessionMode(mode);
    resetTimer(mode);
  }

  function addGoal(event: FormEvent) {
    event.preventDefault();
    const title = goalText.trim();
    if (!title) return;
    setGoals((current) => [...current, { id: Date.now(), title, done: false }]);
    setGoalText("");
  }

  async function transcribeVideo() {
    if (!videoFile && !driveUrl.trim()) {
      setNotice("Selecione um arquivo ou cole um link do Google Drive.");
      return;
    }
    setBusy("transcribe");
    setNotice(null);
    try {
      const form = new FormData();
      if (videoFile) form.append("file", videoFile);
      if (driveUrl) form.append("driveUrl", driveUrl);
      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload, "Erro na transcrição."));
      setTranscript(payload.transcript);
      setNotice("Transcrição concluída. Agora você pode cruzá-la com a apostila.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível transcrever.");
    } finally {
      setBusy(null);
    }
  }

  async function readSyllabus(file: File) {
    setBusy("syllabus");
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/materials/extract", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload, "Erro ao ler o PDF."));
      setSyllabus(payload.text);
      setSyllabusName(`${payload.fileName} · ${payload.pages} páginas`);
      setNotice("Apostila processada e pronta para o mapeamento.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível ler a apostila.");
    } finally {
      setBusy(null);
    }
  }

  async function analyzeContent() {
    if (!transcript.trim() || !syllabus.trim()) {
      setNotice("Adicione a transcrição e a apostila antes de gerar o mapa.");
      return;
    }
    setBusy("analyze");
    setNotice(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, syllabus }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload, "Erro no mapeamento."));
      setMapping(payload);
      setTab("mapping");
      setNotice("Mapa atualizado com base na sua aula.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível mapear o conteúdo.");
    } finally {
      setBusy(null);
    }
  }

  async function generateRevision() {
    const material = [transcript, syllabus].filter(Boolean).join("\n\n");
    if (!material.trim()) {
      setNotice("Adicione uma transcrição ou apostila para gerar a revisão.");
      return;
    }
    setBusy("generate");
    setNotice(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: material, focus: "lacunas do mapeamento", difficulty: "intermediário" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload, "Erro ao gerar revisão."));
      setQuiz(payload.quiz);
      setFlashcards(payload.flashcards);
      setQuizIndex(0);
      setQuizChoice(null);
      setCardIndex(0);
      setCardFlipped(false);
      setTab("review");
      setNotice("Nova revisão gerada a partir do seu material.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível gerar a revisão.");
    } finally {
      setBusy(null);
    }
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    const message = chatText.trim();
    if (!message || busy === "chat") return;
    setChatMessages((current) => [...current, { role: "user", text: message }]);
    setChatText("");
    setBusy("chat");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload, "Erro no tutor."));
      setChatMessages((current) => [...current, { role: "assistant", text: payload.answer }]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        { role: "assistant", text: error instanceof Error ? error.message : "Não consegui responder agora." },
      ]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><Zap size={18} fill="currentColor" /></span>
          <span>NEXO</span>
        </div>
        <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X /></button>

        <div className="course-card">
          <span className="eyebrow">TRILHA ATUAL</span>
          <strong>C-PRO I · ANBIMA</strong>
          <div className="mini-progress"><i style={{ width: `${mapping.coverage}%` }} /></div>
          <small>{mapping.coverage}% do conteúdo mapeado</small>
        </div>

        <nav className="main-nav" aria-label="Navegação principal">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => { setTab(item.id); setMobileNav(false); }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.id === "mapping" && <em>2</em>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="streak"><Flame size={18} /><span><strong>7 dias</strong><small>sequência atual</small></span></div>
          <button className="profile"><span>ME</span><div><strong>Miguel Eduardo</strong><small>Aluno</small></div><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu /></button>
          <div>
            <span className="eyebrow">TERÇA-FEIRA · 01 SET</span>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <div className="top-actions">
            <div className="search-box"><Search size={17} /><input aria-label="Pesquisar" placeholder="Buscar nas suas aulas" /></div>
            <button className="outline-button" onClick={() => setChatOpen(true)}><Sparkles size={17} /> Perguntar à IA</button>
          </div>
        </header>

        {notice && (
          <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Fechar aviso"><X size={16} /></button></div>
        )}

        {tab === "dashboard" && (
          <div className="page-grid dashboard-page">
            <section className="welcome-row">
              <div>
                <span className="eyebrow lime">PRÓXIMO PASSO</span>
                <h2>Continue de onde você parou.</h2>
                <p>Tributação de fundos ainda é a sua maior lacuna. Uma sessão focada agora leva sua cobertura para perto de 80%.</p>
              </div>
              <button className="primary-button" onClick={() => setTab("sessions")}>Iniciar sessão <ArrowRight size={18} /></button>
            </section>

            <section className="timer-panel panel">
              <div className="panel-heading">
                <div><span className="eyebrow">SESSÃO DE ESTUDO</span><h3>Flip focus</h3></div>
                <div className="segmented"><button aria-pressed={sessionMode === "focus"} className={sessionMode === "focus" ? "active" : ""} onClick={() => changeMode("focus")}>Foco</button><button aria-pressed={sessionMode === "break"} className={sessionMode === "break" ? "active" : ""} onClick={() => changeMode("break")}>Pausa</button></div>
              </div>
              <div className="flip-clock" aria-live="polite">
                <FlipNumber value={minutes[0]} /><FlipNumber value={minutes[1]} />
                <b>:</b>
                <FlipNumber value={seconds[0]} /><FlipNumber value={seconds[1]} />
              </div>
              <div className="timer-topic"><span />Tributação e come-cotas</div>
              <div className="timer-controls">
                <button className="icon-button" onClick={() => resetTimer()} aria-label="Reiniciar"><RotateCcw size={19} /></button>
                <button className="timer-main" onClick={() => setTimerRunning((running) => !running)}>{timerRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {timerRunning ? "Pausar" : "Começar"}</button>
                <button className="icon-button" onClick={() => { setTimerRunning(false); setTimerSeconds(0); }} aria-label="Encerrar"><Square size={18} /></button>
              </div>
            </section>

            <section className="progress-panel panel">
              <div className="panel-heading"><div><span className="eyebrow">EVOLUÇÃO</span><h3>Progresso semanal</h3></div><span className="trend">+18%</span></div>
              <div className="progress-content">
                <div className="radial" style={{ "--value": `${mapping.coverage * 3.6}deg` } as React.CSSProperties}><div><strong>{mapping.coverage}%</strong><small>cobertura</small></div></div>
                <div className="stat-list">
                  <div><span className="dot green" /><p><strong>{mappedTopics}</strong><small>Tópicos dominados</small></p></div>
                  <div><span className="dot amber" /><p><strong>{mapping.topics.filter((t) => t.status === "partial").length}</strong><small>Em desenvolvimento</small></p></div>
                  <div><span className="dot coral" /><p><strong>{mapping.topics.filter((t) => t.status === "gap").length}</strong><small>Lacunas prioritárias</small></p></div>
                </div>
              </div>
              <button className="text-button" onClick={() => setTab("mapping")}>Ver mapa completo <ArrowRight size={16} /></button>
            </section>

            <section className="goals-panel panel">
              <div className="panel-heading"><div><span className="eyebrow">METAS DA SEMANA</span><h3>{completedGoals} de {goals.length} concluídas</h3></div><strong className="goal-percent">{goalProgress}%</strong></div>
              <div className="goal-bar"><i style={{ width: `${goalProgress}%` }} /></div>
              <div className="goal-list">
                {goals.map((goal) => (
                  <button key={goal.id} onClick={() => setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, done: !item.done } : item))}>
                    {goal.done ? <CheckCircle2 className="checked" size={20} /> : <Circle size={20} />}
                    <span className={goal.done ? "done" : ""}>{goal.title}</span>
                  </button>
                ))}
              </div>
              <form className="add-goal" onSubmit={addGoal}><input value={goalText} onChange={(event) => setGoalText(event.target.value)} placeholder="Nova meta..." aria-label="Nova meta" /><button aria-label="Adicionar meta"><Plus size={17} /></button></form>
            </section>

            <section className="activity-panel panel">
              <div className="panel-heading"><div><span className="eyebrow">ATIVIDADE RECENTE</span><h3>Últimas sessões</h3></div><button className="text-button" onClick={() => setTab("sessions")}>Ver todas</button></div>
              <div className="session-list compact">
                <div><span className="session-icon purple"><Video size={19} /></span><p><strong>Fundos de investimento — Aula 04</strong><small>Hoje · 52 min · 6 tópicos</small></p><span className="score">84%</span></div>
                <div><span className="session-icon blue"><BrainCircuit size={19} /></span><p><strong>Revisão: riscos e suitability</strong><small>Ontem · 24 min · 18 questões</small></p><span className="score">78%</span></div>
                <div><span className="session-icon orange"><BookOpen size={19} /></span><p><strong>Apostila — Módulo 2</strong><small>30 ago · 41 min · páginas 18–35</small></p><Check size={19} className="muted" /></div>
              </div>
            </section>
          </div>
        )}

        {tab === "sessions" && (
          <div className="sessions-page">
            <section className="session-creator panel dark-panel">
              <div className="creator-copy">
                <span className="eyebrow lime">NOVA SESSÃO INTELIGENTE</span>
                <h2>Transforme uma aula em um plano de estudo.</h2>
                <p>Envie o vídeo ou cole um link público do Google Drive. O Nexo transcreve, compara com a apostila e encontra as lacunas.</p>
                <div className="flow-line"><span><Video size={17} /> Aula</span><i /><span><FileText size={17} /> Apostila</span><i /><span><Sparkles size={17} /> Mapa</span></div>
              </div>
              <div className="creator-form">
                <label>Link do Google Drive</label>
                <div className="input-with-icon"><Link2 size={18} /><input value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} placeholder="https://drive.google.com/file/d/..." /></div>
                <div className="or-divider"><span>ou envie um arquivo</span></div>
                <label className="drop-zone">
                  <input type="file" accept="video/*,audio/*" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} />
                  <Upload size={22} />
                  <strong>{videoFile ? videoFile.name : "Selecionar vídeo ou áudio"}</strong>
                  <small>MP4, MP3, M4A ou WAV · até 25 MB</small>
                </label>
                <button className="primary-button wide" onClick={transcribeVideo} disabled={busy === "transcribe"}>{busy === "transcribe" ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />} Transcrever aula</button>
              </div>
            </section>

            <section className="material-grid">
              <div className="panel editor-panel">
                <div className="panel-heading"><div><span className="eyebrow">TRANSCRIÇÃO</span><h3>Conteúdo da aula</h3></div><span className={`state-dot ${transcript ? "ready" : ""}`}>{transcript ? "Pronta" : "Aguardando"}</span></div>
                <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="A transcrição aparecerá aqui. Você também pode colar um texto manualmente." />
                <small>{transcript.length.toLocaleString("pt-BR")} caracteres</small>
              </div>
              <div className="panel editor-panel">
                <div className="panel-heading"><div><span className="eyebrow">APOSTILA</span><h3>Material de referência</h3></div>{syllabusName && <span className="state-dot ready">Lida</span>}</div>
                <label className="pdf-upload"><input type="file" accept="application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) readSyllabus(file); }} /><FileText size={22} /><span><strong>{syllabusName || "Adicionar apostila em PDF"}</strong><small>{busy === "syllabus" ? "Processando..." : "ou cole o texto abaixo"}</small></span></label>
                <textarea value={syllabus} onChange={(event) => setSyllabus(event.target.value)} placeholder="O conteúdo extraído do PDF aparecerá aqui." />
              </div>
            </section>
            <div className="action-dock"><div><Layers3 size={20} /><span><strong>Pronto para comparar?</strong><small>O resultado será salvo no mapa de conteúdo.</small></span></div><button className="primary-button" onClick={analyzeContent} disabled={busy === "analyze"}>{busy === "analyze" ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />} Mapear conteúdo</button></div>
          </div>
        )}

        {tab === "mapping" && (
          <div className="mapping-page">
            <section className="mapping-header">
              <div><span className="eyebrow lime">ANÁLISE DA ÚLTIMA AULA</span><h2>O que você já viu — e o que ainda falta.</h2><p>{mapping.summary}</p></div>
              <div className="coverage-box"><span>Cobertura da apostila</span><strong>{mapping.coverage}%</strong><div className="goal-bar"><i style={{ width: `${mapping.coverage}%` }} /></div><small>{mapping.topics.length} tópicos analisados</small></div>
            </section>

            <div className="map-legend"><span><i className="green" />Coberto</span><span><i className="amber" />Parcial</span><span><i className="coral" />Lacuna</span></div>
            <section className="topic-table panel">
              <div className="topic-table-head"><span>Tópico da apostila</span><span>Evidência na aula</span><span>Próxima ação</span></div>
              {mapping.topics.map((topic, index) => (
                <article className="topic-row" key={`${topic.title}-${index}`}>
                  <div className="topic-title"><StatusPill status={topic.status} /><strong>{topic.title}</strong><small>{topic.syllabusReference} · confiança {topic.confidence}%</small></div>
                  <p>{topic.videoEvidence}</p>
                  <button onClick={() => setTab("review")}>{topic.action}<ArrowRight size={15} /></button>
                </article>
              ))}
            </section>
            <section className="next-steps panel"><div><span className="next-icon"><Target /></span><div><span className="eyebrow">RECOMENDAÇÃO DO NEXO</span><h3>Plano para a próxima sessão</h3></div></div><ol>{mapping.nextSteps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol><button className="primary-button" onClick={generateRevision} disabled={busy === "generate"}>{busy === "generate" ? <LoaderCircle className="spin" size={18} /> : <BrainCircuit size={18} />} Gerar revisão das lacunas</button></section>
          </div>
        )}

        {tab === "review" && (
          <div className="review-page">
            <section className="review-header"><div><span className="eyebrow lime">REVISÃO ATIVA</span><h2>Treine a lembrança, não o reconhecimento.</h2><p>Questões e cartões conectados ao conteúdo da sua aula e às lacunas encontradas.</p></div><button className="outline-button" onClick={generateRevision} disabled={busy === "generate"}><Sparkles size={17} /> Gerar nova revisão</button></section>
            <div className="review-grid">
              <section className="panel flashcard-panel">
                <div className="panel-heading"><div><span className="eyebrow">FLASHCARDS</span><h3>Cartão {cardIndex + 1} de {flashcards.length}</h3></div><span className="card-topic">{activeCard.topic}</span></div>
                <button className={`flashcard ${cardFlipped ? "flipped" : ""}`} onClick={() => setCardFlipped((value) => !value)}>
                  <span className="eyebrow">{cardFlipped ? "RESPOSTA" : "PERGUNTA"}</span>
                  <strong>{cardFlipped ? activeCard.back : activeCard.front}</strong>
                  <small><RotateCcw size={15} /> Clique para virar</small>
                </button>
                <div className="card-nav"><button onClick={() => { setCardIndex((current) => (current - 1 + flashcards.length) % flashcards.length); setCardFlipped(false); }} aria-label="Cartão anterior"><ChevronLeft /></button><div>{flashcards.map((_, index) => <i key={index} className={index === cardIndex ? "active" : ""} />)}</div><button onClick={() => { setCardIndex((current) => (current + 1) % flashcards.length); setCardFlipped(false); }} aria-label="Próximo cartão"><ChevronRight /></button></div>
              </section>
              <section className="panel quiz-panel">
                <div className="panel-heading"><div><span className="eyebrow">QUIZ ADAPTATIVO</span><h3>Questão {quizIndex + 1} de {quiz.length}</h3></div><span className="difficulty">Intermediário</span></div>
                <div className="quiz-progress"><i style={{ width: `${((quizIndex + 1) / quiz.length) * 100}%` }} /></div>
                <h4>{activeQuiz.question}</h4>
                <div className="options">
                  {activeQuiz.options.map((option, index) => {
                    const answered = quizChoice !== null;
                    const className = answered ? index === activeQuiz.answer ? "correct" : index === quizChoice ? "wrong" : "" : "";
                    return <button key={option} className={className} onClick={() => setQuizChoice(index)} disabled={answered}><span>{String.fromCharCode(65 + index)}</span>{option}{answered && index === activeQuiz.answer && <Check size={17} />}</button>;
                  })}
                </div>
                {quizChoice !== null && <div className="explanation"><Sparkles size={17} /><p><strong>{quizChoice === activeQuiz.answer ? "Correto." : "Quase."}</strong> {activeQuiz.explanation}</p></div>}
                <button className="primary-button quiz-next" disabled={quizChoice === null} onClick={() => { setQuizIndex((current) => (current + 1) % quiz.length); setQuizChoice(null); }}>Próxima questão <ArrowRight size={17} /></button>
              </section>
            </div>
            <section className="review-stats panel"><div><Gauge size={20} /><span><strong>78%</strong><small>Taxa de acerto</small></span></div><div><Layers3 size={20} /><span><strong>{flashcards.length}</strong><small>Cartões disponíveis</small></span></div><div><Clock3 size={20} /><span><strong>12 min</strong><small>Revisão hoje</small></span></div><div><Flame size={20} /><span><strong>7 dias</strong><small>Sequência</small></span></div></section>
          </div>
        )}
      </main>

      <button className="chat-launcher" onClick={() => setChatOpen(true)} aria-label="Abrir tutor"><MessageCircle size={23} /><span>Tutor IA</span></button>
      {chatOpen && (
        <aside className="chat-panel">
          <header><span className="bot-avatar"><Bot size={20} /></span><div><strong>Tutor Nexo</strong><small><i /> Conectado ao seu material</small></div><button onClick={() => setChatOpen(false)} aria-label="Fechar chat"><X /></button></header>
          <div className="chat-messages">
            {chatMessages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}>{message.text}</div>)}
            {busy === "chat" && <div className="chat-message assistant typing"><i /><i /><i /></div>}
          </div>
          <div className="quick-prompts"><button onClick={() => setChatText("Explique minha maior lacuna com um exemplo simples")}>Explique minha maior lacuna</button><button onClick={() => setChatText("Crie uma questão difícil sobre esta aula")}>Crie uma questão difícil</button></div>
          <form onSubmit={sendChat}><textarea value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Pergunte sobre sua aula..." /><button aria-label="Enviar" disabled={!chatText.trim() || busy === "chat"}><Send size={18} /></button></form>
        </aside>
      )}
    </div>
  );
}
