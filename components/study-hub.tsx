"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  BookMarked,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Crown,
  Dumbbell,
  FileText,
  Flame,
  Gauge,
  Layers3,
  Link2,
  ListChecks,
  LockKeyhole,
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
  SlidersHorizontal,
  Sparkles,
  Square,
  Shield,
  Target,
  Trophy,
  TrendingUp,
  Upload,
  Video,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "dashboard" | "evolution" | "sessions" | "mapping" | "plans" | "review";
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
type PlanSession = {
  id: string;
  day: string;
  topic: string;
  activity: string;
  minutes: number;
  done: boolean;
};
type StudyWeek = { week: number; theme: string; sessions: PlanSession[] };
type SkillKey = "body" | "knowledge" | "discipline" | "communication" | "capital" | "leadership";
type SkillLevels = Record<SkillKey, number>;
type EvolutionLog = {
  id: number;
  sourceId?: string;
  type: "run" | "strength" | "reading" | "study" | "business" | "communication";
  title: string;
  minutes: number;
  xp: number;
  createdAt: string;
};
type Archetype = {
  id: string;
  name: string;
  subtitle: string;
  icon: typeof Crown;
  color: string;
  horizon: string;
  requirements: Partial<SkillLevels>;
  milestones: string[];
  phases: { period: string; name: string; actions: string[] }[];
};

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

const skillMeta: Record<SkillKey, { label: string; description: string }> = {
  body: { label: "Corpo", description: "Força, corrida, recuperação e energia" },
  knowledge: { label: "Intelecto", description: "Leitura, estudo profundo e repertório" },
  discipline: { label: "Disciplina", description: "Consistência, rotina e execução" },
  communication: { label: "Comunicação", description: "Oratória, escrita e influência" },
  capital: { label: "Capital", description: "Negócios, finanças e criação de valor" },
  leadership: { label: "Liderança", description: "Decisão, responsabilidade e pessoas" },
};

const initialSkills: SkillLevels = {
  body: 34,
  knowledge: 29,
  discipline: 31,
  communication: 24,
  capital: 18,
  leadership: 16,
};

const activityTypes: Record<EvolutionLog["type"], { label: string; skill: SkillKey; xpRate: number }> = {
  run: { label: "Corrida / cardio", skill: "body", xpRate: 3 },
  strength: { label: "Treino de força", skill: "body", xpRate: 3 },
  reading: { label: "Leitura", skill: "knowledge", xpRate: 2 },
  study: { label: "Estudo profundo", skill: "knowledge", xpRate: 3 },
  business: { label: "Projeto / negócio", skill: "capital", xpRate: 4 },
  communication: { label: "Oratória / networking", skill: "communication", xpRate: 3 },
};

