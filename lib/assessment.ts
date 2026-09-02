export type SkillKey = "body" | "knowledge" | "discipline" | "communication" | "capital" | "leadership";
export type SkillLevels = Record<SkillKey, number>;
export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export type AssessmentAnswers = {
  profile: {
    age: number;
    country: string;
    education: string;
    monthlyHouseholdIncomeUsd: number;
    householdSize: number;
    weeklyStudyHours: number;
  };
  physical: {
    moderateMinutes: number;
    vigorousMinutes: number;
    strengthDays: number;
    sleepHours: number;
    pushups: number;
  };
  personality: Record<string, number>;
  knowledge: Record<string, number>;
};

export type AssessmentResult = {
  completedAt: string;
  rank: Rank;
  overall: number;
  comparisonBand: string;
  dimensions: {
    physical: number;
    cognitive: number;
    consistency: number;
    resources: number;
  };
  personality: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    stability: number;
  };
  skills: SkillLevels;
  recommendedArchetype: string;
  insights: string[];
};

export const personalityQuestions = [
  { id: "o1", trait: "openness", text: "Gosto de explorar ideias complexas e assuntos novos." },
  { id: "o2", trait: "openness", text: "Prefiro quase sempre repetir métodos conhecidos.", reverse: true },
  { id: "c1", trait: "conscientiousness", text: "Concluo o que começo mesmo quando a motivação cai." },
  { id: "c2", trait: "conscientiousness", text: "Costumo deixar tarefas importantes para a última hora.", reverse: true },
  { id: "e1", trait: "extraversion", text: "Sinto energia ao conversar e agir com outras pessoas." },
  { id: "e2", trait: "extraversion", text: "Evito assumir a palavra mesmo quando conheço o assunto.", reverse: true },
  { id: "a1", trait: "agreeableness", text: "Procuro entender o ponto de vista dos outros antes de reagir." },
  { id: "a2", trait: "agreeableness", text: "Tenho pouca paciência com os erros de outras pessoas.", reverse: true },
  { id: "s1", trait: "stability", text: "Consigo recuperar a calma depois de situações difíceis." },
  { id: "s2", trait: "stability", text: "Preocupações pequenas tiram meu foco por muito tempo.", reverse: true },
] as const;

