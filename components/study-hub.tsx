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
  HardDrive,
  Layers3,
  Link2,
  ListChecks,
  LockKeyhole,
  LoaderCircle,
  Menu,
  MessageCircle,
  MoreVertical,
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
import { AccountControl } from "@/components/account-control";
import { ActiveReview } from "@/components/active-review";
import { StudyMapsLibrary, ThemesWorkspace } from "@/components/content-workspaces";
import { RankAssessment } from "@/components/rank-assessment";
import { ApiClientError, readApiResponse } from "@/lib/api-contract";
import { professionalAreas, type AssessmentResult, type ProfessionalArea, type SkillKey, type SkillLevels } from "@/lib/assessment";
import type { GeneratedArchetype } from "@/lib/archetypes";
import { emptyPathProgress, type ContentMapping, type LearningPath, type LearningTopic, type PathProgress, type StudyMapRecord, type ThemeRecord, type TopicPriority as LearningTopicPriority, type TopicStatus as LearningTopicStatus } from "@/lib/learning";

type Tab = "dashboard" | "mapping" | "themes" | "review" | "evolution" | "sessions" | "plans";
type TopicStatus = LearningTopicStatus;
type TopicPriority = LearningTopicPriority;
type Topic = LearningTopic;
type Mapping = ContentMapping;
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
  category?: "study" | "revision" | "exercise" | "reading" | "project";
  difficulty?: "easy" | "medium" | "hard";
  xp?: number;
  dueDate?: string;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  mapId?: string;
  themeId?: string;
};
type StudyWeek = { week: number; theme: string; sessions: PlanSession[] };
type StudyPlanRecord = { id: string; name: string; createdAt: string; weeks: StudyWeek[] };
type EvolutionLog = {
  id: number;
  sourceId?: string;
  type: "run" | "strength" | "reading" | "study" | "business" | "communication";
  title: string;
  minutes: number;
  xp: number;
  createdAt: string;
  description?: string;
  difficulty?: "easy" | "medium" | "hard";
  dueDate?: string;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  mapId?: string;
  themeId?: string;
  status?: "pending" | "completed";
  order?: number;
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
  dailyProtocol: string[];
  weeklyPath: { day: string; focus: string; actions: string[] }[];
  area?: string;
  fitScore?: number;
  rationale?: string;
  successPattern?: string;
  caseModels?: { name: string; lesson: string }[];
};

type DashboardState = {
  version: 4;
  goals: Goal[];
  studyPlans: StudyPlanRecord[];
  activePlanId: string;
  skillLevels: SkillLevels;
  evolutionLogs: EvolutionLog[];
  assessmentResult: AssessmentResult | null;
  dailyMissionChecks: string[];
  primaryArchetypeId: string;
  secondaryArchetypeId: string;
  generatedArchetypes: GeneratedArchetype[];
  archetypeSummary: string;
  archetypeArea: ProfessionalArea;
  archetypeContext: string;
  mapping: Mapping;
  courseName: string;
  studyGoal: string;
  transcript: string;
  syllabus: string;
  syllabusName: string;
  quiz: Quiz[];
  flashcards: Flashcard[];
  sessionMode: "focus" | "break";
  themes: ThemeRecord[];
  studyMaps: StudyMapRecord[];
  activeStudyMapId: string;
  learningPaths: LearningPath[];
  learningProgress: Record<string, PathProgress>;
};

const initialMapping: Mapping = {
  summary: "Seu mapa começa vazio. Cadastre abaixo os módulos e tópicos que fazem parte do seu objetivo.",
  coverage: 0,
  topics: [],
  nextSteps: [],
};

const priorityLabels: Record<TopicPriority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const initialGoals: Goal[] = [];

const skillMeta: Record<SkillKey, { label: string; description: string }> = {
  body: { label: "Corpo", description: "Força, corrida, recuperação e energia" },
  knowledge: { label: "Intelecto", description: "Leitura, estudo profundo e repertório" },
  discipline: { label: "Disciplina", description: "Consistência, rotina e execução" },
  communication: { label: "Comunicação", description: "Oratória, escrita e influência" },
  capital: { label: "Capital", description: "Negócios, finanças e criação de valor" },
  leadership: { label: "Liderança", description: "Decisão, responsabilidade e pessoas" },
};

const initialSkills: SkillLevels = {
  body: 0,
  knowledge: 0,
  discipline: 0,
  communication: 0,
  capital: 0,
  leadership: 0,
};

const generatedColors = ["#a78bfa", "#22d3ee", "#f59e0b", "#34d399", "#fb7185", "#60a5fa", "#e879f9", "#facc15"];

const rankOrder = ["E", "D", "C", "B", "A", "S"] as const;
const rankRequirements: Record<(typeof rankOrder)[number], { score: number; records: number; days: number; hours: number; pillars: number }> = {
  E: { score: 0, records: 0, days: 0, hours: 0, pillars: 0 },
  D: { score: 30, records: 5, days: 3, hours: 3, pillars: 1 },
  C: { score: 45, records: 20, days: 10, hours: 12, pillars: 2 },
  B: { score: 60, records: 60, days: 30, hours: 50, pillars: 3 },
  A: { score: 75, records: 160, days: 90, hours: 160, pillars: 5 },
  S: { score: 90, records: 500, days: 240, hours: 500, pillars: 6 },
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
    dailyProtocol: ["45 min de leitura profunda", "20 min de notas conectadas", "Explicar uma ideia sem consulta", "10 min de revisão e pergunta aberta"],
    weeklyPath: [
      { day: "Segunda", focus: "Fundamentos", actions: ["Estudar um conceito-base", "Criar 3 notas permanentes"] },
      { day: "Terça", focus: "Conexões", actions: ["Relacionar duas áreas", "Desenhar um mapa mental"] },
      { day: "Quarta", focus: "Argumentação", actions: ["Escrever uma tese curta", "Buscar uma objeção forte"] },
      { day: "Quinta", focus: "Ensino", actions: ["Explicar por 10 minutos", "Corrigir pontos de dúvida"] },
      { day: "Sexta", focus: "Síntese", actions: ["Resumir a semana em uma página", "Escolher a próxima pergunta"] },
      { day: "Sábado", focus: "Obra longa", actions: ["90 min de projeto autoral", "Organizar referências"] },
      { day: "Domingo", focus: "Reflexão", actions: ["Revisar notas", "Planejar o ciclo seguinte"] },
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
    dailyProtocol: ["Conversar com 1 cliente ou usuário", "60 min construindo ou vendendo", "Revisar caixa e indicador principal", "Registrar uma decisão e seu motivo"],
    weeklyPath: [
      { day: "Segunda", focus: "Mercado", actions: ["Entrevistar cliente", "Atualizar lista de problemas"] },
      { day: "Terça", focus: "Oferta", actions: ["Melhorar proposta de valor", "Fazer 5 contatos comerciais"] },
      { day: "Quarta", focus: "Produto", actions: ["Entregar melhoria mensurável", "Observar uso real"] },
      { day: "Quinta", focus: "Vendas", actions: ["Apresentar oferta", "Tratar objeções por escrito"] },
      { day: "Sexta", focus: "Números", actions: ["Revisar receita, margem e caixa", "Eliminar um desperdício"] },
      { day: "Sábado", focus: "Sistema", actions: ["Documentar um processo", "Automatizar uma tarefa"] },
      { day: "Domingo", focus: "Direção", actions: ["Revisar aprendizados", "Definir uma aposta da semana"] },
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
    dailyProtocol: ["10 min de mobilidade", "Executar o treino do ciclo ou recuperação ativa", "Registrar carga e percepção de esforço", "Proteger sono, hidratação e alimentação"],
    weeklyPath: [
      { day: "Segunda", focus: "Força", actions: ["Treino de força principal", "Mobilidade de quadril e tornozelo"] },
      { day: "Terça", focus: "Base aeróbica", actions: ["Cardio leve", "Respiração e recuperação"] },
      { day: "Quarta", focus: "Técnica", actions: ["Treino técnico", "Core e estabilidade"] },
      { day: "Quinta", focus: "Intensidade", actions: ["Sessão de qualidade adequada ao nível", "Registrar resposta corporal"] },
      { day: "Sexta", focus: "Recuperação", actions: ["Caminhada ou mobilidade", "Revisar sono e fadiga"] },
      { day: "Sábado", focus: "Longo", actions: ["Sessão longa progressiva", "Nutrição e hidratação planejadas"] },
      { day: "Domingo", focus: "Reconstrução", actions: ["Descanso", "Planejar cargas da próxima semana"] },
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
    dailyProtocol: ["Definir as 3 prioridades do dia", "Tomar uma decisão com critérios explícitos", "Dar contexto ou feedback a alguém", "Revisar responsabilidade, impacto e pendências"],
    weeklyPath: [
      { day: "Segunda", focus: "Direção", actions: ["Definir resultados da semana", "Alinhar responsáveis"] },
      { day: "Terça", focus: "Pessoas", actions: ["Dar feedback específico", "Remover um bloqueio da equipe"] },
      { day: "Quarta", focus: "Decisão", actions: ["Analisar uma decisão difícil", "Registrar premissas e riscos"] },
      { day: "Quinta", focus: "Comunicação", actions: ["Conduzir conversa ou reunião", "Confirmar entendimento"] },
      { day: "Sexta", focus: "Entrega", actions: ["Revisar indicadores", "Cobrar acordos com respeito"] },
      { day: "Sábado", focus: "Capacidade", actions: ["Estudar liderança ou estratégia", "Mentorar uma pessoa"] },
      { day: "Domingo", focus: "Caráter", actions: ["Revisar decisões e consequências", "Planejar com margem e clareza"] },
    ],
  },
];

const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "Visão geral", icon: BarChart3 },
  { id: "mapping", label: "Mapas de Estudos", icon: Layers3 },
  { id: "themes", label: "Temas", icon: BookMarked },
  { id: "review", label: "Revisão Ativa", icon: BrainCircuit },
  { id: "evolution", label: "Ascensão", icon: Shield },
  { id: "sessions", label: "Estudos", icon: Video },
  { id: "plans", label: "Planos", icon: CalendarDays },
];

function calculateCoverage(topics: Topic[]) {
  if (!topics.length) return 0;
  const score = topics.reduce((total, topic) => {
    if (topic.status === "covered") return total + 1;
    if (topic.status === "partial") return total + 0.5;
    return total;
  }, 0);
  return Math.round(score / topics.length * 100);
}