const archetypes: Archetype[] = [
  {
    id: "sage",
    name: "Sábio Estrategista",
    subtitle: "Conhecimento transformado em clareza, ensino e decisão.",
    icon: BookMarked,
    color: "#aa8cff",
    horizon: "4–5 anos",
    requirements: { knowledge: 82, discipline: 68, communication: 62 },
    milestones: ["Ler e sintetizar 120 livros", "Criar 1.000 notas conectadas", "Ensinar 100 horas", "Publicar uma tese ou método próprio"],
    phases: [
      { period: "0–6 meses", name: "Fundação", actions: ["Ler 30 min por dia", "Criar notas após cada estudo", "Dominar lógica, finanças e escrita"] },
      { period: "6–18 meses", name: "Discípulo", actions: ["Concluir 30 livros essenciais", "Escrever uma síntese por semana", "Explicar conceitos sem consultar"] },
      { period: "18–36 meses", name: "Construtor", actions: ["Criar mapas entre áreas", "Ensinar publicamente", "Produzir análises autorais mensais"] },
      { period: "3–5 anos", name: "Sábio", actions: ["Publicar um sistema próprio", "Formar outras pessoas", "Ser referência por profundidade, não volume"] },
    ],
  },
  {
    id: "entrepreneur",
    name: "Empresário Construtor",
    subtitle: "Visão comercial, operação disciplinada e criação sustentável de valor.",
    icon: BriefcaseBusiness,
    color: "#d0ff65",
    horizon: "3–5 anos",
    requirements: { capital: 80, communication: 72, leadership: 68, discipline: 70 },
    milestones: ["Entrevistar 100 clientes", "Lançar 3 projetos reais", "Construir receita recorrente", "Liderar uma pequena equipe"],
    phases: [
      { period: "0–6 meses", name: "Explorador", actions: ["Mapear problemas de clientes", "Aprender fluxo de caixa e vendas", "Executar um experimento por mês"] },
      { period: "6–18 meses", name: "Operador", actions: ["Vender uma oferta validada", "Documentar processos", "Acompanhar margem, retenção e caixa"] },
      { period: "18–36 meses", name: "Construtor", actions: ["Criar receita previsível", "Delegar operações", "Formar reserva e reinvestir com critério"] },
      { period: "3–5 anos", name: "Empresário", actions: ["Liderar por indicadores", "Criar vantagem competitiva", "Desenvolver novos líderes"] },
    ],
  },
  {
    id: "athlete",
    name: "Atleta Resiliente",
    subtitle: "Capacidade física construída com consistência, recuperação e coragem.",
    icon: Dumbbell,
    color: "#ff8d72",
    horizon: "3–4 anos",
    requirements: { body: 84, discipline: 78, knowledge: 42 },
    milestones: ["Treinar 600 sessões", "Correr 3.000 km acumulados", "Completar uma maratona forte", "Manter força e mobilidade sem lesões"],
    phases: [
      { period: "0–6 meses", name: "Base", actions: ["Treinar 4 vezes por semana", "Regular sono e alimentação", "Fortalecer joelhos, quadril e core"] },
      { period: "6–18 meses", name: "Resistente", actions: ["Periodizar corrida e força", "Competir sem interromper a rotina", "Registrar carga e recuperação"] },
      { period: "18–36 meses", name: "Competidor", actions: ["Executar ciclos específicos", "Aumentar volume com segurança", "Dominar estratégia de prova"] },
      { period: "3–4 anos", name: "Atleta", actions: ["Sustentar alto desempenho", "Transformar disciplina em identidade", "Ajudar outros pelo exemplo"] },
    ],
  },
  {
    id: "leader",
    name: "Líder de Capital",
    subtitle: "Julgamento, influência e responsabilidade para alocar recursos e pessoas.",
    icon: Crown,
    color: "#66b5ff",
    horizon: "4–6 anos",
    requirements: { leadership: 85, capital: 72, communication: 78, knowledge: 70 },
    milestones: ["Tomar 200 decisões documentadas", "Mentorar 10 pessoas", "Gerir um projeto de alto impacto", "Construir histórico mensurável de resultados"],
    phases: [
      { period: "0–6 meses", name: "Autoliderança", actions: ["Cumprir promessas pessoais", "Decidir com critérios escritos", "Pedir feedback difícil"] },
      { period: "6–18 meses", name: "Influência", actions: ["Conduzir reuniões", "Resolver conflitos com clareza", "Assumir entregas maiores"] },
      { period: "18–36 meses", name: "Gestor", actions: ["Delegar com contexto", "Desenvolver talentos", "Criar sistemas de acompanhamento"] },
      { period: "4–6 anos", name: "Líder", actions: ["Alocar capital com responsabilidade", "Definir visão de longo prazo", "Multiplicar capacidade por meio de pessoas"] },
    ],
  },
];