export const knowledgeQuestions = [
  { id: "k1", area: "Numeracia", question: "Um curso de R$ 240 recebe desconto de 15%. Qual é o novo preço?", options: ["R$ 196", "R$ 204", "R$ 210", "R$ 216"], answer: 1 },
  { id: "k2", area: "Lógica", question: "Todos os analistas estudam dados. Ana é analista. O que necessariamente é verdadeiro?", options: ["Ana lidera uma equipe", "Ana estuda dados", "Ana é estatística", "Ana trabalha em banco"], answer: 1 },
  { id: "k3", area: "Finanças", question: "Se a inflação é 6% e um investimento rende 8%, o ganho real aproximado é:", options: ["2%", "6%", "8%", "14%"], answer: 0 },
  { id: "k4", area: "Ciência", question: "Qual prática torna uma conclusão experimental mais confiável?", options: ["Ignorar resultados contrários", "Repetir e controlar variáveis", "Escolher a menor amostra", "Mudar a hipótese depois"], answer: 1 },
  { id: "k5", area: "Leitura", question: "Um texto apresenta evidências e depois uma conclusão. Para avaliar o argumento, o principal é verificar:", options: ["O tamanho do texto", "A fama do autor", "Se as evidências sustentam a conclusão", "Se há palavras difíceis"], answer: 2 },
  { id: "k6", area: "Digital", question: "Qual atitude reduz mais o risco de invasão de uma conta?", options: ["Repetir a mesma senha", "Usar 2FA e senha única", "Salvar senha em mensagem", "Clicar em links urgentes"], answer: 1 },
  { id: "k7", area: "Probabilidade", question: "Uma moeda justa é lançada duas vezes. A chance de sair duas caras é:", options: ["25%", "33%", "50%", "75%"], answer: 0 },
  { id: "k8", area: "Decisão", question: "Antes de tomar uma decisão de alto impacto, qual processo é mais robusto?", options: ["Seguir a primeira intuição", "Buscar apenas confirmação", "Definir critérios e testar premissas", "Copiar a maioria"], answer: 2 },
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function personalityScore(answers: Record<string, number>, trait: string) {
  const questions = personalityQuestions.filter((question) => question.trait === trait);
  const score = questions.reduce((total, question) => {
    const raw = answers[question.id] || 3;
    return total + ("reverse" in question && question.reverse ? 6 - raw : raw);
  }, 0);
  return clamp(((score - questions.length) / (questions.length * 4)) * 100);
}

function resourceScore(monthlyIncome: number, householdSize: number) {
  const perPerson = monthlyIncome / Math.max(householdSize, 1);
  if (perPerson < 100) return 10;
  if (perPerson < 250) return 25;
  if (perPerson < 500) return 40;
  if (perPerson < 1000) return 55;
  if (perPerson < 2000) return 70;
  if (perPerson < 4000) return 85;
  return 100;
}

function rankFromScore(score: number): Rank {
  if (score < 30) return "E";
  if (score < 45) return "D";
  if (score < 60) return "C";
  if (score < 75) return "B";
  if (score < 90) return "A";
  return "S";
}

function comparisonBand(score: number) {
  if (score < 30) return "base inicial — abaixo das referências em várias dimensões";
  if (score < 45) return "faixa de desenvolvimento — fundamentos parcialmente construídos";
  if (score < 60) return "faixa intermediária — próximo do centro da escala comparativa";
  if (score < 75) return "faixa avançada — desempenho consistente em várias dimensões";
  if (score < 90) return "faixa de alta performance — poucos pontos fracos relevantes";
  return "faixa excepcional na avaliação — exige validação por evidências ao longo do tempo";
}

export function scoreAssessment(answers: AssessmentAnswers): AssessmentResult {
  const weightedActivity = answers.physical.moderateMinutes + answers.physical.vigorousMinutes * 2;
  const cardio = Math.min(weightedActivity / 150, 1) * 55;
  const strength = Math.min(answers.physical.strengthDays / 2, 1) * 25;
  const sleepDistance = Math.abs(7.5 - answers.physical.sleepHours);
  const sleep = Math.max(0, 20 - sleepDistance * 6);
  const physical = clamp(cardio + strength + sleep);

  const correct = knowledgeQuestions.filter((question) => answers.knowledge[question.id] === question.answer).length;
  const cognitive = clamp(correct / knowledgeQuestions.length * 100);
  const personality = {
    openness: personalityScore(answers.personality, "openness"),
    conscientiousness: personalityScore(answers.personality, "conscientiousness"),
    extraversion: personalityScore(answers.personality, "extraversion"),
    agreeableness: personalityScore(answers.personality, "agreeableness"),
    stability: personalityScore(answers.personality, "stability"),
  };
  const studyScore = Math.min(answers.profile.weeklyStudyHours / 10, 1) * 55;
  const consistency = clamp(studyScore + personality.conscientiousness * 0.45);
  const resources = resourceScore(
    answers.profile.monthlyHouseholdIncomeUsd,
    answers.profile.householdSize,
  );

  const overall = clamp(physical * 0.30 + cognitive * 0.35 + consistency * 0.25 + resources * 0.10);
  const educationBoost: Record<string, number> = { fundamental: 25, medio: 45, superior: 65, pos: 80 };
  const education = educationBoost[answers.profile.education] || 40;
  const skills: SkillLevels = {
    body: physical,
    knowledge: cognitive,
    discipline: consistency,
    communication: clamp(personality.extraversion * 0.45 + cognitive * 0.25 + education * 0.30),
    capital: clamp(resources * 0.45 + cognitive * 0.35 + consistency * 0.20),
    leadership: clamp(consistency * 0.35 + personality.extraversion * 0.20 + personality.agreeableness * 0.20 + cognitive * 0.25),
  };

  const archetypeScores = {
    sage: skills.knowledge * 0.5 + skills.discipline * 0.3 + personality.openness * 0.2,
    entrepreneur: skills.capital * 0.4 + skills.communication * 0.3 + skills.discipline * 0.3,
    athlete: skills.body * 0.6 + skills.discipline * 0.4,
    leader: skills.leadership * 0.45 + skills.communication * 0.3 + skills.knowledge * 0.25,
  };
  const recommendedArchetype = Object.entries(archetypeScores).sort((a, b) => b[1] - a[1])[0][0];
  const insights = [
    weightedActivity >= 150
      ? "Você atinge a referência semanal mínima de atividade física da OMS."
      : `Faltam cerca de ${Math.max(0, 150 - weightedActivity)} minutos moderados equivalentes para a referência semanal da OMS.`,
    `Você acertou ${correct} de ${knowledgeQuestions.length} questões de literacia, numeracia e resolução de problemas.`,
    consistency >= 60
      ? "Sua combinação de horas de estudo e conscienciosidade sustenta uma rotina consistente."
      : "A maior alavanca imediata é transformar intenção em horas semanais protegidas e registradas.",
    "A renda foi usada somente como contexto de acesso a recursos, com peso de 10% no resultado.",
  ];

  return {
    completedAt: new Date().toISOString(),
    rank: rankFromScore(overall),
    overall,
    comparisonBand: comparisonBand(overall),
    dimensions: { physical, cognitive, consistency, resources },
    personality,
    skills,
    recommendedArchetype,
    insights,
  };
}