function calculateCurrentStreak(logs: EvolutionLog[]) {
  const activeDays = new Set(logs.map((log) => log.createdAt.slice(0, 10)));
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  const dayKey = () => cursor.toISOString().slice(0, 10);
  if (!activeDays.has(dayKey())) cursor.setUTCDate(cursor.getUTCDate() - 1);
  if (!activeDays.has(dayKey())) return 0;
  let streak = 0;
  while (activeDays.has(dayKey())) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function StatusPill({ status }: { status: TopicStatus }) {
  const labels = { planned: "Planejado", covered: "Coberto", partial: "Parcial", gap: "Lacuna" };
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

export function StudyHub({
  accountId,
  authEnabled = false,
  cloudEnabled = false,
}: {
  accountId?: string;
  authEnabled?: boolean;
  cloudEnabled?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(50 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [sessionMode, setSessionMode] = useState<"focus" | "break">("focus");
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [goalText, setGoalText] = useState("");
  const [planName, setPlanName] = useState("Meu plano de estudos");
  const [planWeeks, setPlanWeeks] = useState(8);
  const [planDays, setPlanDays] = useState(5);
  const [planMinutes, setPlanMinutes] = useState(60);
  const [selectedPlanTopics, setSelectedPlanTopics] = useState<string[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlanRecord[]>([]);
  const [activePlanId, setActivePlanId] = useState("");
  const [planWeekView, setPlanWeekView] = useState(0);
  const [skillLevels, setSkillLevels] = useState<SkillLevels>(initialSkills);
  const [evolutionLogs, setEvolutionLogs] = useState<EvolutionLog[]>([]);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [dailyMissionChecks, setDailyMissionChecks] = useState<string[]>([]);
  const [activityType, setActivityType] = useState<EvolutionLog["type"]>("reading");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityMinutes, setActivityMinutes] = useState(45);
  const [activityDescription, setActivityDescription] = useState("");
  const [activityDifficulty, setActivityDifficulty] = useState<NonNullable<EvolutionLog["difficulty"]>>("medium");
  const [activityXp, setActivityXp] = useState(0);
  const [activityDueDate, setActivityDueDate] = useState("");
  const [activityRecurrence, setActivityRecurrence] = useState<NonNullable<EvolutionLog["recurrence"]>>("none");
  const [activityMapId, setActivityMapId] = useState("");
  const [activityThemeId, setActivityThemeId] = useState("");
  const [activityStatus, setActivityStatus] = useState<NonNullable<EvolutionLog["status"]>>("completed");
  const [selectedArchetype, setSelectedArchetype] = useState("sage");
  const [secondaryArchetype, setSecondaryArchetype] = useState("entrepreneur");
  const [generatedArchetypes, setGeneratedArchetypes] = useState<GeneratedArchetype[]>([]);
  const [archetypeSummary, setArchetypeSummary] = useState("");
  const [archetypeArea, setArchetypeArea] = useState<ProfessionalArea>("technology");
  const [archetypeContext, setArchetypeContext] = useState("");
  const [archetypeError, setArchetypeError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [syllabusName, setSyllabusName] = useState("");
  const [mapping, setMapping] = useState<Mapping>(initialMapping);
  const [courseName, setCourseName] = useState("");
  const [studyGoal, setStudyGoal] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [topicModule, setTopicModule] = useState("");
  const [topicReference, setTopicReference] = useState("");
  const [topicParentId, setTopicParentId] = useState("");
  const [topicPriority, setTopicPriority] = useState<TopicPriority>("high");
  const [topicAiPrompt, setTopicAiPrompt] = useState("");
  const [quiz, setQuiz] = useState<Quiz[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "Olá. Posso explicar um trecho, criar exemplos ou montar uma revisão com base na sua aula." },
  ]);
  const [storageReady, setStorageReady] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(!cloudEnabled);
  const [cloudStatus, setCloudStatus] = useState<"local" | "loading" | "saving" | "saved" | "error">(cloudEnabled ? "loading" : "local");
  const [legacyImportAvailable, setLegacyImportAvailable] = useState(false);
  const [themes, setThemes] = useState<ThemeRecord[]>([]);
  const [studyMaps, setStudyMaps] = useState<StudyMapRecord[]>([]);
  const [activeStudyMapId, setActiveStudyMapId] = useState("");
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [learningProgress, setLearningProgress] = useState<Record<string, PathProgress>>({});
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [activityMenuId, setActivityMenuId] = useState<number | null>(null);
  const [planSessionMenuId, setPlanSessionMenuId] = useState<string | null>(null);
  const [editingPlanSession, setEditingPlanSession] = useState<PlanSession | null>(null);
  const dashboardStorageKey = accountId ? `nexo-dashboard-v4:${accountId}` : "nexo-dashboard-v4";
  const legacyMarkerKey = `nexo-legacy-reviewed:${accountId || "local"}`;

  useEffect(() => {
    try {
      const v3 = window.localStorage.getItem(dashboardStorageKey) || window.localStorage.getItem(accountId ? `nexo-dashboard-v3:${accountId}` : "nexo-dashboard-v3");
      if (v3) {
        const state = JSON.parse(v3) as Partial<DashboardState>;
        if (Array.isArray(state.goals)) setGoals(state.goals);
        if (Array.isArray(state.studyPlans)) setStudyPlans(state.studyPlans);
        if (typeof state.activePlanId === "string") setActivePlanId(state.activePlanId);
        if (state.skillLevels) setSkillLevels(state.skillLevels);
        if (Array.isArray(state.evolutionLogs)) setEvolutionLogs(state.evolutionLogs);
        if (state.assessmentResult?.version === 3) setAssessmentResult(state.assessmentResult);
        if (Array.isArray(state.dailyMissionChecks)) setDailyMissionChecks(state.dailyMissionChecks);
        if (typeof state.primaryArchetypeId === "string") setSelectedArchetype(state.primaryArchetypeId);
        if (typeof state.secondaryArchetypeId === "string") setSecondaryArchetype(state.secondaryArchetypeId);
        if (Array.isArray(state.generatedArchetypes)) setGeneratedArchetypes(state.generatedArchetypes);
        if (typeof state.archetypeSummary === "string") setArchetypeSummary(state.archetypeSummary);
        if (state.archetypeArea) setArchetypeArea(state.archetypeArea);
        if (typeof state.archetypeContext === "string") setArchetypeContext(state.archetypeContext);
        if (state.mapping) setMapping(state.mapping);
        if (typeof state.courseName === "string") setCourseName(state.courseName);
        if (typeof state.studyGoal === "string") setStudyGoal(state.studyGoal);
        if (typeof state.transcript === "string") setTranscript(state.transcript);
        if (typeof state.syllabus === "string") setSyllabus(state.syllabus);
        if (typeof state.syllabusName === "string") setSyllabusName(state.syllabusName);
        if (Array.isArray(state.quiz)) setQuiz(state.quiz);
        if (Array.isArray(state.flashcards)) setFlashcards(state.flashcards);
        if (state.sessionMode) setSessionMode(state.sessionMode);
        if (Array.isArray(state.themes)) setThemes(state.themes);
        if (Array.isArray(state.studyMaps)) setStudyMaps(state.studyMaps);
        if (typeof state.activeStudyMapId === "string") setActiveStudyMapId(state.activeStudyMapId);
        if (Array.isArray(state.learningPaths)) setLearningPaths(state.learningPaths);
        if (state.learningProgress && typeof state.learningProgress === "object") setLearningProgress(state.learningProgress);
      } else if (!authEnabled) {
        const stored = window.localStorage.getItem("nexo-goals-v1");
        if (stored) setGoals(JSON.parse(stored));
        const storedPlans = window.localStorage.getItem("nexo-study-plans-v2");
        if (storedPlans) setStudyPlans(JSON.parse(storedPlans));
        const storedActivePlan = window.localStorage.getItem("nexo-active-plan-v2");
        if (storedActivePlan) setActivePlanId(storedActivePlan);
        const storedSkills = window.localStorage.getItem("nexo-skills-v2");
        if (storedSkills) setSkillLevels(JSON.parse(storedSkills));
        const storedEvolution = window.localStorage.getItem("nexo-evolution-v2");
        if (storedEvolution) setEvolutionLogs(JSON.parse(storedEvolution));
        const storedAssessment = window.localStorage.getItem("nexo-assessment-v2");
        if (storedAssessment) {
          const parsed = JSON.parse(storedAssessment) as AssessmentResult;
          if (parsed.version === 3) setAssessmentResult(parsed);
        }
        const storedMissions = window.localStorage.getItem("nexo-daily-missions-v1");
        if (storedMissions) setDailyMissionChecks(JSON.parse(storedMissions));
        const storedArchetype = window.localStorage.getItem("nexo-archetype-v1");
        if (storedArchetype) setSelectedArchetype(storedArchetype);
        const storedMapping = window.localStorage.getItem("nexo-personal-map-v1");
        if (storedMapping) setMapping(JSON.parse(storedMapping));
        const storedCourse = window.localStorage.getItem("nexo-course-name-v1");
        if (storedCourse) setCourseName(storedCourse);
        const storedGoal = window.localStorage.getItem("nexo-study-goal-v1");
        if (storedGoal) setStudyGoal(storedGoal);
      }
      if (authEnabled && !window.localStorage.getItem(legacyMarkerKey)) {
        const hasLegacy = Boolean(
          window.localStorage.getItem("nexo-dashboard-v3")
            || window.localStorage.getItem("nexo-personal-map-v1")
            || window.localStorage.getItem("nexo-study-plans-v2")
            || window.localStorage.getItem("nexo-evolution-v2"),
        );
        setLegacyImportAvailable(hasLegacy);
      }
    } catch {
      setNotice("Alguns dados locais antigos não puderam ser lidos. Nenhum arquivo foi apagado.");
    } finally {
      setStorageReady(true);
    }
  }, [authEnabled, dashboardStorageKey, legacyMarkerKey, accountId]);

  const dashboardState = useMemo<DashboardState>(() => ({
    version: 4,
    goals,
    studyPlans,
    activePlanId,
    skillLevels,
    evolutionLogs,
    assessmentResult,
    dailyMissionChecks,
    primaryArchetypeId: selectedArchetype,
    secondaryArchetypeId: secondaryArchetype,
    generatedArchetypes,
    archetypeSummary,
    archetypeArea,
    archetypeContext,
    mapping,
    courseName,
    studyGoal,
    transcript,
    syllabus,
    syllabusName,
    quiz,
    flashcards,
    sessionMode,
    themes,
    studyMaps,
    activeStudyMapId,
    learningPaths,
    learningProgress,
  }), [goals, studyPlans, activePlanId, skillLevels, evolutionLogs, assessmentResult, dailyMissionChecks, selectedArchetype, secondaryArchetype, generatedArchetypes, archetypeSummary, archetypeArea, archetypeContext, mapping, courseName, studyGoal, transcript, syllabus, syllabusName, quiz, flashcards, sessionMode, themes, studyMaps, activeStudyMapId, learningPaths, learningProgress]);

  useEffect(() => {
    if (!storageReady || (cloudEnabled && !cloudLoaded)) return;
    window.localStorage.setItem(dashboardStorageKey, JSON.stringify(dashboardState));
  }, [dashboardState, dashboardStorageKey, storageReady, cloudEnabled, cloudLoaded]);

  useEffect(() => {
    if (!cloudEnabled || !storageReady) return;
    let cancelled = false;
    async function loadCloudState() {
      setCloudStatus("loading");
      try {
        const response = await fetch("/api/user-data", { cache: "no-store" });
        const payload = await readApiResponse<{ state?: Partial<DashboardState> | null }>(response);
        if (cancelled) return;
        const state = payload.state;
        if (state) {
          setLegacyImportAvailable(false);
          if (Array.isArray(state.goals)) setGoals(state.goals);
          if (Array.isArray(state.studyPlans)) setStudyPlans(state.studyPlans);
          if (typeof state.activePlanId === "string") setActivePlanId(state.activePlanId);
          if (state.skillLevels) setSkillLevels(state.skillLevels);
          if (Array.isArray(state.evolutionLogs)) setEvolutionLogs(state.evolutionLogs);
          setAssessmentResult(state.assessmentResult?.version === 3 ? state.assessmentResult : null);
          if (Array.isArray(state.dailyMissionChecks)) setDailyMissionChecks(state.dailyMissionChecks);
          if (typeof state.primaryArchetypeId === "string") setSelectedArchetype(state.primaryArchetypeId);
          if (typeof state.secondaryArchetypeId === "string") setSecondaryArchetype(state.secondaryArchetypeId);
          if (Array.isArray(state.generatedArchetypes)) setGeneratedArchetypes(state.generatedArchetypes);
          if (typeof state.archetypeSummary === "string") setArchetypeSummary(state.archetypeSummary);
          if (state.archetypeArea) setArchetypeArea(state.archetypeArea);
          if (typeof state.archetypeContext === "string") setArchetypeContext(state.archetypeContext);
          if (state.mapping) setMapping(state.mapping);
          if (typeof state.courseName === "string") setCourseName(state.courseName);
          if (typeof state.studyGoal === "string") setStudyGoal(state.studyGoal);
          if (typeof state.transcript === "string") setTranscript(state.transcript);
          if (typeof state.syllabus === "string") setSyllabus(state.syllabus);
          if (typeof state.syllabusName === "string") setSyllabusName(state.syllabusName);
          if (Array.isArray(state.quiz)) setQuiz(state.quiz);
          if (Array.isArray(state.flashcards)) setFlashcards(state.flashcards);
          if (state.sessionMode) setSessionMode(state.sessionMode);
          if (Array.isArray(state.themes)) setThemes(state.themes);
          if (Array.isArray(state.studyMaps)) setStudyMaps(state.studyMaps);
          if (typeof state.activeStudyMapId === "string") setActiveStudyMapId(state.activeStudyMapId);
          if (Array.isArray(state.learningPaths)) setLearningPaths(state.learningPaths);
          if (state.learningProgress && typeof state.learningProgress === "object") setLearningProgress(state.learningProgress);
        }
        setCloudStatus(state ? "saved" : "saving");
      } catch (error) {
        if (!cancelled) {
          setCloudStatus("error");
          setNotice(error instanceof Error ? `${error.message} Seus dados locais continuam disponíveis.` : "Não foi possível carregar a nuvem.");
        }
      } finally {
        if (!cancelled) setCloudLoaded(true);
      }
    }
    loadCloudState();
    return () => { cancelled = true; };
  }, [cloudEnabled, storageReady]);

  useEffect(() => {
    if (!cloudEnabled || !cloudLoaded || !storageReady) return;
    setCloudStatus("saving");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/user-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: dashboardState }),
        });
        await readApiResponse<{ saved: boolean; updatedAt: string }>(response);
        setCloudStatus("saved");
      } catch (error) {
        setCloudStatus("error");
        setNotice(error instanceof Error ? `${error.message} Uma cópia permanece neste navegador.` : "Falha ao salvar na nuvem.");
      }
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [cloudEnabled, cloudLoaded, storageReady, dashboardState]);

  useEffect(() => {
    if (!storageReady || (cloudEnabled && !cloudLoaded) || studyMaps.length || (!mapping.topics.length && !courseName && !studyGoal)) return;
    const id = `map-migrated-${Date.now()}`;
    const now = new Date().toISOString();
    setStudyMaps([{ id, name: courseName || "Mapa importado", description: "Mapa preservado da versão anterior.", objective: studyGoal, status: "active", isPrimary: true, themeIds: [], createdAt: now, updatedAt: now, lastActivityAt: now, mapping }]);
    setActiveStudyMapId(id);
    setNotice("Seu mapa anterior foi migrado para a nova biblioteca sem perda de dados.");
  }, [storageReady, cloudEnabled, cloudLoaded, studyMaps.length, mapping, courseName, studyGoal]);

  useEffect(() => {
    if (!activeStudyMapId) return;
    setStudyMaps((current) => current.map((map) => map.id === activeStudyMapId ? {
      ...map,
      name: courseName.trim() || map.name,
      objective: studyGoal,
      mapping,
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    } : map));
  }, [activeStudyMapId, courseName, studyGoal, mapping]);

  useEffect(() => {
    const priorities = mapping.topics
      .filter((topic) => topic.status !== "covered")
      .map((topic) => topic.title);
    if (priorities.length) setSelectedPlanTopics(priorities);
  }, [mapping]);

  const focusTopic = mapping.topics.find((topic) => topic.status === "gap")?.title
    || mapping.topics.find((topic) => topic.status === "partial")?.title
    || mapping.topics.find((topic) => topic.status === "planned")?.title
    || mapping.topics[0]?.title
    || "Defina um tópico no seu mapa";

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
              title: `Sessão de foco: ${focusTopic}`,
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
  }, [timerRunning, sessionMode, focusTopic]);

  const minutes = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
  const seconds = (timerSeconds % 60).toString().padStart(2, "0");
  const completedGoals = goals.filter((goal) => goal.done).length;
  const goalProgress = goals.length ? Math.round((completedGoals / goals.length) * 100) : 0;
  const mappedTopics = mapping.topics.filter((topic) => topic.status === "covered").length;
  const activeStudyMap = studyMaps.find((map) => map.id === activeStudyMapId);
  const activePlanRecord = studyPlans.find((plan) => plan.id === activePlanId) || studyPlans[0];
  const studyPlan = activePlanRecord?.weeks || [];
  const allPlanSessions = studyPlan.flatMap((week) => week.sessions);
  const planSessionCount = studyPlan.reduce((total, week) => total + week.sessions.length, 0);
  const planCompletedCount = studyPlan.reduce(
    (total, week) => total + week.sessions.filter((session) => session.done).length,
    0,
  );
  const planProgress = planSessionCount
    ? Math.round((planCompletedCount / planSessionCount) * 100)
    : 0;
  const activePlanWeek = studyPlan[planWeekView];
  const completedEvolutionLogs = evolutionLogs.filter((log) => log.status !== "pending");
  const totalXp = completedEvolutionLogs.reduce((total, log) => total + log.xp, 0);
  const evolutionLevel = totalXp ? Math.floor(totalXp / 500) + 1 : 0;
  const levelXp = totalXp % 500;
  const accumulatedMinutes = completedEvolutionLogs.reduce((total, log) => total + log.minutes, 0);
  const evidenceDays = new Set(completedEvolutionLogs.map((log) => log.createdAt.slice(0, 10))).size;
  const evidencePillars = new Set(completedEvolutionLogs.map((log) => log.type)).size;
  const currentStreak = calculateCurrentStreak(completedEvolutionLogs);
  const averageSkill = Object.values(skillLevels).reduce((total, level) => total + level, 0) / 6;
  const liveRankScore = assessmentResult ? Math.max(assessmentResult.overall, Math.round(assessmentResult.overall * 0.6 + averageSkill * 0.4)) : 0;
  let evolutionRankIndex = assessmentResult ? rankOrder.indexOf(assessmentResult.rank) : -1;
  if (assessmentResult) {
    for (let index = evolutionRankIndex + 1; index < rankOrder.length; index += 1) {
      const requirement = rankRequirements[rankOrder[index]];
      const passed = liveRankScore >= requirement.score
        && completedEvolutionLogs.length >= requirement.records
        && evidenceDays >= requirement.days
        && accumulatedMinutes / 60 >= requirement.hours
        && evidencePillars >= requirement.pillars;
      if (!passed) break;
      evolutionRankIndex = index;
    }
  }
  const evolutionRank = evolutionRankIndex >= 0 ? rankOrder[evolutionRankIndex] : "—";
  const nextRank = evolutionRankIndex >= 0 && evolutionRankIndex < rankOrder.length - 1 ? rankOrder[evolutionRankIndex + 1] : null;
  const nextRankRequirement = nextRank ? rankRequirements[nextRank] : null;
  const availableArchetypes = useMemo<Archetype[]>(() => [
    ...archetypes,
    ...generatedArchetypes.map((archetype, index) => ({
      ...archetype,
      icon: Crown,
      color: generatedColors[index % generatedColors.length],
    })),
  ], [generatedArchetypes]);
  const activeArchetype = availableArchetypes.find((archetype) => archetype.id === selectedArchetype) || availableArchetypes[0];
  const activeSecondaryArchetype = availableArchetypes.find((archetype) => archetype.id === secondaryArchetype)
    || availableArchetypes.find((archetype) => archetype.id !== activeArchetype.id)
    || availableArchetypes[0];
  const ActiveArchetypeIcon = activeArchetype.icon;
  const archetypeRequirements = Object.entries(activeArchetype.requirements) as [SkillKey, number][];
  const archetypeProgress = Math.round(
    archetypeRequirements.reduce(
      (total, [skill, requirement]) => total + Math.min(skillLevels[skill] / requirement, 1),
      0,
    ) / archetypeRequirements.length * 100,
  );
  const completedMissions = [
    completedEvolutionLogs.some((log) => log.type === "run" || log.type === "strength"),
    completedEvolutionLogs.some((log) => log.type === "reading"),
    completedEvolutionLogs.some((log) => log.type === "study"),
    completedEvolutionLogs.some((log) => log.type === "business" || log.type === "communication"),
  ].filter(Boolean).length;

  const context = useMemo(
    () => `TRILHA: ${courseName || "Não definida"}\nOBJETIVO: ${studyGoal || "Não definido"}\n\nTRANSCRIÇÃO:\n${transcript}\n\nAPOSTILA:\n${syllabus}\n\nMAPEAMENTO:\n${JSON.stringify(mapping)}`,
    [courseName, studyGoal, transcript, syllabus, mapping],
  );

  function resetTimer(mode = sessionMode) {
    setTimerRunning(false);
    setTimerSeconds(mode === "focus" ? 50 * 60 : 10 * 60);
  }

  function changeMode(mode: "focus" | "break") {
    setSessionMode(mode);
    resetTimer(mode);
  }

  function importLegacyDashboard() {
    try {
      const savedV3 = window.localStorage.getItem("nexo-dashboard-v3");
      if (savedV3) {
        const state = JSON.parse(savedV3) as Partial<DashboardState>;
        if (Array.isArray(state.goals)) setGoals(state.goals);
        if (Array.isArray(state.studyPlans)) setStudyPlans(state.studyPlans);
        if (typeof state.activePlanId === "string") setActivePlanId(state.activePlanId);
        if (state.skillLevels) setSkillLevels(state.skillLevels);
        if (Array.isArray(state.evolutionLogs)) setEvolutionLogs(state.evolutionLogs);
        if (state.assessmentResult?.version === 3) setAssessmentResult(state.assessmentResult);
        if (Array.isArray(state.dailyMissionChecks)) setDailyMissionChecks(state.dailyMissionChecks);
        if (typeof state.primaryArchetypeId === "string") setSelectedArchetype(state.primaryArchetypeId);
        if (typeof state.secondaryArchetypeId === "string") setSecondaryArchetype(state.secondaryArchetypeId);
        if (Array.isArray(state.generatedArchetypes)) setGeneratedArchetypes(state.generatedArchetypes);
        if (typeof state.archetypeSummary === "string") setArchetypeSummary(state.archetypeSummary);
        if (state.archetypeArea) setArchetypeArea(state.archetypeArea);
        if (typeof state.archetypeContext === "string") setArchetypeContext(state.archetypeContext);
        if (state.mapping) setMapping(state.mapping);
        if (typeof state.courseName === "string") setCourseName(state.courseName);
        if (typeof state.studyGoal === "string") setStudyGoal(state.studyGoal);
        if (typeof state.transcript === "string") setTranscript(state.transcript);
        if (typeof state.syllabus === "string") setSyllabus(state.syllabus);
        if (typeof state.syllabusName === "string") setSyllabusName(state.syllabusName);
        if (Array.isArray(state.quiz)) setQuiz(state.quiz);
        if (Array.isArray(state.flashcards)) setFlashcards(state.flashcards);
      } else {
        const storedGoals = window.localStorage.getItem("nexo-goals-v1");
        const storedPlans = window.localStorage.getItem("nexo-study-plans-v2");
        const storedSkills = window.localStorage.getItem("nexo-skills-v2");
        const storedEvolution = window.localStorage.getItem("nexo-evolution-v2");
        const storedMapping = window.localStorage.getItem("nexo-personal-map-v1");
        if (storedGoals) setGoals(JSON.parse(storedGoals));
        if (storedPlans) setStudyPlans(JSON.parse(storedPlans));
        if (storedSkills) setSkillLevels(JSON.parse(storedSkills));
        if (storedEvolution) setEvolutionLogs(JSON.parse(storedEvolution));
        if (storedMapping) setMapping(JSON.parse(storedMapping));
        setCourseName(window.localStorage.getItem("nexo-course-name-v1") || "");
        setStudyGoal(window.localStorage.getItem("nexo-study-goal-v1") || "");
      }
      window.localStorage.setItem(legacyMarkerKey, "imported");
      setLegacyImportAvailable(false);
      setNotice("Painel local importado para esta conta. A cópia antiga foi preservada.");
    } catch {
      setNotice("Não foi possível importar o painel local. A cópia original não foi alterada.");
    }
  }

  function dismissLegacyImport() {
    window.localStorage.setItem(legacyMarkerKey, "ignored");
    setLegacyImportAvailable(false);
  }

  function createStudyMap(theme?: ThemeRecord) {
    const now = new Date().toISOString();
    const id = `map-${Date.now()}`;
    const map: StudyMapRecord = {
      id,
      name: theme ? `Mapa — ${theme.name}` : `Novo mapa ${studyMaps.length + 1}`,
      description: theme?.description || "",
      objective: theme?.objective || "",
      status: "active",
      isPrimary: studyMaps.length === 0,
      themeIds: theme ? [theme.id] : [],
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      mapping: { ...initialMapping, topics: [], nextSteps: [] },
    };
    setStudyMaps((current) => [map, ...current]);
    if (theme) setThemes((current) => current.map((item) => item.id === theme.id ? { ...item, mapIds: [...new Set([...item.mapIds, id])], updatedAt: now } : item));
    setActiveStudyMapId(id);
    setCourseName(map.name);
    setStudyGoal(map.objective);
    setMapping(map.mapping);
    setSelectedPlanTopics([]);
    setTab("mapping");
    setNotice(`Mapa “${map.name}” criado sem alterar os outros mapas.`);
  }

  function openStudyMap(map: StudyMapRecord) {
    setActiveStudyMapId(map.id);
    setCourseName(map.name);
    setStudyGoal(map.objective);
    setMapping(map.mapping);
    setSelectedPlanTopics(map.mapping.topics.filter((topic) => topic.status !== "covered").map((topic) => topic.title));
  }

  function updateStudyMap(map: StudyMapRecord) {
    setStudyMaps((current) => current.map((item) => item.id === map.id ? map : item));
    if (map.id === activeStudyMapId) openStudyMap(map);
  }

  function deleteStudyMap(map: StudyMapRecord) {
    const remaining = studyMaps.filter((item) => item.id !== map.id);
    setStudyMaps(remaining);
    setThemes((current) => current.map((theme) => ({ ...theme, mapIds: theme.mapIds.filter((id) => id !== map.id) })));
    setLearningPaths((current) => current.map((path) => path.mapId === map.id ? { ...path, mapId: undefined } : path));
    if (activeStudyMapId === map.id) {
      const next = remaining[0];
      setActiveStudyMapId(next?.id || "");
      setCourseName(next?.name || "");
      setStudyGoal(next?.objective || "");
      setMapping(next?.mapping || initialMapping);
    }
    setNotice(`Mapa “${map.name}” excluído. Temas e outros mapas foram preservados.`);
  }

  function duplicateStudyMap(map: StudyMapRecord) {
    const id = `map-${Date.now()}`;
    const now = new Date().toISOString();
    const copy: StudyMapRecord = {
      ...map, id, name: `${map.name} — cópia`, isPrimary: false, createdAt: now, updatedAt: now, lastActivityAt: now,
      mapping: { ...map.mapping, topics: map.mapping.topics.map((topic, index) => ({ ...topic, id: `topic-${Date.now()}-${index}` })) },
    };
    setStudyMaps((current) => [copy, ...current]);
    setThemes((current) => current.map((theme) => copy.themeIds.includes(theme.id) ? { ...theme, mapIds: [...new Set([...theme.mapIds, id])] } : theme));
    setNotice(`Mapa “${map.name}” duplicado com dados independentes.`);
  }

  function saveTheme(theme: ThemeRecord) {
    setThemes((current) => current.some((item) => item.id === theme.id) ? current.map((item) => item.id === theme.id ? theme : item) : [theme, ...current]);
    setNotice(`Tema “${theme.name}” salvo.`);
  }

  function deleteTheme(themeId: string, deleteLearningData: boolean) {
    setThemes((current) => current.filter((theme) => theme.id !== themeId));
    setStudyMaps((current) => current.map((map) => ({ ...map, themeIds: map.themeIds.filter((id) => id !== themeId) })));
    setLearningPaths((current) => deleteLearningData ? current.filter((path) => path.themeId !== themeId) : current.map((path) => path.themeId === themeId ? { ...path, themeId: undefined } : path));
    setNotice(deleteLearningData ? "Tema e trilhas vinculadas excluídos. Os mapas foram preservados." : "Tema excluído; mapas e trilhas foram preservados sem o vínculo.");
  }

  function duplicateTheme(themeId: string) {
    const source = themes.find((theme) => theme.id === themeId);
    if (!source) return;
    const now = new Date().toISOString();
    setThemes((current) => [{ ...source, id: `theme-${Date.now()}`, name: `${source.name} — cópia`, mapIds: [], archived: false, createdAt: now, updatedAt: now }, ...current]);
  }

  function moveMapTopic(index: number, direction: -1 | 1) {
    setMapping((current) => {
      const next = [...current.topics];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, topics: next };
    });
  }

  function toggleMapTheme(themeId: string) {
    const map = studyMaps.find((item) => item.id === activeStudyMapId);
    if (!map) return;
    const linked = map.themeIds.includes(themeId);
    const themeIds = linked ? map.themeIds.filter((id) => id !== themeId) : [...map.themeIds, themeId];
    updateStudyMap({ ...map, themeIds, updatedAt: new Date().toISOString() });
    setThemes((current) => current.map((theme) => theme.id === themeId ? { ...theme, mapIds: linked ? theme.mapIds.filter((id) => id !== map.id) : [...new Set([...theme.mapIds, map.id])] } : theme));
  }

  function addGoal(event: FormEvent) {
    event.preventDefault();
    const title = goalText.trim();
    if (!title) return;
    setGoals((current) => [...current, { id: Date.now(), title, done: false }]);
    setGoalText("");
  }

  function addMapTopic(event: FormEvent) {
    event.preventDefault();
    const title = topicTitle.trim();
    if (!title) {
      setNotice("Escreva o nome do tópico que você pretende estudar.");
      return;
    }
    if (mapping.topics.some((topic) => topic.title.toLowerCase() === title.toLowerCase())) {
      setNotice("Esse tópico já faz parte do seu mapa.");
      return;
    }

    const topic: Topic = {
      id: `topic-${Date.now()}`,
      parentId: topicParentId || undefined,
      title,
      module: topicModule.trim() || "Sem módulo",
      priority: topicPriority,
      status: "planned",
      confidence: 0,
      videoEvidence: "Aguardando uma aula para analisar.",
      syllabusReference: topicReference.trim() || "Referência ainda não definida",
      action: "Adicionar material e analisar",
    };
    setMapping((current) => ({
      ...current,
      summary: "Mapa personalizado criado por você. Envie uma aula e a apostila para medir a cobertura.",
      topics: [...current.topics, topic],
    }));
    setSelectedPlanTopics((current) => [...current, title]);
    setTopicTitle("");
    setTopicReference("");
    setTopicParentId("");
    setNotice(`Tópico “${title}” adicionado ao seu mapa.`);
  }

  function removeMapTopic(topicId: string | undefined, title: string) {
    setMapping((current) => {
      const topics = current.topics.filter((topic) => topicId ? topic.id !== topicId : topic.title !== title);
      return {
        ...current,
        coverage: calculateCoverage(topics),
        topics,
        summary: topics.length
          ? current.summary
          : "Seu mapa começa vazio. Cadastre abaixo os módulos e tópicos que fazem parte do seu objetivo.",
      };
    });
    setSelectedPlanTopics((current) => current.filter((topic) => topic !== title));
  }

  function editMapTopic(topic: Topic) {
    const title = window.prompt("Nome do tópico", topic.title)?.trim();
    if (!title) return;
    const moduleName = window.prompt("Módulo ou categoria", topic.module || "")?.trim() || "Sem módulo";
    const reference = window.prompt("Referência opcional", topic.syllabusReference)?.trim() || "Referência ainda não definida";
    setMapping((current) => ({ ...current, topics: current.topics.map((item) => item.id === topic.id ? { ...item, title, module: moduleName, syllabusReference: reference } : item) }));
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
          category: dayIndex % 3 === 1 ? "revision" as const : dayIndex % 3 === 2 ? "exercise" as const : "study" as const,
          difficulty: weekIndex < Math.ceil(planWeeks / 3) ? "easy" as const : weekIndex < Math.ceil(planWeeks * 2 / 3) ? "medium" as const : "hard" as const,
          xp: planMinutes * activityTypes.study.xpRate,
          recurrence: "weekly" as const,
          mapId: activeStudyMapId || undefined,
          themeId: activeStudyMap?.themeIds[0] || undefined,
        };
      });
      return {
        week: weekIndex + 1,
        theme: topics[(weekIndex * planDays) % topics.length],
        sessions: weeklySessions,
      };
    });

    const id = `plan-${Date.now()}`;
    setStudyPlans((current) => [{ id, name: planName.trim(), createdAt: new Date().toISOString(), weeks: plan }, ...current]);
    setActivePlanId(id);
    setPlanWeekView(0);
    setNotice(`Plano “${planName}” criado com ${planWeeks * planDays} sessões.`);
  }

  function togglePlanSession(sessionId: string) {
    const session = studyPlan.flatMap((week) => week.sessions).find((item) => item.id === sessionId);
    const shouldReward = session && !session.done && !evolutionLogs.some((log) => log.sourceId === sessionId);
    if (!activePlanRecord) return;
    setStudyPlans((current) => current.map((plan) => plan.id === activePlanRecord.id ? {
      ...plan,
      weeks: plan.weeks.map((week) => ({
          ...week,
          sessions: week.sessions.map((planSession) =>
            planSession.id === sessionId ? { ...planSession, done: !planSession.done } : planSession,
          ),
        })),
    } : plan));
    if (session && shouldReward) {
      const xp = session.xp ?? session.minutes * activityTypes.study.xpRate;
      setEvolutionLogs((current) => [{
        id: Date.now(),
        sourceId: session.id,
        type: "study",
        title: `Plano concluído: ${session.topic}`,
        minutes: session.minutes,
        xp,
        createdAt: new Date().toISOString(),
        description: session.activity,
        difficulty: session.difficulty,
        dueDate: session.dueDate,
        recurrence: session.recurrence,
        mapId: session.mapId,
        themeId: session.themeId,
        status: "completed",
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
    const planTopics = [...new Set(studyPlan.flatMap((week) => week.sessions.map((session) => session.topic)))];
    const newGoals = planTopics.slice(0, 4).map((topic, index) => ({
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
    const xp = activityXp > 0 ? activityXp : activityMinutes * activity.xpRate;
    const skillGain = Math.max(1, Math.min(3, Math.round(activityMinutes / 30)));
    const fields = {
      type: activityType,
      title,
      minutes: activityMinutes,
      xp,
      description: activityDescription.trim() || undefined,
      difficulty: activityDifficulty,
      dueDate: activityDueDate || undefined,
      recurrence: activityRecurrence,
      mapId: activityMapId || undefined,
      themeId: activityThemeId || undefined,
      status: activityStatus,
    } satisfies Partial<EvolutionLog>;
    if (editingActivityId !== null) {
      setEvolutionLogs((current) => current.map((log) => log.id === editingActivityId ? { ...log, ...fields } : log));
      resetEvolutionForm();
      setNotice("Atividade atualizada e salva.");
      return;
    }
    setEvolutionLogs((current) => [
      {
        id: Date.now(),
        ...fields,
        createdAt: new Date().toISOString(),
        order: 0,
      },
      ...current,
    ]);
    setSkillLevels((current) => ({
      ...current,
      [activity.skill]: Math.min(100, current[activity.skill] + skillGain),
      discipline: Math.min(100, current.discipline + 1),
    }));
    resetEvolutionForm();
    setNotice(`Atividade registrada: +${xp} XP, +${skillGain} em ${skillMeta[activity.skill].label}.`);
  }

  function resetEvolutionForm() {
    setEditingActivityId(null);
    setActivityTitle("");
    setActivityDescription("");
    setActivityMinutes(45);
    setActivityDifficulty("medium");
    setActivityXp(0);
    setActivityDueDate("");
    setActivityRecurrence("none");
    setActivityMapId("");
    setActivityThemeId("");
    setActivityStatus("completed");
  }

  function editEvolutionActivity(log: EvolutionLog) {
    setEditingActivityId(log.id);
    setActivityType(log.type);
    setActivityTitle(log.title);
    setActivityMinutes(log.minutes);
    setActivityDescription(log.description || "");
    setActivityDifficulty(log.difficulty || "medium");
    setActivityXp(log.xp);
    setActivityDueDate(log.dueDate || "");
    setActivityRecurrence(log.recurrence || "none");
    setActivityMapId(log.mapId || "");
    setActivityThemeId(log.themeId || "");
    setActivityStatus(log.status || "completed");
    setActivityMenuId(null);
    document.querySelector(".evolution-log")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function duplicateEvolutionActivity(log: EvolutionLog) {
    setEvolutionLogs((current) => [{ ...log, id: Date.now(), sourceId: undefined, title: `${log.title} — cópia`, createdAt: new Date().toISOString(), status: "pending" }, ...current]);
    setActivityMenuId(null);
    setNotice("Atividade duplicada como pendente.");
  }

  function toggleEvolutionActivity(log: EvolutionLog) {
    setEvolutionLogs((current) => current.map((item) => item.id === log.id ? { ...item, status: item.status === "pending" ? "completed" : "pending" } : item));
    setActivityMenuId(null);
  }

  function deleteEvolutionActivity(log: EvolutionLog) {
    if (!window.confirm(`Excluir “${log.title}”? O registro deixará de contar para XP, sequência e progresso.`)) return;
    setEvolutionLogs((current) => current.filter((item) => item.id !== log.id));
    setActivityMenuId(null);
    setNotice(`Atividade “${log.title}” excluída do histórico.`);
  }

  function moveEvolutionActivity(log: EvolutionLog, direction: -1 | 1) {
    setEvolutionLogs((current) => {
      const index = current.findIndex((item) => item.id === log.id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered.map((item, order) => ({ ...item, order }));
    });
    setActivityMenuId(null);
  }

  function duplicatePlanSession(session: PlanSession) {
    if (!activePlanRecord) return;
    setStudyPlans((current) => current.map((plan) => plan.id === activePlanRecord.id ? { ...plan, weeks: plan.weeks.map((week) => week.sessions.some((item) => item.id === session.id) ? { ...week, sessions: [...week.sessions, { ...session, id: `session-${Date.now()}`, topic: `${session.topic} — cópia`, done: false }] } : week) } : plan));
    setPlanSessionMenuId(null);
    setNotice("Atividade de estudo duplicada como pendente.");
  }

  function editPlanSession(session: PlanSession) {
    setEditingPlanSession({
      ...session,
      category: session.category || "study",
      difficulty: session.difficulty || "medium",
      xp: session.xp ?? session.minutes * activityTypes.study.xpRate,
      recurrence: session.recurrence || "none",
    });
    setPlanSessionMenuId(null);
  }

  function savePlanSession(event: FormEvent) {
    event.preventDefault();
    if (!activePlanRecord || !editingPlanSession?.topic.trim()) return;
    const normalized = {
      ...editingPlanSession,
      topic: editingPlanSession.topic.trim(),
      activity: editingPlanSession.activity.trim() || "Estudo dirigido",
      minutes: Math.max(5, Number(editingPlanSession.minutes) || 5),
      xp: Math.max(0, Number(editingPlanSession.xp) || 0),
    };
    setStudyPlans((current) => current.map((plan) => plan.id === activePlanRecord.id ? {
      ...plan,
      weeks: plan.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((item) => item.id === normalized.id ? normalized : item),
      })),
    } : plan));
    setEditingPlanSession(null);
    setNotice(`Atividade “${normalized.topic}” atualizada.`);
  }

  function deletePlanSession(session: PlanSession) {
    if (!activePlanRecord || !window.confirm(`Excluir “${session.topic}”? Essa atividade será retirada do plano e poderá alterar o progresso.`)) return;
    setStudyPlans((current) => current.map((plan) => plan.id === activePlanRecord.id ? { ...plan, weeks: plan.weeks.map((week) => ({ ...week, sessions: week.sessions.filter((item) => item.id !== session.id) })) } : plan));
    setEvolutionLogs((current) => current.filter((log) => log.sourceId !== session.id));
    setPlanSessionMenuId(null);
    setNotice(`Atividade “${session.topic}” excluída do plano.`);
  }

  function movePlanSession(session: PlanSession, direction: -1 | 1) {
    if (!activePlanRecord) return;
    setStudyPlans((current) => current.map((plan) => {
      if (plan.id !== activePlanRecord.id) return plan;
      const sizes = plan.weeks.map((week) => week.sessions.length);
      const sessions = plan.weeks.flatMap((week) => week.sessions);
      const index = sessions.findIndex((item) => item.id === session.id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sessions.length) return plan;
      [sessions[index], sessions[target]] = [sessions[target], sessions[index]];
      let cursor = 0;
      const weeks = plan.weeks.map((week, weekIndex) => {
        const nextSessions = sessions.slice(cursor, cursor + sizes[weekIndex]);
        cursor += sizes[weekIndex];
        return { ...week, sessions: nextSessions };
      });
      return { ...plan, weeks };
    }));
    setPlanSessionMenuId(null);
  }

  function completeAssessment(result: AssessmentResult) {
    setAssessmentResult(result);
    setSkillLevels(result.skills);
    setSelectedArchetype(result.recommendedArchetype);
    setSecondaryArchetype(result.recommendedArchetypes[1] || "leader");
    setArchetypeArea(result.professionalArea);
    setNotice(`Avaliação concluída: Rank ${result.rank}. Sua linha de base foi criada.`);
  }

  function resetAssessment() {
    setAssessmentResult(null);
    setSkillLevels(initialSkills);
    setEvolutionLogs([]);
    setDailyMissionChecks([]);
    setNotice("Ranking, XP e atributos zerados. Faça a avaliação para criar uma nova linha de base.");
  }

  function choosePrimaryArchetype(id: string) {
    if (id === selectedArchetype) return;
    if (id === secondaryArchetype) setSecondaryArchetype(selectedArchetype);
    setSelectedArchetype(id);
  }

  function chooseSecondaryArchetype(id: string) {
    if (id === secondaryArchetype) return;
    if (id === selectedArchetype) setSelectedArchetype(secondaryArchetype);
    setSecondaryArchetype(id);
  }

  function toggleDailyMission(archetypeId: string, missionIndex: number, missionTitle: string) {
    const date = new Date().toISOString().slice(0, 10);
    const missionId = `${date}-${archetypeId}-${missionIndex}`;
    const completed = dailyMissionChecks.includes(missionId);
    setDailyMissionChecks((current) => completed
      ? current.filter((item) => item !== missionId)
      : [...current, missionId]);
    if (!completed) {
      const xp = 25;
      setEvolutionLogs((current) => [{
        id: Date.now() + missionIndex,
        sourceId: missionId,
        type: archetypeId === "athlete" ? "strength" : archetypeId === "entrepreneur" ? "business" : archetypeId === "leader" ? "communication" : "reading",
        title: `Protocolo diário: ${missionTitle}`,
        minutes: 15,
        xp,
        createdAt: new Date().toISOString(),
      }, ...current]);
      setNotice(`Missão diária concluída: +${xp} XP.`);
    }
  }

  async function generateArchetypePaths() {
    const goal = archetypeContext.trim() || assessmentResult?.primaryGoal || studyGoal;
    if (!goal.trim()) {
      setNotice("Descreva o resultado que deseja construir antes de pedir os arquétipos à IA.");
      return;
    }
    setBusy("archetypes");
    setNotice("A IA está construindo 6 caminhos completos. Esta análise profunda pode levar até 3 minutos.");
    setArchetypeError(null);
    try {
      const areaLabel = professionalAreas.find((area) => area.value === archetypeArea)?.label || archetypeArea;
      const response = await fetch("/api/archetypes/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: areaLabel,
          role: assessmentResult?.role || courseName,
          goal,
          context: archetypeContext,
          assessment: assessmentResult ? {
            rank: assessmentResult.rank,
            dimensions: assessmentResult.dimensions,
            personality: assessmentResult.personality,
            skills: assessmentResult.skills,
          } : null,
        }),
      });
      const data = await readApiResponse<{ summary: string; archetypes: GeneratedArchetype[] }>(response);
      if (!Array.isArray(data.archetypes) || !data.archetypes.length) throw new Error("A IA não devolveu arquétipos válidos.");
      setGeneratedArchetypes(data.archetypes);
      setArchetypeSummary(data.summary || "Caminhos personalizados para sua área.");
      setSelectedArchetype(data.archetypes[0].id);
      setSecondaryArchetype(data.archetypes[1]?.id || "sage");
      setNotice(`${data.archetypes.length} arquétipos personalizados foram criados. Você pode trocar o principal e o secundário a qualquer momento.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível gerar os arquétipos agora.";
      setArchetypeError({ message, retryable: error instanceof ApiClientError ? error.retryable : true });
      setNotice(message);
    } finally {
      setBusy(null);
    }
  }

  async function generateMapTopics() {
    if (!topicAiPrompt.trim()) {
      setNotice("Explique para a IA o que você quer aprender.");
      return;
    }
    setBusy("topics");
    setNotice(null);
    try {
      const response = await fetch("/api/topics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: topicAiPrompt,
          courseName,
          studyGoal,
          existingTopics: mapping.topics.map((topic) => topic.title),
        }),
      });
      const payload = await readApiResponse<{ topics: { title: string; module: string; priority: TopicPriority }[] }>(response);
      const generated = payload.topics
        .filter((item) => !mapping.topics.some((topic) => topic.title.toLowerCase() === item.title.toLowerCase()))
        .map((item, index): Topic => ({
          id: `ai-topic-${Date.now()}-${index}`,
          title: item.title,
          module: item.module,
          priority: item.priority,
          status: "planned",
          confidence: 0,
          videoEvidence: "Aguardando uma aula para analisar.",
          syllabusReference: "Referência ainda não definida",
          action: "Adicionar material e analisar",
        }));
      setMapping((current) => ({ ...current, topics: [...current.topics, ...generated] }));
      setSelectedPlanTopics((current) => [...new Set([...current, ...generated.map((topic) => topic.title)])]);
      setTopicAiPrompt("");
      setNotice(`${generated.length} tópicos personalizados foram adicionados ao mapa.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível gerar os tópicos.");
    } finally {
      setBusy(null);
    }
  }

  async function transcribeVideo() {
    if (!videoFile && !driveUrl.trim()) {
      setNotice("Selecione um arquivo ou cole um link público de vídeo/áudio.");
      return;
    }
    if (videoFile && videoFile.size > 250 * 1024 * 1024) {
      setNotice("O vídeo pode ter no máximo 250 MB.");
      return;
    }
    setBusy("transcribe");
    setNotice(null);
    try {
      let response: Response;
      if (videoFile && videoFile.size > 4 * 1024 * 1024) {
        setNotice("Enviando o arquivo com segurança. Não feche esta página...");
        const { upload } = await import("@vercel/blob/client");
        const safeName = videoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const blob = await upload(`nexo-media/${Date.now()}-${safeName}`, videoFile, {
          access: "public",
          handleUploadUrl: "/api/media/upload",
          multipart: true,
          contentType: videoFile.type || undefined,
        });
        setNotice("Upload concluído. Normalizando e dividindo o áudio...");
        response = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaUrl: blob.url, fileName: videoFile.name, mimeType: videoFile.type }),
        });
      } else if (videoFile) {
        const form = new FormData();
        form.append("file", videoFile);
        response = await fetch("/api/transcribe", { method: "POST", body: form });
      } else {
        response = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: driveUrl.trim() }),
        });
      }
      const payload = await readApiResponse<{ transcript: string; parts: number; normalizedAudio: boolean }>(response);
      setTranscript(payload.transcript);
      setNotice(`Transcrição concluída em ${payload.parts || 1} parte(s). O áudio foi normalizado antes do reconhecimento.`);
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
    if (!mapping.topics.length) {
      setNotice("Primeiro defina no mapa os tópicos que você pretende estudar.");
      setTab("mapping");
      return;
    }
    if (!transcript.trim()) {
      setNotice("Adicione a transcrição da aula antes de analisar seu mapa.");
      return;
    }
    setBusy("analyze");
    setNotice(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          syllabus,
          studyPath: {
            courseName,
            studyGoal,
            topics: mapping.topics.map((topic) => ({
              title: topic.title,
              module: topic.module,
              priority: topic.priority,
              syllabusReference: topic.syllabusReference,
            })),
          },
        }),
      });
      const analyzed = await readApiResponse<Mapping>(response);
      const topics = mapping.topics.map((definedTopic, index) => {
        const result = analyzed.topics.find(
          (topic) => topic.title.toLowerCase() === definedTopic.title.toLowerCase(),
        ) || analyzed.topics[index];
        return result
          ? { ...definedTopic, ...result, title: definedTopic.title }
          : definedTopic;
      });
      setMapping({
        summary: analyzed.summary,
        coverage: calculateCoverage(topics),
        topics,
        nextSteps: analyzed.nextSteps,
      });
      setTab("mapping");
      setNotice("Seu mapa personalizado foi atualizado com base na aula.");
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
      const payload = await readApiResponse<{ quiz: Quiz[]; flashcards: Flashcard[] }>(response);
      setQuiz(payload.quiz);
      setFlashcards(payload.flashcards);
      const prefix = Date.now().toString(36);
      const path: LearningPath = {
        id: `path-review-${prefix}`,
        title: `Revisão — ${courseName || "material atual"}`,
        mapId: activeStudyMapId || undefined,
        themeId: activeStudyMap?.themeIds[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        units: [{
          id: `unit-review-${prefix}`,
          title: "Revisão do material",
          description: "Questões e cartões gerados exclusivamente a partir do conteúdo enviado.",
          lessons: [
            {
              id: `lesson-quiz-${prefix}`,
              title: "Quiz adaptativo",
              description: "Recupere os conceitos sem consultar o material.",
              difficulty: "intermediario",
              xp: 70,
              exercises: payload.quiz.map((item, index) => ({ id: `exercise-quiz-${prefix}-${index}`, type: "multiple_choice", prompt: item.question, options: item.options, answer: item.options[item.answer], explanation: item.explanation })),
            },
            {
              id: `lesson-cards-${prefix}`,
              title: "Flashcards essenciais",
              description: "Explique cada conceito antes de conferir a resposta.",
              difficulty: "intermediario",
              xp: 60,
              exercises: payload.flashcards.map((item, index) => ({ id: `exercise-card-${prefix}-${index}`, type: "flashcard", prompt: `${item.topic}: ${item.front}`, options: [], answer: item.back, explanation: item.back })),
            },
          ],
        }],
      };
      setLearningPaths((current) => [path, ...current]);
      setLearningProgress((current) => ({ ...current, [path.id]: { ...emptyPathProgress } }));
      setTab("review");
      setNotice("Nova trilha de revisão gerada a partir do seu material real.");
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
      const payload = await readApiResponse<{ answer: string }>(response);
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

  if (cloudEnabled && !cloudLoaded) {
    return (
      <main className="cloud-loading">
        <span className="brand"><span className="brand-mark"><Zap size={18} fill="currentColor" /></span><span>NEXO</span></span>
        <LoaderCircle className="spin" size={30} />
        <h1>Carregando seu painel individual</h1>
        <p>Sincronizando ranking, planos, materiais e arquétipos.</p>
      </main>
    );
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
          <strong>{courseName || "SUA TRILHA PERSONALIZADA"}</strong>
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
                {item.id === "mapping" && studyMaps.length > 0 && <em>{studyMaps.length}</em>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="streak"><Flame size={18} /><span><strong>{currentStreak} {currentStreak === 1 ? "dia" : "dias"}</strong><small>sequência atual</small></span></div>
          <AccountControl enabled={authEnabled} compact />
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu /></button>
          <div>
            <span className="eyebrow" suppressHydrationWarning>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).toUpperCase()}</span>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <div className="top-actions">
            <span className={`cloud-status ${cloudStatus}`}>{cloudStatus === "saved" ? "Salvo na nuvem" : cloudStatus === "saving" ? "Salvando…" : cloudStatus === "error" ? "Cópia local" : cloudStatus === "loading" ? "Sincronizando…" : "Modo local"}</span>
            <div className="search-box"><Search size={17} /><input aria-label="Pesquisar" placeholder="Buscar nas suas aulas" /></div>
            <button className="outline-button" onClick={() => setChatOpen(true)}><Sparkles size={17} /> Perguntar à IA</button>
          </div>
        </header>

        {notice && (
          <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Fechar aviso"><X size={16} /></button></div>
        )}

        {legacyImportAvailable && (
          <div className="legacy-import panel">
            <div><HardDrive size={20} /><span><strong>Encontramos um painel local anterior</strong><small>Importe seus planos, mapa e histórico para esta conta. Nada será apagado do navegador.</small></span></div>
            <div><button className="text-button" onClick={dismissLegacyImport}>Agora não</button><button className="primary-button" onClick={importLegacyDashboard}>Importar para minha conta</button></div>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="page-grid dashboard-page">
            <section className="welcome-row">
              <div>
                <span className="eyebrow lime">{mapping.topics.length ? "PRÓXIMO PASSO" : "CONSTRUA SUA TRILHA"}</span>
                <h2>{mapping.topics.length ? "Continue de onde você parou." : "Defina o que você quer dominar."}</h2>
                <p>{mapping.topics.length
                  ? `${focusTopic} é o próximo tópico sugerido pelo seu mapa pessoal.`
                  : "Crie seu curso, módulos e tópicos. O Nexo só analisará o conteúdo que você escolher."}</p>
              </div>
              <button className="primary-button" onClick={() => setTab(mapping.topics.length ? "sessions" : "mapping")}>{mapping.topics.length ? "Iniciar sessão" : "Criar meu mapa"} <ArrowRight size={18} /></button>
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
              <div className="timer-topic"><span />{focusTopic}</div>
              <div className="timer-controls">
                <button className="icon-button" onClick={() => resetTimer()} aria-label="Reiniciar"><RotateCcw size={19} /></button>
                <button className="timer-main" onClick={() => setTimerRunning((running) => !running)}>{timerRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {timerRunning ? "Pausar" : "Começar"}</button>
                <button className="icon-button" onClick={() => { setTimerRunning(false); setTimerSeconds(0); }} aria-label="Encerrar"><Square size={18} /></button>
              </div>
            </section>

            <section className="progress-panel panel">
              <div className="panel-heading"><div><span className="eyebrow">EVOLUÇÃO</span><h3>Progresso atual</h3></div><span className="trend">{evolutionLogs.length} registros</span></div>
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
              <div className="panel-heading"><div><span className="eyebrow">ATIVIDADE RECENTE</span><h3>Suas últimas evidências</h3></div><button className="text-button" onClick={() => setTab("evolution")}>Ver todas</button></div>
              {evolutionLogs.length ? <div className="session-list compact">{evolutionLogs.slice(0, 3).map((log) => <div key={log.id}><span className="session-icon purple"><Activity size={19} /></span><p><strong>{log.title}</strong><small>{activityTypes[log.type].label} · {log.minutes} min · {new Date(log.createdAt).toLocaleDateString("pt-BR")}</small></p><span className="score">+{log.xp} XP</span></div>)}</div> : <div className="history-empty dashboard-empty"><Shield size={24} /><p><strong>Nenhuma evidência registrada.</strong><small>Use Ascensão para registrar estudo, leitura, treino ou projetos.</small></p></div>}
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

            <RankAssessment result={assessmentResult} onComplete={completeAssessment} onReset={resetAssessment} />

            {assessmentResult && (
              <section className="rank-gates panel">
                <div className="rank-gates-head">
                  <div><span className="eyebrow">PROMOÇÃO POR EVIDÊNCIAS</span><h3>{nextRank ? `Rota do Rank ${evolutionRank} para o Rank ${nextRank}` : "Rank S: manutenção de excelência"}</h3><p>O diagnóstico define a base. Para subir, todos os limites abaixo precisam ser alcançados em dias diferentes e em múltiplos pilares.</p></div>
                  <div><span>ÍNDICE VIVO</span><strong>{liveRankScore}</strong><small>base + atributos atuais</small></div>
                </div>
                {nextRankRequirement ? (
                  <div className="rank-gate-grid">
                    {[
                      { label: "Índice composto", value: liveRankScore, target: nextRankRequirement.score, display: `${liveRankScore}/${nextRankRequirement.score}` },
                      { label: "Registros válidos", value: completedEvolutionLogs.length, target: nextRankRequirement.records, display: `${completedEvolutionLogs.length}/${nextRankRequirement.records}` },
                      { label: "Dias com evidência", value: evidenceDays, target: nextRankRequirement.days, display: `${evidenceDays}/${nextRankRequirement.days}` },
                      { label: "Horas acumuladas", value: Math.round(accumulatedMinutes / 60), target: nextRankRequirement.hours, display: `${Math.round(accumulatedMinutes / 60)}/${nextRankRequirement.hours}h` },
                      { label: "Pilares distintos", value: evidencePillars, target: nextRankRequirement.pillars, display: `${evidencePillars}/${nextRankRequirement.pillars}` },
                    ].map((gate) => {
                      const progress = Math.min(gate.value / Math.max(gate.target, 1) * 100, 100);
                      return <article key={gate.label} className={progress >= 100 ? "passed" : ""}><div><span>{gate.label}</span><strong>{gate.display}</strong></div><i><b style={{ width: `${progress}%` }} /></i></article>;
                    })}
                  </div>
                ) : <p className="rank-s-note"><Trophy size={18} /> O Rank S não encerra a jornada: mantenha consistência, qualidade, ética e resultados por ciclos longos.</p>}
              </section>
            )}

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
                  <span>Descrição</span>
                  <textarea value={activityDescription} onChange={(event) => setActivityDescription(event.target.value)} placeholder="Resultado, série, páginas, conteúdo ou evidência produzida" />
                </label>
                <label>
                  <span>Duração</span>
                  <div className="activity-duration">
                    {[30, 45, 60, 90].map((duration) => (
                      <button key={duration} type="button" className={activityMinutes === duration ? "active" : ""} onClick={() => setActivityMinutes(duration)}>{duration} min</button>
                    ))}
                  </div>
                </label>
                <div className="activity-fields-grid">
                  <label><span>Dificuldade</span><select value={activityDifficulty} onChange={(event) => setActivityDifficulty(event.target.value as NonNullable<EvolutionLog["difficulty"]>)}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select></label>
                  <label><span>XP personalizado (0 = automático)</span><input type="number" min="0" max="10000" value={activityXp} onChange={(event) => setActivityXp(Math.max(0, Number(event.target.value) || 0))} /></label>
                  <label><span>Prazo</span><input type="date" value={activityDueDate} onChange={(event) => setActivityDueDate(event.target.value)} /></label>
                  <label><span>Recorrência</span><select value={activityRecurrence} onChange={(event) => setActivityRecurrence(event.target.value as NonNullable<EvolutionLog["recurrence"]>)}><option value="none">Sem recorrência</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label>
                  <label><span>Mapa vinculado</span><select value={activityMapId} onChange={(event) => setActivityMapId(event.target.value)}><option value="">Nenhum mapa</option>{studyMaps.filter((map) => map.status !== "archived").map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label>
                  <label><span>Tema vinculado</span><select value={activityThemeId} onChange={(event) => setActivityThemeId(event.target.value)}><option value="">Nenhum tema</option>{themes.filter((theme) => !theme.archived).map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
                  <label><span>Status</span><select value={activityStatus} onChange={(event) => setActivityStatus(event.target.value as NonNullable<EvolutionLog["status"]>)}><option value="completed">Concluída</option><option value="pending">Pendente</option></select></label>
                </div>
                <button className="primary-button wide" type="submit"><Zap size={18} /> {editingActivityId !== null ? "Salvar atividade" : "Registrar e receber XP"}</button>
                {editingActivityId !== null && <button className="text-button wide" type="button" onClick={resetEvolutionForm}>Cancelar edição</button>}
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
                  <h2>Construa uma combinação que faça sentido para sua área.</h2>
                  <p>Escolha um arquétipo principal para direção e um secundário para ampliar sua forma de agir. Você pode mudar ambos sem perder XP, histórico ou atributos.</p>
                </div>
                <div className="years-warning"><Clock3 size={20} /><span><strong>Horizonte real</strong><small>3 a 10 anos de evidências</small></span></div>
              </div>

              <section className="archetype-ai panel">
                <div className="archetype-ai-copy">
                  <span className="ai-orb"><Sparkles size={21} /></span>
                  <div><span className="eyebrow">ARQUITETO DE ARQUÉTIPOS COM IA</span><h3>Gerar modelos específicos da sua área</h3><p>A IA combina seu diagnóstico com padrões recorrentes de casos públicos bem-sucedidos e transforma isso em marcos, competências e ações verificáveis.</p></div>
                </div>
                <div className="archetype-ai-form">
                  <label><span>Área</span><select value={archetypeArea} onChange={(event) => setArchetypeArea(event.target.value as ProfessionalArea)}>{professionalAreas.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}</select></label>
                  <label className="archetype-context"><span>Resultado desejado e contexto</span><textarea value={archetypeContext} onChange={(event) => setArchetypeContext(event.target.value)} placeholder={assessmentResult?.primaryGoal || "Ex.: quero liderar uma gestora de investimentos, mas hoje estou no início da carreira..."} /></label>
                  <button className="primary-button" onClick={generateArchetypePaths} disabled={busy === "archetypes"}>{busy === "archetypes" ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} {generatedArchetypes.length ? "Gerar novas opções" : "Analisar e gerar"}</button>
                </div>
                {archetypeError && (
                  <div className="inline-error" role="alert">
                    <span>{archetypeError.message}</span>
                    {archetypeError.retryable && <button type="button" onClick={generateArchetypePaths} disabled={busy === "archetypes"}><RotateCcw size={15} /> Tentar novamente</button>}
                  </div>
                )}
                {archetypeSummary && <p className="archetype-ai-summary"><Bot size={16} />{archetypeSummary}</p>}
                <small className="method-disclaimer">Síntese de IA, não pesquisa biográfica em tempo real. Os cases são referências de aprendizagem, não garantias; confirme informações importantes nas fontes originais.</small>
              </section>

              <div className="archetype-selection-summary panel">
                <div><span>PRINCIPAL</span><strong>{activeArchetype.name}</strong><small>Define direção, marcos e três ações diárias.</small></div>
                <i>+</i>
                <div><span>SECUNDÁRIO</span><strong>{activeSecondaryArchetype.name}</strong><small>Adiciona uma ação complementar ao sistema diário.</small></div>
              </div>

              <div className="archetype-cards">
                {availableArchetypes.map((archetype) => {
                  const requirements = Object.entries(archetype.requirements) as [SkillKey, number][];
                  const progress = Math.round(requirements.reduce((total, [skill, requirement]) => total + Math.min(skillLevels[skill] / requirement, 1), 0) / requirements.length * 100);
                  const Icon = archetype.icon;
                  return (
                    <article key={archetype.id} className={`${selectedArchetype === archetype.id ? "active" : ""} ${secondaryArchetype === archetype.id ? "secondary" : ""}`} style={{ "--archetype": archetype.color } as React.CSSProperties}>
                      <div className="archetype-card-head"><span className="archetype-icon"><Icon size={22} /></span><span className="archetype-name"><strong>{archetype.name}</strong><small>{archetype.area || "Caminho-base"} · {archetype.horizon}</small></span></div>
                      {typeof archetype.fitScore === "number" && <span className="fit-score">Compatibilidade IA {archetype.fitScore}%</span>}
                      <span className="archetype-card-progress"><i style={{ width: `${progress}%` }} /></span>
                      <span className="archetype-lock">{progress >= 100 ? <Trophy size={15} /> : <LockKeyhole size={15} />} {progress}%</span>
                      <div className="archetype-role-actions"><button className={selectedArchetype === archetype.id ? "chosen" : ""} onClick={() => choosePrimaryArchetype(archetype.id)}>Principal</button><button className={secondaryArchetype === archetype.id ? "chosen" : ""} onClick={() => chooseSecondaryArchetype(archetype.id)}>Secundário</button></div>
                    </article>
                  );
                })}
              </div>

              <div className="archetype-detail panel" style={{ "--archetype": activeArchetype.color } as React.CSSProperties}>
                <div className="archetype-detail-intro">
                  <div className="archetype-title-row">
                    <span><ActiveArchetypeIcon size={27} /></span>
                    <div><span className="eyebrow">ARQUÉTIPO PRINCIPAL</span><h3>{activeArchetype.name}</h3><small className="secondary-label">Secundário: {activeSecondaryArchetype.name}</small></div>
                  </div>
                  <p>{activeArchetype.subtitle}</p>
                  {activeArchetype.rationale && <div className="archetype-rationale"><strong>Por que combina com seu perfil</strong><p>{activeArchetype.rationale}</p></div>}
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
                  {activeArchetype.caseModels?.length ? <div className="case-models"><h4>Cases públicos para estudar</h4><p>{activeArchetype.successPattern}</p>{activeArchetype.caseModels.map((model) => <article key={model.name}><strong>{model.name}</strong><span>{model.lesson}</span></article>)}</div> : null}
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
                <section className="daily-archetype-path">
                  <div className="daily-path-heading"><div><span className="eyebrow">PROTOCOLO HÍBRIDO</span><h3>O que fazer hoje: {activeArchetype.name} + {activeSecondaryArchetype.name}</h3></div><span suppressHydrationWarning>{new Date().toLocaleDateString("pt-BR", { weekday: "long" })}</span></div>
                  <div className="daily-protocol-grid">
                    {[
                      ...activeArchetype.dailyProtocol.slice(0, 3).map((mission, index) => ({ mission, index, archetype: activeArchetype, role: "Principal" })),
                      ...activeSecondaryArchetype.dailyProtocol.slice(0, 1).map((mission, index) => ({ mission, index, archetype: activeSecondaryArchetype, role: "Secundário" })),
                    ].map(({ mission, index, archetype, role }) => {
                      const missionId = `${new Date().toISOString().slice(0, 10)}-${archetype.id}-${index}`;
                      const done = dailyMissionChecks.includes(missionId);
                      return <button key={`${archetype.id}-${index}`} className={done ? "done" : ""} onClick={() => toggleDailyMission(archetype.id, index, mission)}><span>{done ? <Check size={16} /> : index + 1}</span><p><strong>{mission}</strong><small>{done ? "Concluída hoje" : `${role} · +25 XP`}</small></p></button>;
                    })}
                  </div>
                  <div className="weekly-archetype-path">
                    {activeArchetype.weeklyPath.map((day, index) => {
                      const todayIndex = (new Date().getDay() + 6) % 7;
                      return <article key={day.day} className={todayIndex === index ? "today" : ""}><span>{day.day.slice(0, 3)}</span><strong>{day.focus}</strong><ul>{day.actions.map((action) => <li key={action}>{action}</li>)}</ul></article>;
                    })}
                  </div>
                  <small className="mission-note">A rota é deliberadamente longa: cumpra o mínimo diário, revise a semana e aumente a dificuldade somente quando a consistência estiver estável.</small>
                </section>
              </div>
            </section>

            <section className="evolution-history panel">
              <div className="panel-heading"><div><span className="eyebrow">HISTÓRICO DE ESFORÇO</span><h3>As evidências da sua construção</h3></div><span>{evolutionLogs.length} registros</span></div>
              {evolutionLogs.length ? (
                <div className="evolution-history-list">
                  {evolutionLogs.slice(0, 8).map((log, index) => (
                    <div key={log.id} className={log.status === "pending" ? "pending" : ""}>
                      <span className="history-icon"><Activity size={17} /></span>
                      <p><strong>{log.title}</strong><small>{activityTypes[log.type].label} · {log.minutes} min · {log.difficulty === "hard" ? "Difícil" : log.difficulty === "easy" ? "Fácil" : "Média"} · {new Date(log.createdAt).toLocaleDateString("pt-BR")} · {log.status === "pending" ? "Pendente" : "Concluída"}</small>{log.description && <small>{log.description}</small>}</p>
                      <strong>{log.status === "pending" ? "Pendente" : `+${log.xp} XP`}</strong>
                      <button className="activity-menu-button" aria-label={`Ações de ${log.title}`} onClick={() => setActivityMenuId(activityMenuId === log.id ? null : log.id)}><MoreVertical size={18} /></button>
                      {activityMenuId === log.id && <div className="card-menu activity-card-menu"><button onClick={() => editEvolutionActivity(log)}>Editar</button><button onClick={() => duplicateEvolutionActivity(log)}>Duplicar</button><button onClick={() => toggleEvolutionActivity(log)}>{log.status === "pending" ? "Marcar concluída" : "Marcar pendente"}</button><button disabled={index === 0} onClick={() => moveEvolutionActivity(log, -1)}>Mover para cima</button><button disabled={index === evolutionLogs.length - 1} onClick={() => moveEvolutionActivity(log, 1)}>Mover para baixo</button><button className="danger" onClick={() => deleteEvolutionActivity(log)}>Excluir</button></div>}
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
                <p>Envie qualquer vídeo ou áudio, ou cole um link público direto. O Nexo normaliza o áudio, divide aulas longas, transcreve e encontra lacunas.</p>
                <div className="flow-line"><span><Video size={17} /> Aula</span><i /><span><FileText size={17} /> Apostila</span><i /><span><Sparkles size={17} /> Mapa</span></div>
              </div>
              <div className="creator-form">
                <label>Link público do vídeo ou áudio</label>
                <div className="input-with-icon"><Link2 size={18} /><input value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} placeholder="Drive, Dropbox ou URL direta https://..." /></div>
                <small className="source-help">O link precisa permitir download público. YouTube, plataformas com login e conteúdo protegido não são baixados.</small>
                <div className="or-divider"><span>ou envie um arquivo</span></div>
                <label className="drop-zone">
                  <input type="file" accept="video/*,audio/*" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} />
                  <Upload size={22} />
                  <strong>{videoFile ? videoFile.name : "Selecionar vídeo ou áudio"}</strong>
                  <small>MP4, MOV, MKV, WEBM, MP3, M4A ou WAV · até 250 MB</small>
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
            <div className="action-dock"><div><Layers3 size={20} /><span><strong>Pronto para comparar?</strong><small>A aula será analisada somente contra os {mapping.topics.length} tópicos que você definiu.</small></span></div><button className="primary-button" onClick={analyzeContent} disabled={busy === "analyze"}>{busy === "analyze" ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />} Analisar meu mapa</button></div>
            <section className="study-activities panel">
              <div className="panel-heading"><div><span className="eyebrow">ATIVIDADES DE ESTUDOS</span><h3>Editar, concluir e reorganizar</h3></div><button className="outline-button compact" onClick={() => setTab("plans")}><Plus size={15} /> Adicionar pelo plano</button></div>
              {studyPlan.length ? (
                <div className="study-activity-list">
                  {studyPlan.flatMap((week) => week.sessions.map((session) => ({ ...session, week: week.week }))).map((session, index, list) => (
                    <article key={session.id} className={session.done ? "done" : ""}>
                      <button className="session-check" onClick={() => togglePlanSession(session.id)} aria-label={session.done ? "Marcar pendente" : "Marcar concluída"}>{session.done ? <Check size={16} /> : <Circle size={16} />}</button>
                      <div><strong>{session.topic}</strong><small>Semana {session.week} · {session.activity} · {session.minutes} min · {session.difficulty === "hard" ? "Difícil" : session.difficulty === "easy" ? "Fácil" : "Média"}</small></div>
                      <strong className="session-xp">{session.xp ?? session.minutes * activityTypes.study.xpRate} XP</strong>
                      <button className="activity-menu-button" aria-label={`Ações de ${session.topic}`} onClick={() => setPlanSessionMenuId(planSessionMenuId === session.id ? null : session.id)}><MoreVertical size={18} /></button>
                      {planSessionMenuId === session.id && <div className="card-menu activity-card-menu"><button onClick={() => editPlanSession(session)}>Editar</button><button onClick={() => duplicatePlanSession(session)}>Duplicar</button><button onClick={() => togglePlanSession(session.id)}>{session.done ? "Marcar pendente" : "Marcar concluída"}</button><button disabled={index === 0} onClick={() => movePlanSession(session, -1)}>Mover para cima</button><button disabled={index === list.length - 1} onClick={() => movePlanSession(session, 1)}>Mover para baixo</button><button className="danger" onClick={() => deletePlanSession(session)}>Excluir</button></div>}
                    </article>
                  ))}
                </div>
              ) : <div className="entity-empty"><ListChecks size={25} /><strong>Nenhuma atividade planejada</strong><p>Crie um plano para organizar suas atividades de estudo.</p></div>}
            </section>
          </div>
        )}

        {tab === "themes" && (
          <ThemesWorkspace
            themes={themes}
            maps={studyMaps}
            onSave={saveTheme}
            onDelete={deleteTheme}
            onDuplicate={duplicateTheme}
            onArchive={(themeId) => setThemes((current) => current.map((theme) => theme.id === themeId ? { ...theme, archived: !theme.archived, updatedAt: new Date().toISOString() } : theme))}
            onCreateMap={createStudyMap}
          />
        )}

        {tab === "mapping" && (
          <div className="mapping-page">
            <StudyMapsLibrary
              maps={studyMaps}
              themes={themes}
              activeMapId={activeStudyMapId}
              onCreate={() => createStudyMap()}
              onOpen={openStudyMap}
              onUpdate={updateStudyMap}
              onDelete={deleteStudyMap}
              onDuplicate={duplicateStudyMap}
            />
            <section className="mapping-header">
              <div><span className="eyebrow lime">MAPA DEFINIDO POR VOCÊ</span><h2>Seu conteúdo, suas regras.</h2><p>{mapping.summary}</p></div>
              <div className="coverage-box"><span>Cobertura do seu mapa</span><strong>{mapping.coverage}%</strong><div className="goal-bar"><i style={{ width: `${mapping.coverage}%` }} /></div><small>{mapping.topics.length} tópicos definidos</small></div>
            </section>

            <section className="map-builder panel">
              <div className="panel-heading">
                <div><span className="eyebrow">ESTRUTURA DA SUA TRILHA</span><h3>Escolha exatamente o que será acompanhado</h3></div>
                <span className="builder-icon"><Layers3 size={18} /></span>
              </div>

              <div className="map-identity-grid">
                <label><span>Curso, prova ou projeto</span><input value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Ex.: C-PRO I, Inglês ou Gestão de fundos" /></label>
                <label><span>Objetivo principal</span><input value={studyGoal} onChange={(event) => setStudyGoal(event.target.value)} placeholder="Ex.: ser aprovado, dominar o tema ou aplicar no trabalho" /></label>
                {activeStudyMap && <label><span>Descrição do mapa</span><input value={activeStudyMap.description} onChange={(event) => updateStudyMap({ ...activeStudyMap, description: event.target.value, updatedAt: new Date().toISOString() })} placeholder="Contexto e escopo" /></label>}
                {activeStudyMap && <label><span>Prazo</span><input type="date" value={activeStudyMap.deadline || ""} onChange={(event) => updateStudyMap({ ...activeStudyMap, deadline: event.target.value, updatedAt: new Date().toISOString() })} /></label>}
              </div>

              {activeStudyMap && themes.length > 0 && <fieldset className="theme-link-selector"><legend>Temas vinculados</legend>{themes.filter((theme) => !theme.archived).map((theme) => <button type="button" key={theme.id} className={activeStudyMap.themeIds.includes(theme.id) ? "selected" : ""} onClick={() => toggleMapTheme(theme.id)}><span style={{ background: theme.color }}>{theme.icon}</span>{theme.name}{activeStudyMap.themeIds.includes(theme.id) && <Check size={14} />}</button>)}</fieldset>}

              <div className="ai-topic-builder">
                <span className="ai-topic-icon"><Sparkles size={19} /></span>
                <div><span className="eyebrow">ARQUITETO DE CONTEÚDO IA</span><strong>Peça uma trilha com suas próprias palavras</strong><textarea value={topicAiPrompt} onChange={(event) => setTopicAiPrompt(event.target.value)} placeholder="Ex.: Quero aprender valuation do zero para analisar pequenas empresas; organize do básico ao avançado com prática." /></div>
                <button className="primary-button" type="button" onClick={generateMapTopics} disabled={busy === "topics"}>{busy === "topics" ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Gerar tópicos</button>
              </div>

              <form className="topic-create-form" onSubmit={addMapTopic}>
                <label><span>Módulo ou categoria</span><input value={topicModule} onChange={(event) => setTopicModule(event.target.value)} placeholder="Ex.: Módulo 1" /></label>
                <label className="topic-name-field"><span>Tópico que você vai estudar</span><input value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} placeholder="Ex.: Política de investimento" required /></label>
                <label><span>Tópico principal (opcional)</span><select value={topicParentId} onChange={(event) => setTopicParentId(event.target.value)}><option value="">É um tópico principal</option>{mapping.topics.filter((topic) => !topic.parentId).map((topic) => <option key={topic.id || topic.title} value={topic.id}>{topic.title}</option>)}</select></label>
                <label><span>Referência opcional</span><input value={topicReference} onChange={(event) => setTopicReference(event.target.value)} placeholder="Ex.: páginas 10–18" /></label>
                <label><span>Prioridade</span><select value={topicPriority} onChange={(event) => setTopicPriority(event.target.value as TopicPriority)}><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label>
                <button className="primary-button" type="submit"><Plus size={17} /> Adicionar tópico</button>
              </form>

              <div className="defined-topics-heading"><span>CONTEÚDO DO SEU MAPA</span><strong>{mapping.topics.length} tópicos</strong></div>
              {mapping.topics.length ? (
                <div className="defined-topics-list">
                  {mapping.topics.map((topic, index) => (
                    <article key={topic.id || topic.title}>
                      <span className={`priority-mark ${topic.priority || "medium"}`} />
                      <div><span>{topic.parentId ? "Subtópico" : topic.module || "Sem módulo"} · prioridade {priorityLabels[topic.priority || "medium"]}</span><strong>{topic.parentId ? "↳ " : ""}{topic.title}</strong><small>{topic.syllabusReference}</small></div>
                      <StatusPill status={topic.status} />
                      <button onClick={() => editMapTopic(topic)} aria-label={`Editar ${topic.title}`}>Editar</button>
                      <div className="topic-order"><button disabled={index === 0} onClick={() => moveMapTopic(index, -1)} aria-label={`Mover ${topic.title} para cima`}>↑</button><button disabled={index === mapping.topics.length - 1} onClick={() => moveMapTopic(index, 1)} aria-label={`Mover ${topic.title} para baixo`}>↓</button></div>
                      <button onClick={() => removeMapTopic(topic.id, topic.title)} aria-label={`Remover ${topic.title}`}><X size={16} /></button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="map-empty-state"><span><Layers3 size={29} /></span><div><strong>Nenhum conteúdo predefinido</strong><p>Adicione os tópicos que realmente fazem parte do que você pretende estudar.</p></div></div>
              )}
            </section>

            {mapping.topics.length > 0 && (
              <>
                <div className="map-legend"><span><i className="planned" />Planejado</span><span><i className="green" />Coberto</span><span><i className="amber" />Parcial</span><span><i className="coral" />Lacuna</span></div>
                <section className="topic-table panel">
                  <div className="topic-table-head"><span>Conteúdo escolhido</span><span>Evidência encontrada na aula</span><span>Próxima ação</span></div>
                  {mapping.topics.map((topic, index) => (
                    <article className="topic-row" key={`${topic.title}-${index}`}>
                      <div className="topic-title"><StatusPill status={topic.status} /><strong>{topic.title}</strong><small>{topic.module} · {topic.syllabusReference}{topic.confidence ? ` · confiança ${topic.confidence}%` : ""}</small></div>
                      <p>{topic.videoEvidence}</p>
                      <button onClick={() => setTab(topic.status === "planned" ? "sessions" : "review")}>{topic.action}<ArrowRight size={15} /></button>
                    </article>
                  ))}
                </section>
                {mapping.nextSteps.length ? (
                  <section className="next-steps panel"><div><span className="next-icon"><Target /></span><div><span className="eyebrow">RECOMENDAÇÃO DO NEXO</span><h3>Plano para a próxima sessão</h3></div></div><ol>{mapping.nextSteps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol><button className="primary-button" onClick={generateRevision} disabled={busy === "generate"}>{busy === "generate" ? <LoaderCircle className="spin" size={18} /> : <BrainCircuit size={18} />} Gerar revisão das lacunas</button></section>
                ) : (
                  <section className="map-ready panel"><span className="next-icon"><Video /></span><div><span className="eyebrow">PRÓXIMO PASSO</span><h3>Seu mapa está pronto para receber uma aula</h3><p>Adicione o vídeo ou a transcrição. A apostila é opcional quando você já informou as referências.</p></div><button className="primary-button" onClick={() => setTab("sessions")}>Adicionar aula <ArrowRight size={16} /></button></section>
                )}
              </>
            )}
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

            {studyPlans.length > 0 && (
              <section className="plan-library panel">
                <div><span className="eyebrow">MEUS PLANOS</span><strong>{studyPlans.length} plano(s) salvo(s)</strong></div>
                <div>{studyPlans.map((plan) => {
                  const sessions = plan.weeks.flatMap((week) => week.sessions);
                  const progress = sessions.length ? Math.round(sessions.filter((session) => session.done).length / sessions.length * 100) : 0;
                  return <button key={plan.id} className={activePlanRecord?.id === plan.id ? "active" : ""} onClick={() => { setActivePlanId(plan.id); setPlanWeekView(0); }}><span><CalendarDays size={16} /></span><p><strong>{plan.name}</strong><small>{plan.weeks.length} semanas · {progress}% concluído</small></p><i style={{ width: `${progress}%` }} /></button>;
                })}</div>
              </section>
            )}

            <div className="plans-layout">
              <form className="plan-builder panel" onSubmit={createStudyPlan}>
                <div className="panel-heading">
                  <div><span className="eyebrow">CONFIGURAÇÃO</span><h3>Monte seu cronograma</h3></div>
                  <span className="builder-icon"><SlidersHorizontal size={18} /></span>
                </div>

                <label className="plan-field">
                  <span>Nome do plano</span>
                  <input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Ex.: Minha preparação personalizada" required />
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
                      <div><span className="eyebrow">{(activePlanRecord?.name || planName).toUpperCase()}</span><h3>Semana {activePlanWeek.week} de {studyPlan.length}</h3></div>
                      <button className="outline-button compact" onClick={addPlanToGoals}><Target size={16} /> Levar para metas</button>
                    </div>
                    <div className="week-focus"><span>TEMA DA SEMANA</span><strong>{activePlanWeek.theme}</strong></div>
                    <div className="plan-session-list">
                      {activePlanWeek.sessions.map((session) => (
                        <article key={session.id} className={session.done ? "done" : ""}>
                          <button className="session-check" onClick={() => togglePlanSession(session.id)} aria-label={session.done ? `Marcar ${session.topic} como pendente` : `Concluir ${session.topic}`}>{session.done ? <Check size={16} /> : session.day.slice(0, 3)}</button>
                          <div><strong>{session.topic}</strong><small>{session.activity}</small></div>
                          <span className="session-time"><Clock3 size={14} /> {session.minutes} min</span>
                          <button className="activity-menu-button" aria-label={`Ações de ${session.topic}`} onClick={() => setPlanSessionMenuId(planSessionMenuId === session.id ? null : session.id)}><MoreVertical size={18} /></button>
                          {planSessionMenuId === session.id && <div className="card-menu activity-card-menu"><button onClick={() => editPlanSession(session)}>Editar</button><button onClick={() => duplicatePlanSession(session)}>Duplicar</button><button onClick={() => togglePlanSession(session.id)}>{session.done ? "Marcar pendente" : "Marcar concluída"}</button><button disabled={allPlanSessions.findIndex((item) => item.id === session.id) === 0} onClick={() => movePlanSession(session, -1)}>Mover para cima</button><button disabled={allPlanSessions.findIndex((item) => item.id === session.id) === allPlanSessions.length - 1} onClick={() => movePlanSession(session, 1)}>Mover para baixo</button><button className="danger" onClick={() => deletePlanSession(session)}>Excluir</button></div>}
                        </article>
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
          <ActiveReview
            paths={learningPaths}
            setPaths={setLearningPaths}
            progressByPath={learningProgress}
            setProgressByPath={setLearningProgress}
            themes={themes}
            maps={studyMaps}
            materialContext={[transcript, syllabus].filter(Boolean).join("\n\n")}
            notify={setNotice}
          />
        )}
      </main>

      {editingPlanSession && (
        <div className="modal-backdrop" role="presentation">
          <form className="edit-session-modal panel" role="dialog" aria-modal="true" aria-labelledby="edit-session-title" onSubmit={savePlanSession}>
            <div className="panel-heading"><div><span className="eyebrow">EDITAR ATIVIDADE</span><h3 id="edit-session-title">Configuração completa</h3></div><button type="button" className="modal-close" onClick={() => setEditingPlanSession(null)} aria-label="Fechar"><X size={18} /></button></div>
            <div className="edit-session-grid">
              <label className="wide-field"><span>Nome</span><input value={editingPlanSession.topic} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, topic: event.target.value })} required /></label>
              <label className="wide-field"><span>Descrição</span><textarea value={editingPlanSession.activity} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, activity: event.target.value })} /></label>
              <label><span>Dia</span><input value={editingPlanSession.day} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, day: event.target.value })} /></label>
              <label><span>Duração</span><input type="number" min="5" max="1440" value={editingPlanSession.minutes} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, minutes: Number(event.target.value) })} /></label>
              <label><span>Categoria</span><select value={editingPlanSession.category || "study"} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, category: event.target.value as NonNullable<PlanSession["category"]> })}><option value="study">Estudo</option><option value="revision">Revisão</option><option value="exercise">Exercícios</option><option value="reading">Leitura</option><option value="project">Projeto</option></select></label>
              <label><span>Dificuldade</span><select value={editingPlanSession.difficulty || "medium"} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, difficulty: event.target.value as NonNullable<PlanSession["difficulty"]> })}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select></label>
              <label><span>XP</span><input type="number" min="0" max="10000" value={editingPlanSession.xp || 0} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, xp: Number(event.target.value) })} /></label>
              <label><span>Prazo</span><input type="date" value={editingPlanSession.dueDate || ""} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, dueDate: event.target.value })} /></label>
              <label><span>Recorrência</span><select value={editingPlanSession.recurrence || "none"} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, recurrence: event.target.value as NonNullable<PlanSession["recurrence"]> })}><option value="none">Sem recorrência</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label>
              <label><span>Mapa</span><select value={editingPlanSession.mapId || ""} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, mapId: event.target.value || undefined })}><option value="">Nenhum</option>{studyMaps.filter((map) => map.status !== "archived").map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label>
              <label><span>Tema</span><select value={editingPlanSession.themeId || ""} onChange={(event) => setEditingPlanSession({ ...editingPlanSession, themeId: event.target.value || undefined })}><option value="">Nenhum</option>{themes.filter((theme) => !theme.archived).map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
            </div>
            <div className="confirm-actions"><button type="button" onClick={() => setEditingPlanSession(null)}>Cancelar</button><button className="primary-button" type="submit">Salvar alterações</button></div>
          </form>
        </div>
      )}

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