const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "Visão geral", icon: BarChart3 },
  { id: "evolution", label: "Ascensão", icon: Shield },
  { id: "sessions", label: "Sessões", icon: Video },
  { id: "mapping", label: "Mapa de conteúdo", icon: Layers3 },
  { id: "plans", label: "Plano de estudos", icon: CalendarDays },
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
  const [planName, setPlanName] = useState("Reta final C-PRO I");
  const [planWeeks, setPlanWeeks] = useState(8);
  const [planDays, setPlanDays] = useState(5);
  const [planMinutes, setPlanMinutes] = useState(60);
  const [selectedPlanTopics, setSelectedPlanTopics] = useState<string[]>(
    demoMapping.topics.filter((topic) => topic.status !== "covered").map((topic) => topic.title),
  );
  const [studyPlan, setStudyPlan] = useState<StudyWeek[]>([]);
  const [planWeekView, setPlanWeekView] = useState(0);
  const [skillLevels, setSkillLevels] = useState<SkillLevels>(initialSkills);
  const [evolutionLogs, setEvolutionLogs] = useState<EvolutionLog[]>([]);
  const [activityType, setActivityType] = useState<EvolutionLog["type"]>("reading");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityMinutes, setActivityMinutes] = useState(45);
  const [selectedArchetype, setSelectedArchetype] = useState("sage");
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
      const storedPlan = window.localStorage.getItem("nexo-study-plan-v1");
      if (storedPlan) setStudyPlan(JSON.parse(storedPlan));
      const storedSkills = window.localStorage.getItem("nexo-skills-v1");
      if (storedSkills) setSkillLevels(JSON.parse(storedSkills));
      const storedEvolution = window.localStorage.getItem("nexo-evolution-v1");
      if (storedEvolution) setEvolutionLogs(JSON.parse(storedEvolution));
      const storedArchetype = window.localStorage.getItem("nexo-archetype-v1");
      if (storedArchetype) setSelectedArchetype(storedArchetype);
    } catch {
      window.localStorage.removeItem("nexo-goals-v1");
      window.localStorage.removeItem("nexo-study-plan-v1");
      window.localStorage.removeItem("nexo-skills-v1");
      window.localStorage.removeItem("nexo-evolution-v1");
      window.localStorage.removeItem("nexo-archetype-v1");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("nexo-goals-v1", JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    window.localStorage.setItem("nexo-study-plan-v1", JSON.stringify(studyPlan));
  }, [studyPlan]);

  useEffect(() => {
    window.localStorage.setItem("nexo-skills-v1", JSON.stringify(skillLevels));
  }, [skillLevels]);

  useEffect(() => {
    window.localStorage.setItem("nexo-evolution-v1", JSON.stringify(evolutionLogs));
  }, [evolutionLogs]);

  useEffect(() => {
    window.localStorage.setItem("nexo-archetype-v1", selectedArchetype);
  }, [selectedArchetype]);

  useEffect(() => {
    const priorities = mapping.topics
      .filter((topic) => topic.status !== "covered")
      .map((topic) => topic.title);
    if (priorities.length) setSelectedPlanTopics(priorities);
  }, [mapping]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          if (sessionMode === "focus") {
            const focusedMinutes = 50;
            const xp = focusedMinutes * activityTypes.study.xpRate;
            setEvolutionLogs((logs) => [{
              id: Date.now(),
              sourceId: `focus-${Date.now()}`,
              type: "study",
              title: "Sessão de foco: Tributação e come-cotas",
              minutes: focusedMinutes,
              xp,
              createdAt: new Date().toISOString(),
            }, ...logs]);
            setSkillLevels((skills) => ({
              ...skills,
              knowledge: Math.min(100, skills.knowledge + 2),
              discipline: Math.min(100, skills.discipline + 1),
            }));
            setNotice(`Sessão concluída e integrada à Ascensão: +${xp} XP.`);
          } else {
            setNotice("Pausa concluída. Você está pronto para uma nova sessão.");
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, sessionMode]);

  const minutes = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
  const seconds = (timerSeconds % 60).toString().padStart(2, "0");
  const completedGoals = goals.filter((goal) => goal.done).length;
  const goalProgress = goals.length ? Math.round((completedGoals / goals.length) * 100) : 0;
  const mappedTopics = mapping.topics.filter((topic) => topic.status === "covered").length;
  const activeCard = flashcards[cardIndex] || demoCards[0];
  const activeQuiz = quiz[quizIndex] || demoQuiz[0];
  const planSessionCount = studyPlan.reduce((total, week) => total + week.sessions.length, 0);
  const planCompletedCount = studyPlan.reduce(
    (total, week) => total + week.sessions.filter((session) => session.done).length,
    0,
  );
  const planProgress = planSessionCount
    ? Math.round((planCompletedCount / planSessionCount) * 100)
    : 0;
  const activePlanWeek = studyPlan[planWeekView];
  const totalXp = 2840 + evolutionLogs.reduce((total, log) => total + log.xp, 0);
  const evolutionLevel = Math.floor(totalXp / 500) + 1;
  const levelXp = totalXp % 500;
  const evolutionRank = evolutionLevel < 10
    ? "E"
    : evolutionLevel < 20
      ? "D"
      : evolutionLevel < 35
        ? "C"
        : evolutionLevel < 50
          ? "B"
          : evolutionLevel < 70
            ? "A"
            : "S";
  const activeArchetype = archetypes.find((archetype) => archetype.id === selectedArchetype) || archetypes[0];
  const ActiveArchetypeIcon = activeArchetype.icon;
  const archetypeRequirements = Object.entries(activeArchetype.requirements) as [SkillKey, number][];
  const archetypeProgress = Math.round(
    archetypeRequirements.reduce(
      (total, [skill, requirement]) => total + Math.min(skillLevels[skill] / requirement, 1),
      0,
    ) / archetypeRequirements.length * 100,
  );
  const accumulatedMinutes = evolutionLogs.reduce((total, log) => total + log.minutes, 0);
  const completedMissions = [
    evolutionLogs.some((log) => log.type === "run" || log.type === "strength"),
    evolutionLogs.some((log) => log.type === "reading"),
    evolutionLogs.some((log) => log.type === "study"),
    evolutionLogs.some((log) => log.type === "business" || log.type === "communication"),
  ].filter(Boolean).length;

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

  function createStudyPlan(event: FormEvent) {
    event.preventDefault();
    const topics = selectedPlanTopics.length
      ? selectedPlanTopics
      : mapping.topics.map((topic) => topic.title);
    if (!topics.length) {
      setNotice("Escolha pelo menos um tópico para montar o plano.");
      return;
    }

    const weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const activities = [
      "Estudo guiado e anotações",
      "Revisão ativa e flashcards",
      "Questões e correção dos erros",
      "Resumo falado sem consulta",
    ];
    const plan = Array.from({ length: planWeeks }, (_, weekIndex) => {
      const weeklySessions = Array.from({ length: planDays }, (_, dayIndex) => {
        const topicIndex = (weekIndex * planDays + dayIndex) % topics.length;
        return {
          id: `${Date.now()}-${weekIndex}-${dayIndex}`,
          day: weekdays[dayIndex],
          topic: topics[topicIndex],
          activity: activities[(weekIndex + dayIndex) % activities.length],
          minutes: planMinutes,
          done: false,
        };
      });
      return {
        week: weekIndex + 1,
        theme: topics[(weekIndex * planDays) % topics.length],
        sessions: weeklySessions,
      };
    });

    setStudyPlan(plan);
    setPlanWeekView(0);
    setNotice(`Plano “${planName}” criado com ${planWeeks * planDays} sessões.`);
  }

  function togglePlanSession(sessionId: string) {
    const session = studyPlan.flatMap((week) => week.sessions).find((item) => item.id === sessionId);
    const shouldReward = session && !session.done && !evolutionLogs.some((log) => log.sourceId === sessionId);
    setStudyPlan((current) =>
      current.map((week) => ({
        ...week,
        sessions: week.sessions.map((session) =>
          session.id === sessionId ? { ...session, done: !session.done } : session,
        ),
      })),
    );
    if (session && shouldReward) {
      const xp = session.minutes * activityTypes.study.xpRate;
      setEvolutionLogs((current) => [{
        id: Date.now(),
        sourceId: session.id,
        type: "study",
        title: `Plano concluído: ${session.topic}`,
        minutes: session.minutes,
        xp,
        createdAt: new Date().toISOString(),
      }, ...current]);
      setSkillLevels((current) => ({
        ...current,
        knowledge: Math.min(100, current.knowledge + Math.max(1, Math.min(3, Math.round(session.minutes / 30)))),
        discipline: Math.min(100, current.discipline + 1),
      }));
      setNotice(`Sessão do plano concluída: +${xp} XP na Ascensão.`);
    }
  }

  function addPlanToGoals() {
    const newGoals = selectedPlanTopics.slice(0, 4).map((topic, index) => ({
      id: Date.now() + index,
      title: `Avançar no plano: ${topic}`,
      done: false,
    }));
    setGoals((current) => [...current, ...newGoals]);
    setNotice("As prioridades do plano foram adicionadas às metas da semana.");
  }

  function logEvolutionActivity(event: FormEvent) {
    event.preventDefault();
    const title = activityTitle.trim();
    if (!title || activityMinutes < 5) {
      setNotice("Descreva a atividade e registre pelo menos 5 minutos.");
      return;
    }

    const activity = activityTypes[activityType];
    const xp = activityMinutes * activity.xpRate;
    const skillGain = Math.max(1, Math.min(3, Math.round(activityMinutes / 30)));
    setEvolutionLogs((current) => [
      {
        id: Date.now(),
        type: activityType,
        title,
        minutes: activityMinutes,
        xp,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setSkillLevels((current) => ({
      ...current,
      [activity.skill]: Math.min(100, current[activity.skill] + skillGain),
      discipline: Math.min(100, current.discipline + 1),
    }));
    setActivityTitle("");
    setNotice(`Atividade registrada: +${xp} XP, +${skillGain} em ${skillMeta[activity.skill].label}.`);
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
      if (file.size > 40 * 1024 * 1024) {
        throw new Error("A apostila precisa ter até 40 MB.");
      }

      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      const document = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      }).promise;
      const pages: string[] = [];

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        setSyllabusName(`${file.name} · lendo página ${pageNumber} de ${document.numPages}`);
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .trim(),
        );
        page.cleanup();
      }

      const pageCount = document.numPages;
      await document.destroy();
      const text = pages.filter(Boolean).join("\n\n");
      if (!text.trim()) {
        throw new Error("Não encontrei texto. Esse PDF pode ser uma digitalização sem OCR.");
      }

      setSyllabus(text);
      setSyllabusName(`${file.name} · ${pageCount} páginas`);
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

        {tab === "evolution" && (
          <div className="evolution-page">
            <section className="ascension-hero panel">
              <div className="rank-emblem" aria-label={`Rank ${evolutionRank}`}>
                <span>RANK</span>
                <strong>{evolutionRank}</strong>
              </div>
              <div className="ascension-copy">
                <span className="eyebrow ascension-label"><Shield size={14} /> SISTEMA DE ASCENSÃO</span>
                <h2>Construa uma versão de você que só existe depois de anos.</h2>
                <p>Sem atalhos ou progresso fictício. Estudo, treino, leitura, projetos e liderança alimentam uma jornada mensurável de longo prazo.</p>
                <div className="level-progress">
                  <div><strong>Nível {evolutionLevel}</strong><span>{levelXp} / 500 XP para o próximo nível</span></div>
                  <div className="xp-track"><i style={{ width: `${levelXp / 5}%` }} /></div>
                </div>
              </div>
              <div className="ascension-stats">
                <div><TrendingUp size={18} /><span><strong>{totalXp.toLocaleString("pt-BR")}</strong><small>XP total</small></span></div>
                <div><Activity size={18} /><span><strong>{Math.round(accumulatedMinutes / 60)}h</strong><small>esforço registrado</small></span></div>
                <div><Trophy size={18} /><span><strong>{archetypeProgress}%</strong><small>arquétipo atual</small></span></div>
              </div>
            </section>

            <div className="evolution-top-grid">
              <form className="evolution-log panel" onSubmit={logEvolutionActivity}>
                <div className="panel-heading">
                  <div><span className="eyebrow">REGISTRAR ESFORÇO</span><h3>O sistema recompensa ação</h3></div>
                  <span className="evolution-icon"><Plus size={18} /></span>
                </div>
                <p>Registre o que você realmente executou. O tempo gera XP e fortalece a habilidade relacionada.</p>
                <label>
                  <span>Categoria</span>
                  <select value={activityType} onChange={(event) => setActivityType(event.target.value as EvolutionLog["type"])}>
                    {Object.entries(activityTypes).map(([type, activity]) => <option key={type} value={type}>{activity.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Atividade realizada</span>
                  <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Ex.: corri 5 km ou li 30 páginas" />
                </label>
                <label>
                  <span>Duração</span>
                  <div className="activity-duration">
                    {[30, 45, 60, 90].map((duration) => (
                      <button key={duration} type="button" className={activityMinutes === duration ? "active" : ""} onClick={() => setActivityMinutes(duration)}>{duration} min</button>
                    ))}
                  </div>
                </label>
                <button className="primary-button wide" type="submit"><Zap size={18} /> Registrar e receber XP</button>
              </form>

              <section className="missions-panel panel">
                <div className="panel-heading">
                  <div><span className="eyebrow">MISSÕES DE PROGRESSO</span><h3>{completedMissions} de 4 pilares ativados</h3></div>
                  <span className="mission-count">{completedMissions}/4</span>
                </div>
                <div className="mission-progress"><i style={{ width: `${completedMissions * 25}%` }} /></div>
                <div className="mission-list">
                  {[
                    { icon: Dumbbell, title: "Forjar o corpo", text: "Corrida ou treino de força", done: evolutionLogs.some((log) => log.type === "run" || log.type === "strength") },
                    { icon: BookOpen, title: "Alimentar o intelecto", text: "Leitura com notas próprias", done: evolutionLogs.some((log) => log.type === "reading") },
                    { icon: BrainCircuit, title: "Entrar em foco profundo", text: "Estudo sem distração", done: evolutionLogs.some((log) => log.type === "study") },
                    { icon: BriefcaseBusiness, title: "Criar valor no mundo", text: "Negócio, projeto ou comunicação", done: evolutionLogs.some((log) => log.type === "business" || log.type === "communication") },
                  ].map((mission) => {
                    const Icon = mission.icon;
                    return (
                      <div key={mission.title} className={mission.done ? "complete" : ""}>
                        <span><Icon size={19} /></span>
                        <p><strong>{mission.title}</strong><small>{mission.text}</small></p>
                        {mission.done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                      </div>
                    );
                  })}
                </div>
                <small className="mission-note">A consistência abre novas etapas. Um único dia forte não substitui centenas de dias comuns bem executados.</small>
              </section>
            </div>

            <section className="skills-section panel">
              <div className="panel-heading skills-heading">
                <div><span className="eyebrow">ATRIBUTOS CENTRAIS</span><h3>Seis habilidades que sustentam sua evolução</h3></div>
                <span className="skills-average">Média {Math.round(Object.values(skillLevels).reduce((total, level) => total + level, 0) / 6)}</span>
              </div>
              <div className="skills-grid">
                {(Object.entries(skillMeta) as [SkillKey, (typeof skillMeta)[SkillKey]][]).map(([skill, meta]) => (
                  <article key={skill}>
                    <div><span>{meta.label.slice(0, 2).toUpperCase()}</span><p><strong>{meta.label}</strong><small>{meta.description}</small></p><b>{skillLevels[skill]}</b></div>
                    <div className="skill-track"><i style={{ width: `${skillLevels[skill]}%` }} /></div>
                  </article>
                ))}
              </div>
            </section>

            <section className="archetype-section">
              <div className="archetype-header">
                <div>
                  <span className="eyebrow ascension-label"><Crown size={14} /> CAMINHOS DE MAESTRIA</span>
                  <h2>Escolha quem você quer se tornar.</h2>
                  <p>Cada arquétipo exige uma combinação de habilidades, marcos concretos e anos de trabalho. Você pode mudar o caminho sem perder sua evolução.</p>
                </div>
                <div className="years-warning"><Clock3 size={20} /><span><strong>Horizonte real</strong><small>3 a 6 anos de consistência</small></span></div>
              </div>

              <div className="archetype-cards">
                {archetypes.map((archetype) => {
                  const requirements = Object.entries(archetype.requirements) as [SkillKey, number][];
                  const progress = Math.round(requirements.reduce((total, [skill, requirement]) => total + Math.min(skillLevels[skill] / requirement, 1), 0) / requirements.length * 100);
                  const Icon = archetype.icon;
                  return (
                    <button key={archetype.id} className={selectedArchetype === archetype.id ? "active" : ""} style={{ "--archetype": archetype.color } as React.CSSProperties} onClick={() => setSelectedArchetype(archetype.id)}>
                      <span className="archetype-icon"><Icon size={22} /></span>
                      <span className="archetype-name"><strong>{archetype.name}</strong><small>{archetype.horizon}</small></span>
                      <span className="archetype-card-progress"><i style={{ width: `${progress}%` }} /></span>
                      <span className="archetype-lock">{progress >= 100 ? <Trophy size={15} /> : <LockKeyhole size={15} />} {progress}%</span>
                    </button>
                  );
                })}
              </div>

              <div className="archetype-detail panel" style={{ "--archetype": activeArchetype.color } as React.CSSProperties}>
                <div className="archetype-detail-intro">
                  <div className="archetype-title-row">
                    <span><ActiveArchetypeIcon size={27} /></span>
                    <div><span className="eyebrow">ARQUÉTIPO SELECIONADO</span><h3>{activeArchetype.name}</h3></div>
                  </div>
                  <p>{activeArchetype.subtitle}</p>
                  <div className="archetype-big-progress">
                    <div><span>Prontidão atual</span><strong>{archetypeProgress}%</strong></div>
                    <div><i style={{ width: `${archetypeProgress}%` }} /></div>
                  </div>
                  <h4>Requisitos de atributos</h4>
                  <div className="requirements-list">
                    {archetypeRequirements.map(([skill, requirement]) => (
                      <div key={skill}>
                        <div><span>{skillMeta[skill].label}</span><strong>{skillLevels[skill]} <small>/ {requirement}</small></strong></div>
                        <div><i style={{ width: `${Math.min(skillLevels[skill] / requirement * 100, 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                  <h4>Marcos incontornáveis</h4>
                  <ul className="milestone-list">
                    {activeArchetype.milestones.map((milestone) => <li key={milestone}><Target size={16} />{milestone}</li>)}
                  </ul>
                </div>

                <div className="roadmap-column">
                  <div className="roadmap-heading"><span className="eyebrow">ROTA DE LONGO PRAZO</span><h3>{activeArchetype.horizon} de construção</h3></div>
                  <div className="roadmap-timeline">
                    {activeArchetype.phases.map((phase, index) => (
                      <article key={phase.name}>
                        <span className="roadmap-node">{index + 1}</span>
                        <div>
                          <span>{phase.period}</span>
                          <h4>{phase.name}</h4>
                          <ul>{phase.actions.map((action) => <li key={action}>{action}</li>)}</ul>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="evolution-history panel">
              <div className="panel-heading"><div><span className="eyebrow">HISTÓRICO DE ESFORÇO</span><h3>As evidências da sua construção</h3></div><span>{evolutionLogs.length} registros</span></div>
              {evolutionLogs.length ? (
                <div className="evolution-history-list">
                  {evolutionLogs.slice(0, 8).map((log) => (
                    <div key={log.id}>
                      <span className="history-icon"><Activity size={17} /></span>
                      <p><strong>{log.title}</strong><small>{activityTypes[log.type].label} · {log.minutes} min · {new Date(log.createdAt).toLocaleDateString("pt-BR")}</small></p>
                      <strong>+{log.xp} XP</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="history-empty"><Shield size={27} /><p><strong>Sua história começa com a primeira evidência.</strong><small>Registre uma leitura, treino ou sessão de trabalho acima.</small></p></div>
              )}
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

        {tab === "plans" && (
          <div className="plans-page">
            <section className="plans-header">
              <div>
                <span className="eyebrow lime">PLANEJAMENTO PERSONALIZADO</span>
                <h2>Um plano que cabe na sua rotina.</h2>
                <p>Defina sua disponibilidade e o Nexo distribui os tópicos prioritários em sessões objetivas, com revisão e questões.</p>
              </div>
              {studyPlan.length > 0 && (
                <div className="plan-progress-card">
                  <span>Progresso do plano</span>
                  <strong>{planProgress}%</strong>
                  <div className="goal-bar"><i style={{ width: `${planProgress}%` }} /></div>
                  <small>{planCompletedCount} de {planSessionCount} sessões concluídas</small>
                </div>
              )}
            </section>

            <div className="plans-layout">
              <form className="plan-builder panel" onSubmit={createStudyPlan}>
                <div className="panel-heading">
                  <div><span className="eyebrow">CONFIGURAÇÃO</span><h3>Monte seu cronograma</h3></div>
                  <span className="builder-icon"><SlidersHorizontal size={18} /></span>
                </div>

                <label className="plan-field">
                  <span>Nome do plano</span>
                  <input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Ex.: Reta final C-PRO I" required />
                </label>

                <div className="plan-field-grid">
                  <label className="plan-field">
                    <span>Prazo</span>
                    <select value={planWeeks} onChange={(event) => setPlanWeeks(Number(event.target.value))}>
                      {[2, 4, 6, 8, 10, 12, 16].map((weeks) => <option key={weeks} value={weeks}>{weeks} semanas</option>)}
                    </select>
                  </label>
                  <label className="plan-field">
                    <span>Dias por semana</span>
                    <select value={planDays} onChange={(event) => setPlanDays(Number(event.target.value))}>
                      {[3, 4, 5, 6, 7].map((days) => <option key={days} value={days}>{days} dias</option>)}
                    </select>
                  </label>
                </div>

                <label className="plan-field">
                  <span>Tempo por sessão</span>
                  <div className="time-options">
                    {[30, 45, 60, 90].map((minutesOption) => (
                      <button
                        key={minutesOption}
                        type="button"
                        className={planMinutes === minutesOption ? "active" : ""}
                        aria-pressed={planMinutes === minutesOption}
                        onClick={() => setPlanMinutes(minutesOption)}
                      >
                        {minutesOption} min
                      </button>
                    ))}
                  </div>
                </label>

                <fieldset className="topic-selector">
                  <legend>Tópicos prioritários</legend>
                  {mapping.topics.map((topic) => {
                    const selected = selectedPlanTopics.includes(topic.title);
                    return (
                      <button
                        key={topic.title}
                        type="button"
                        className={selected ? "selected" : ""}
                        aria-pressed={selected}
                        onClick={() => setSelectedPlanTopics((current) =>
                          selected ? current.filter((title) => title !== topic.title) : [...current, topic.title]
                        )}
                      >
                        <span>{selected ? <Check size={15} /> : <Plus size={15} />}</span>
                        <div><strong>{topic.title}</strong><small><StatusPill status={topic.status} /></small></div>
                      </button>
                    );
                  })}
                </fieldset>

                <div className="plan-summary-strip">
                  <span><strong>{planWeeks * planDays}</strong> sessões</span>
                  <span><strong>{Math.round((planWeeks * planDays * planMinutes) / 60)}h</strong> totais</span>
                  <span><strong>{selectedPlanTopics.length}</strong> prioridades</span>
                </div>
                <button className="primary-button wide" type="submit"><CalendarDays size={18} /> Criar plano personalizado</button>
              </form>

              <section className="plan-preview panel">
                {activePlanWeek ? (
                  <>
                    <div className="panel-heading plan-preview-heading">
                      <div><span className="eyebrow">{planName.toUpperCase()}</span><h3>Semana {activePlanWeek.week} de {studyPlan.length}</h3></div>
                      <button className="outline-button compact" onClick={addPlanToGoals}><Target size={16} /> Levar para metas</button>
                    </div>
                    <div className="week-focus"><span>TEMA DA SEMANA</span><strong>{activePlanWeek.theme}</strong></div>
                    <div className="plan-session-list">
                      {activePlanWeek.sessions.map((session) => (
                        <button key={session.id} className={session.done ? "done" : ""} onClick={() => togglePlanSession(session.id)}>
                          <span className="session-check">{session.done ? <Check size={16} /> : session.day.slice(0, 3)}</span>
                          <div><strong>{session.topic}</strong><small>{session.activity}</small></div>
                          <span className="session-time"><Clock3 size={14} /> {session.minutes} min</span>
                        </button>
                      ))}
                    </div>
                    <div className="week-navigation">
                      <button disabled={planWeekView === 0} onClick={() => setPlanWeekView((week) => week - 1)}><ChevronLeft size={17} /> Anterior</button>
                      <div>{studyPlan.map((week, index) => <button key={week.week} aria-label={`Abrir semana ${week.week}`} className={index === planWeekView ? "active" : ""} onClick={() => setPlanWeekView(index)} />)}</div>
                      <button disabled={planWeekView === studyPlan.length - 1} onClick={() => setPlanWeekView((week) => week + 1)}>Próxima <ChevronRight size={17} /></button>
                    </div>
                  </>
                ) : (
                  <div className="plan-empty">
                    <span><ListChecks size={33} /></span>
                    <strong>Seu cronograma aparecerá aqui</strong>
                    <p>Escolha os tópicos, o prazo e sua disponibilidade. O plano será salvo automaticamente neste dispositivo.</p>
                    <div className="empty-week">
                      {[1, 2, 3, 4].map((item) => <i key={item} style={{ width: `${95 - item * 9}%` }} />)}
                    </div>
                  </div>
                )}
              </section>
            </div>
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
