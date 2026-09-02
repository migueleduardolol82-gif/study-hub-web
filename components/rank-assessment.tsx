"use client";

import { ArrowRight, BarChart3, BrainCircuit, Check, Dumbbell, RotateCcw, Shield, UserRound } from "lucide-react";
import { useState } from "react";
import {
  knowledgeQuestions,
  personalityQuestions,
  scoreAssessment,
  type AssessmentAnswers,
  type AssessmentResult,
} from "@/lib/assessment";

const initialAnswers: AssessmentAnswers = {
  profile: {
    age: 25,
    country: "Brasil",
    education: "medio",
    monthlyHouseholdIncomeUsd: 0,
    householdSize: 1,
    weeklyStudyHours: 0,
  },
  physical: {
    moderateMinutes: 0,
    vigorousMinutes: 0,
    strengthDays: 0,
    sleepHours: 7,
    pushups: 0,
  },
  personality: {},
  knowledge: {},
};

const archetypeNames: Record<string, string> = {
  sage: "Sábio Estrategista",
  entrepreneur: "Empresário Construtor",
  athlete: "Atleta Resiliente",
  leader: "Líder de Capital",
};

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
  const stepLabels = ["Contexto", "Físico", "Personalidade", "Conhecimento"];

  function updateProfile(field: keyof AssessmentAnswers["profile"], value: string | number) {
    setAnswers((current) => ({ ...current, profile: { ...current.profile, [field]: value } }));
  }

  function updatePhysical(field: keyof AssessmentAnswers["physical"], value: number) {
    setAnswers((current) => ({ ...current, physical: { ...current.physical, [field]: value } }));
  }

  function next() {
    if (step === 2 && personalityQuestions.some((question) => !answers.personality[question.id])) return;
    if (step === 3) {
      if (knowledgeQuestions.some((question) => answers.knowledge[question.id] === undefined)) return;
      onComplete(scoreAssessment(answers));
      return;
    }
    setStep((current) => current + 1);
  }

  if (result) {
    return (
      <section className="assessment-result panel">
        <div className="assessment-result-head">
          <div><span className="eyebrow">DIAGNÓSTICO INICIAL CONCLUÍDO</span><h3>Seu ponto de partida é Rank {result.rank}</h3><p>{result.comparisonBand}.</p></div>
          <div className="assessment-score"><span>ÍNDICE</span><strong>{result.overall}</strong><small>/ 100</small></div>
        </div>
        <div className="assessment-dimensions">
          {Object.entries(result.dimensions).map(([key, value]) => (
            <div key={key}><span>{({ physical: "Físico", cognitive: "Conhecimento", consistency: "Consistência", resources: "Recursos" } as Record<string, string>)[key]}</span><strong>{value}</strong><i><b style={{ width: `${value}%` }} /></i></div>
          ))}
        </div>
        <div className="assessment-insights">
          <div><span className="eyebrow">LEITURA DO RESULTADO</span>{result.insights.map((insight) => <p key={insight}><Check size={15} />{insight}</p>)}</div>
          <div className="recommended-path"><Shield size={22} /><span><small>Maior compatibilidade atual</small><strong>{archetypeNames[result.recommendedArchetype]}</strong></span></div>
        </div>
        <div className="method-note">
          <p><strong>Comparação responsável:</strong> é uma estimativa orientativa, não um diagnóstico clínico nem um percentil mundial oficial. Personalidade descreve perfil; não aumenta ou diminui o valor da pessoa.</p>
          <div><a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" target="_blank" rel="noreferrer">OMS</a><a href="https://pip.worldbank.org/" target="_blank" rel="noreferrer">Banco Mundial PIP</a><a href="https://www.oecd.org/en/about/programmes/piaac.html" target="_blank" rel="noreferrer">OECD PIAAC</a><a href="https://ipip.ori.org/" target="_blank" rel="noreferrer">IPIP</a></div>
        </div>
        <button className="outline-button" onClick={() => { onReset(); setAnswers(initialAnswers); setStep(0); }}><RotateCcw size={16} /> Refazer avaliação e zerar rank</button>
      </section>
    );
  }

  return (
    <section className="rank-assessment panel">
      <div className="assessment-intro">
        <span className="assessment-icon"><BarChart3 size={24} /></span>
        <div><span className="eyebrow">AVALIAÇÃO DE ENTRADA</span><h3>Seu ranking está zerado</h3><p>Responda às quatro áreas para criar uma linha de base. Depois, o rank só evolui com evidências registradas.</p></div>
      </div>
      <div className="assessment-steps">
        {stepLabels.map((label, index) => <span key={label} className={index <= step ? "active" : ""}><i>{index + 1}</i>{label}</span>)}
      </div>

      {step === 0 && (
        <div className="assessment-form-grid">
          <label><span>Idade</span><input type="number" min="14" max="100" value={answers.profile.age} onChange={(event) => updateProfile("age", Number(event.target.value))} /></label>
          <label><span>País</span><input value={answers.profile.country} onChange={(event) => updateProfile("country", event.target.value)} /></label>
          <label><span>Escolaridade</span><select value={answers.profile.education} onChange={(event) => updateProfile("education", event.target.value)}><option value="fundamental">Ensino fundamental</option><option value="medio">Ensino médio</option><option value="superior">Ensino superior</option><option value="pos">Pós-graduação</option></select></label>
          <label><span>Pessoas na residência</span><input type="number" min="1" max="20" value={answers.profile.householdSize} onChange={(event) => updateProfile("householdSize", Number(event.target.value))} /></label>
          <label><span>Renda familiar mensal em US$ equivalente</span><input type="number" min="0" value={answers.profile.monthlyHouseholdIncomeUsd} onChange={(event) => updateProfile("monthlyHouseholdIncomeUsd", Number(event.target.value))} /><small>Use uma conversão aproximada. Esse dado fica salvo somente neste navegador.</small></label>
          <label><span>Horas de estudo por semana</span><input type="number" min="0" max="100" value={answers.profile.weeklyStudyHours} onChange={(event) => updateProfile("weeklyStudyHours", Number(event.target.value))} /></label>
        </div>
      )}

      {step === 1 && (
        <div className="assessment-form-grid physical-grid">
          <label><Dumbbell size={17} /><span>Minutos de atividade moderada/semana</span><input type="number" min="0" value={answers.physical.moderateMinutes} onChange={(event) => updatePhysical("moderateMinutes", Number(event.target.value))} /></label>
          <label><Dumbbell size={17} /><span>Minutos de atividade vigorosa/semana</span><input type="number" min="0" value={answers.physical.vigorousMinutes} onChange={(event) => updatePhysical("vigorousMinutes", Number(event.target.value))} /></label>
          <label><span>Treinos de força por semana</span><input type="number" min="0" max="14" value={answers.physical.strengthDays} onChange={(event) => updatePhysical("strengthDays", Number(event.target.value))} /></label>
          <label><span>Média de sono por noite</span><input type="number" min="0" max="16" step="0.5" value={answers.physical.sleepHours} onChange={(event) => updatePhysical("sleepHours", Number(event.target.value))} /></label>
          <label><span>Flexões contínuas (informativo)</span><input type="number" min="0" value={answers.physical.pushups} onChange={(event) => updatePhysical("pushups", Number(event.target.value))} /></label>
          <div className="benchmark-card"><strong>Referência usada</strong><p>OMS: 150 min moderados ou 75 vigorosos por semana, mais força em 2 dias.</p></div>
        </div>
      )}

      {step === 2 && (
        <div className="personality-list">
          <div className="scale-caption"><span>Discordo</span><span>Concordo</span></div>
          {personalityQuestions.map((question) => (
            <div key={question.id}><p><UserRound size={16} />{question.text}</p><span>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={answers.personality[question.id] === value ? "active" : ""} onClick={() => setAnswers((current) => ({ ...current, personality: { ...current.personality, [question.id]: value } }))}>{value}</button>)}</span></div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="knowledge-list">
          {knowledgeQuestions.map((question, index) => (
            <fieldset key={question.id}><legend><span>{index + 1}</span><small>{question.area}</small>{question.question}</legend><div>{question.options.map((option, optionIndex) => <button key={option} type="button" className={answers.knowledge[question.id] === optionIndex ? "active" : ""} onClick={() => setAnswers((current) => ({ ...current, knowledge: { ...current.knowledge, [question.id]: optionIndex } }))}>{String.fromCharCode(65 + optionIndex)}. {option}</button>)}</div></fieldset>
          ))}
        </div>
      )}

      <div className="assessment-actions">
        <button className="text-button" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Voltar</button>
        <span>{step + 1} de 4</span>
        <button className="primary-button" onClick={next}>{step === 3 ? <BrainCircuit size={17} /> : null}{step === 3 ? "Calcular meu rank" : "Continuar"}<ArrowRight size={17} /></button>
      </div>
    </section>
  );
}
