"use client";

import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  Dumbbell,
  RotateCcw,
  Shield,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import {
  executionQuestions,
  judgmentQuestions,
  knowledgeQuestions,
  personalityQuestions,
  professionalAreas,
  scoreAssessment,
  type AssessmentAnswers,
  type AssessmentResult,
} from "@/lib/assessment";

const initialAnswers: AssessmentAnswers = {
  profile: {
    age: 25,
    country: "Brasil",
    education: "medio",
    professionalArea: "technology",
    role: "",
    careerStage: "exploring",
    employment: "studying",
    monthlyHouseholdIncomeUsd: 0,
    householdSize: 1,
    dependents: 0,
    weeklyWorkHours: 0,
    weeklyStudyHours: 0,
  },
  physical: {
    moderateMinutes: 0,
    vigorousMinutes: 0,
    strengthDays: 0,
    sleepHours: 7,
    sleepQuality: 3,
    energy: 3,
    activeDays: 0,
    consistencyMonths: 0,
    pushups: 0,
    restingHeartRate: 0,
  },
  execution: {},
  personality: {},
  knowledge: {},
  judgment: {},
  trajectory: {
    projectsCompleted: 0,
    peopleLed: 0,
    presentationsLastYear: 0,
    booksLastYear: 0,
    savingsMonths: 0,
    incomeGrowth: 0,
    feedbackFrequency: 3,
    goalClarity: 3,
    riskTolerance: 3,
    primaryGoal: "",
    horizon: "3-years",
    biggestConstraint: "",
  },
};

const archetypeNames: Record<string, string> = {
  sage: "Sábio Estrategista",
  entrepreneur: "Empresário Construtor",
  athlete: "Atleta Resiliente",
  leader: "Líder de Capital",
};

const dimensionNames: Record<string, string> = {
  physical: "Corpo & energia",
  cognitive: "Conhecimento",
  execution: "Execução",
  judgment: "Julgamento",
  impact: "Impacto real",
  resources: "Recursos",
};

const personalityNames: Record<string, string> = {
  openness: "Abertura",
  conscientiousness: "Conscienciosidade",
  extraversion: "Extroversão",
  agreeableness: "Cooperação",
  stability: "Estabilidade",
};

function LikertList({
  questions,
  values,
  onChange,
}: {
  questions: readonly { id: string; text: string }[];
  values: Record<string, number>;
  onChange: (id: string, value: number) => void;
}) {
  return (
    <div className="personality-list">
      <div className="scale-caption"><span>Discordo</span><span>Concordo</span></div>
      {questions.map((question) => (
        <div key={question.id}>
          <p><UserRound size={16} />{question.text}</p>
          <span>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${question.text}: ${value} de 5`}
                className={values[question.id] === value ? "active" : ""}
                onClick={() => onChange(question.id, value)}
              >
                {value}
              </button>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function ObjectiveQuestions({
  questions,
  values,
  onChange,
}: {
  questions: readonly { id: string; area: string; question: string; options: readonly string[] }[];
  values: Record<string, number>;
  onChange: (id: string, value: number) => void;
}) {
  return (
    <div className="knowledge-list">
      {questions.map((question, index) => (
        <fieldset key={question.id}>
          <legend><span>{index + 1}</span><small>{question.area}</small>{question.question}</legend>
          <div>
            {question.options.map((option, optionIndex) => (
              <button
                key={option}
                type="button"
                className={values[question.id] === optionIndex ? "active" : ""}
                onClick={() => onChange(question.id, optionIndex)}
              >
                {String.fromCharCode(65 + optionIndex)}. {option}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function RankAssessment({
  result,
  onComplete,
  onReset,
}: {
  result: AssessmentResult | null;
  onComplete: (result: AssessmentResult) => void;
  onReset: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>(initialAnswers);
  const [validation, setValidation] = useState("");
  const stepLabels = ["Contexto", "Corpo", "Execução", "Perfil", "Conhecimento", "Decisões", "Trajetória"];

  function updateProfile(field: keyof AssessmentAnswers["profile"], value: string | number) {
    setAnswers((current) => ({ ...current, profile: { ...current.profile, [field]: value } }));
  }

  function updatePhysical(field: keyof AssessmentAnswers["physical"], value: number) {
    setAnswers((current) => ({ ...current, physical: { ...current.physical, [field]: value } }));
  }

  function updateTrajectory(field: keyof AssessmentAnswers["trajectory"], value: string | number) {
    setAnswers((current) => ({ ...current, trajectory: { ...current.trajectory, [field]: value } }));
  }

  function requireAll(values: Record<string, number>, ids: readonly string[]) {
    return ids.every((id) => values[id] !== undefined);
  }

  function next() {
    setValidation("");
    if (step === 0 && (!answers.profile.role.trim() || !answers.profile.country.trim())) {
      setValidation("Preencha país e função/ocupação para personalizar a análise.");
      return;
    }
    if (step === 2 && !requireAll(answers.execution, executionQuestions.map((question) => question.id))) {
      setValidation("Responda todas as afirmações de execução antes de continuar.");
      return;
    }
    if (step === 3 && !requireAll(answers.personality, personalityQuestions.map((question) => question.id))) {
      setValidation("Responda todas as afirmações de personalidade. Não existem respostas certas aqui.");
      return;
    }
    if (step === 4 && !requireAll(answers.knowledge, knowledgeQuestions.map((question) => question.id))) {
      setValidation("Responda todas as questões de conhecimento antes de continuar.");
      return;
    }
    if (step === 5 && !requireAll(answers.judgment, judgmentQuestions.map((question) => question.id))) {
      setValidation("Responda todos os cenários de decisão antes de continuar.");
      return;
    }
    if (step === 6) {
      if (!answers.trajectory.primaryGoal.trim() || !answers.trajectory.biggestConstraint.trim()) {
        setValidation("Descreva seu objetivo principal e o maior obstáculo atual.");
        return;
      }
      onComplete(scoreAssessment(answers));
      return;
    }
    setStep((current) => current + 1);
  }

  if (result) {
    const recommended = result.recommendedArchetypes?.slice(0, 2) || [result.recommendedArchetype];
    return (
      <section className="assessment-result panel">
        <div className="assessment-result-head">
          <div>
            <span className="eyebrow">DIAGNÓSTICO PROFUNDO CONCLUÍDO</span>
            <h3>Seu ponto de partida é Rank {result.rank}</h3>
            <p>{result.comparisonBand}. Confiança de preenchimento: {result.confidence}%.</p>
          </div>
          <div className="assessment-score"><span>ÍNDICE</span><strong>{result.overall}</strong><small>/ 100</small></div>
        </div>

        <div className="assessment-dimensions">
          {Object.entries(result.dimensions).map(([key, value]) => (
            <div key={key}>
              <span>{dimensionNames[key]}</span><strong>{value}</strong>
              <i><b style={{ width: `${value}%` }} /></i>
            </div>
          ))}
        </div>

        <div className="personality-summary">
          <span className="eyebrow">ASSINATURA DE PERSONALIDADE · NÃO ALTERA O RANK</span>
          <div>
            {Object.entries(result.personality).map(([key, value]) => (
              <span key={key}><small>{personalityNames[key]}</small><strong>{value}</strong></span>
            ))}
          </div>
        </div>

        <div className="assessment-method-grid">
          <div><span className="eyebrow">PESOS DO ÍNDICE</span><p>{Object.entries(result.methodology.weights).map(([key, weight]) => `${dimensionNames[key]} ${weight}%`).join(" · ")}</p></div>
          <div><span className="eyebrow">BASE PROFISSIONAL</span><p>{professionalAreas.find((area) => area.value === result.professionalArea)?.label} · {result.role || "função não informada"}</p></div>
        </div>

        <div className="benchmark-grid">
          {result.benchmarks?.map((benchmark) => (
            <article key={benchmark.source}>
              <span>{benchmark.source}</span><strong>{benchmark.dimension}</strong>
              <p>{benchmark.reading}</p><small>{benchmark.limitation}</small>
            </article>
          ))}
        </div>

        <div className="assessment-insights">
          <div>
            <span className="eyebrow">LEITURA DO RESULTADO</span>
            {result.insights.map((insight) => <p key={insight}><Check size={15} />{insight}</p>)}
          </div>
          <div className="recommended-path">
            <Shield size={22} />
            <span>
              <small>Compatibilidades iniciais</small>
              <strong>{recommended.map((id) => archetypeNames[id] || id).join(" + ")}</strong>
              <em>A IA poderá criar opções específicas para sua área.</em>
            </span>
          </div>
        </div>

        <div className="method-note">
          <p><strong>Comparação responsável:</strong> este é um índice interno orientativo, não diagnóstico clínico, promessa de sucesso ou percentil mundial oficial. As referências públicas ajudam a calibrar dimensões, mas populações, idades e países não são diretamente comparáveis.</p>
          <div>
            <a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" target="_blank" rel="noreferrer">OMS</a>
            <a href="https://pip.worldbank.org/" target="_blank" rel="noreferrer">Banco Mundial PIP</a>
            <a href="https://www.oecd.org/en/about/programmes/piaac.html" target="_blank" rel="noreferrer">OECD PIAAC</a>
            <a href="https://ipip.ori.org/" target="_blank" rel="noreferrer">IPIP</a>
          </div>
        </div>
        <button className="outline-button" onClick={() => { onReset(); setAnswers(initialAnswers); setStep(0); }}>
          <RotateCcw size={16} /> Refazer avaliação e zerar rank
        </button>
      </section>
    );
  }

  return (
    <section className="rank-assessment panel">
      <div className="assessment-intro">
        <span className="assessment-icon"><BarChart3 size={24} /></span>
        <div>
          <span className="eyebrow">AVALIAÇÃO MULTIDIMENSIONAL · 7 BLOCOS</span>
          <h3>Seu ranking começa sem nota</h3>
          <p>São 86 indicadores sobre contexto, saúde funcional, execução, personalidade, conhecimento, julgamento e trajetória. Reserve de 12 a 18 minutos e responda com honestidade.</p>
        </div>
      </div>

      <div className="assessment-steps">
        {stepLabels.map((label, index) => (
          <button key={label} type="button" className={index === step ? "current" : index < step ? "active" : ""} onClick={() => index < step && setStep(index)}>
            <i>{index + 1}</i>{label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="assessment-form-grid">
          <label><span>Idade</span><input type="number" min="14" max="100" value={answers.profile.age} onChange={(event) => updateProfile("age", Number(event.target.value))} /></label>
          <label><span>País</span><input value={answers.profile.country} onChange={(event) => updateProfile("country", event.target.value)} /></label>
          <label><span>Área profissional desejada ou atual</span><select value={answers.profile.professionalArea} onChange={(event) => updateProfile("professionalArea", event.target.value)}>{professionalAreas.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}</select></label>
          <label><span>Função, curso ou ocupação</span><input value={answers.profile.role} onChange={(event) => updateProfile("role", event.target.value)} placeholder="Ex.: analista financeiro, estudante..." /></label>
          <label><span>Estágio de carreira</span><select value={answers.profile.careerStage} onChange={(event) => updateProfile("careerStage", event.target.value)}><option value="exploring">Explorando uma direção</option><option value="entry">Início de carreira</option><option value="specialist">Especialista</option><option value="manager">Gestor</option><option value="executive">Executivo</option><option value="owner">Empreendedor / proprietário</option></select></label>
          <label><span>Situação atual</span><select value={answers.profile.employment} onChange={(event) => updateProfile("employment", event.target.value)}><option value="studying">Estudando</option><option value="employed">Empregado</option><option value="self-employed">Autônomo</option><option value="owner">Empreendendo</option><option value="transition">Em transição</option></select></label>
          <label><span>Escolaridade</span><select value={answers.profile.education} onChange={(event) => updateProfile("education", event.target.value)}><option value="fundamental">Ensino fundamental</option><option value="medio">Ensino médio</option><option value="technical">Técnico</option><option value="superior">Ensino superior</option><option value="pos">Pós-graduação</option></select></label>
          <label><span>Pessoas na residência</span><input type="number" min="1" max="20" value={answers.profile.householdSize} onChange={(event) => updateProfile("householdSize", Number(event.target.value))} /></label>
          <label><span>Dependentes financeiros</span><input type="number" min="0" max="20" value={answers.profile.dependents} onChange={(event) => updateProfile("dependents", Number(event.target.value))} /></label>
          <label><span>Renda familiar mensal em US$ equivalente</span><input type="number" min="0" value={answers.profile.monthlyHouseholdIncomeUsd} onChange={(event) => updateProfile("monthlyHouseholdIncomeUsd", Number(event.target.value))} /><small>Contexto de acesso a recursos: somente 5% do índice.</small></label>
          <label><span>Horas de trabalho por semana</span><input type="number" min="0" max="120" value={answers.profile.weeklyWorkHours} onChange={(event) => updateProfile("weeklyWorkHours", Number(event.target.value))} /></label>
          <label><span>Horas de estudo por semana</span><input type="number" min="0" max="100" value={answers.profile.weeklyStudyHours} onChange={(event) => updateProfile("weeklyStudyHours", Number(event.target.value))} /></label>
        </div>
      )}

      {step === 1 && (
        <div className="assessment-form-grid physical-grid">
          <label><Dumbbell size={17} /><span>Atividade moderada por semana (min)</span><input type="number" min="0" value={answers.physical.moderateMinutes} onChange={(event) => updatePhysical("moderateMinutes", Number(event.target.value))} /></label>
          <label><Dumbbell size={17} /><span>Atividade vigorosa por semana (min)</span><input type="number" min="0" value={answers.physical.vigorousMinutes} onChange={(event) => updatePhysical("vigorousMinutes", Number(event.target.value))} /></label>
          <label><span>Treinos de força por semana</span><input type="number" min="0" max="14" value={answers.physical.strengthDays} onChange={(event) => updatePhysical("strengthDays", Number(event.target.value))} /></label>
          <label><span>Dias fisicamente ativos por semana</span><input type="number" min="0" max="7" value={answers.physical.activeDays} onChange={(event) => updatePhysical("activeDays", Number(event.target.value))} /></label>
          <label><span>Média de sono por noite</span><input type="number" min="0" max="16" step="0.5" value={answers.physical.sleepHours} onChange={(event) => updatePhysical("sleepHours", Number(event.target.value))} /></label>
          <label><span>Qualidade do sono (1–5)</span><input type="range" min="1" max="5" value={answers.physical.sleepQuality} onChange={(event) => updatePhysical("sleepQuality", Number(event.target.value))} /><small>Atual: {answers.physical.sleepQuality}/5</small></label>
          <label><span>Energia diária percebida (1–5)</span><input type="range" min="1" max="5" value={answers.physical.energy} onChange={(event) => updatePhysical("energy", Number(event.target.value))} /><small>Atual: {answers.physical.energy}/5</small></label>
          <label><span>Meses mantendo rotina de exercícios</span><input type="number" min="0" max="600" value={answers.physical.consistencyMonths} onChange={(event) => updatePhysical("consistencyMonths", Number(event.target.value))} /></label>
          <label><span>Flexões contínuas (informativo)</span><input type="number" min="0" value={answers.physical.pushups} onChange={(event) => updatePhysical("pushups", Number(event.target.value))} /></label>
          <label><span>Frequência cardíaca em repouso (opcional)</span><input type="number" min="0" max="220" value={answers.physical.restingHeartRate} onChange={(event) => updatePhysical("restingHeartRate", Number(event.target.value))} /><small>Não é diagnóstico médico e não altera diretamente o índice.</small></label>
          <div className="benchmark-card"><strong>Referência funcional</strong><p>Usamos como referência de atividade as recomendações gerais da OMS. Condições individuais devem ser discutidas com profissional de saúde.</p></div>
        </div>
      )}

      {step === 2 && <LikertList questions={executionQuestions} values={answers.execution} onChange={(id, value) => setAnswers((current) => ({ ...current, execution: { ...current.execution, [id]: value } }))} />}
      {step === 3 && (
        <>
          <p className="assessment-section-note">Perfil inspirado no modelo Big Five/IPIP. Não existem traços “bons” ou “ruins”; eles ajudam a personalizar estratégia, ambiente e arquétipos.</p>
          <LikertList questions={personalityQuestions} values={answers.personality} onChange={(id, value) => setAnswers((current) => ({ ...current, personality: { ...current.personality, [id]: value } }))} />
        </>
      )}
      {step === 4 && <ObjectiveQuestions questions={knowledgeQuestions} values={answers.knowledge} onChange={(id, value) => setAnswers((current) => ({ ...current, knowledge: { ...current.knowledge, [id]: value } }))} />}
      {step === 5 && <ObjectiveQuestions questions={judgmentQuestions} values={answers.judgment} onChange={(id, value) => setAnswers((current) => ({ ...current, judgment: { ...current.judgment, [id]: value } }))} />}

      {step === 6 && (
        <div className="assessment-form-grid">
          <label><span>Projetos relevantes concluídos nos últimos 12 meses</span><input type="number" min="0" value={answers.trajectory.projectsCompleted} onChange={(event) => updateTrajectory("projectsCompleted", Number(event.target.value))} /></label>
          <label><span>Maior número de pessoas lideradas diretamente</span><input type="number" min="0" value={answers.trajectory.peopleLed} onChange={(event) => updateTrajectory("peopleLed", Number(event.target.value))} /></label>
          <label><span>Apresentações, aulas ou negociações no último ano</span><input type="number" min="0" value={answers.trajectory.presentationsLastYear} onChange={(event) => updateTrajectory("presentationsLastYear", Number(event.target.value))} /></label>
          <label><span>Livros concluídos nos últimos 12 meses</span><input type="number" min="0" value={answers.trajectory.booksLastYear} onChange={(event) => updateTrajectory("booksLastYear", Number(event.target.value))} /></label>
          <label><span>Reserva financeira em meses de despesas</span><input type="number" min="0" max="120" value={answers.trajectory.savingsMonths} onChange={(event) => updateTrajectory("savingsMonths", Number(event.target.value))} /></label>
          <label><span>Variação aproximada de renda nos últimos 24 meses (%)</span><input type="number" min="-100" max="1000" value={answers.trajectory.incomeGrowth} onChange={(event) => updateTrajectory("incomeGrowth", Number(event.target.value))} /></label>
          <label><span>Frequência com que busca feedback (1–5)</span><input type="range" min="1" max="5" value={answers.trajectory.feedbackFrequency} onChange={(event) => updateTrajectory("feedbackFrequency", Number(event.target.value))} /><small>Atual: {answers.trajectory.feedbackFrequency}/5</small></label>
          <label><span>Clareza do objetivo e próximos passos (1–5)</span><input type="range" min="1" max="5" value={answers.trajectory.goalClarity} onChange={(event) => updateTrajectory("goalClarity", Number(event.target.value))} /><small>Atual: {answers.trajectory.goalClarity}/5</small></label>
          <label><span>Tolerância a risco (1–5)</span><input type="range" min="1" max="5" value={answers.trajectory.riskTolerance} onChange={(event) => updateTrajectory("riskTolerance", Number(event.target.value))} /><small>Atual: {answers.trajectory.riskTolerance}/5</small></label>
          <label><span>Horizonte da sua transformação</span><select value={answers.trajectory.horizon} onChange={(event) => updateTrajectory("horizon", event.target.value)}><option value="1-year">1 ano</option><option value="3-years">3 anos</option><option value="5-years">5 anos</option><option value="10-years">10 anos</option></select></label>
          <label className="assessment-wide"><span>Qual resultado concreto mais importa para você?</span><textarea value={answers.trajectory.primaryGoal} onChange={(event) => updateTrajectory("primaryGoal", event.target.value)} placeholder="Ex.: tornar-me referência em análise de investimentos e liderar uma equipe..." /></label>
          <label className="assessment-wide"><span>Qual é hoje seu maior obstáculo interno ou externo?</span><textarea value={answers.trajectory.biggestConstraint} onChange={(event) => updateTrajectory("biggestConstraint", event.target.value)} placeholder="Ex.: falta de constância, tempo, direção, recursos..." /></label>
        </div>
      )}

      {validation && <p className="assessment-validation">{validation}</p>}
      <div className="assessment-actions">
        <button className="text-button" disabled={step === 0} onClick={() => { setValidation(""); setStep((current) => current - 1); }}>Voltar</button>
        <span>{step + 1} de {stepLabels.length}</span>
        <button className="primary-button" onClick={next}>
          {step === 6 ? <BrainCircuit size={17} /> : null}
          {step === 6 ? "Calcular diagnóstico" : "Continuar"}<ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}
