export type SkillKey = "body" | "knowledge" | "discipline" | "communication" | "capital" | "leadership";
export type SkillLevels = Record<SkillKey, number>;
export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export type ProfessionalArea =
  | "technology"
  | "entrepreneurship"
  | "finance"
  | "sales"
  | "leadership"
  | "health"
  | "education"
  | "creative"
  | "public_service"
  | "other";

export const professionalAreas: { value: ProfessionalArea; label: string }[] = [
  { value: "technology", label: "Tecnologia, dados ou IA" },
  { value: "entrepreneurship", label: "Empreendedorismo e negócios" },
  { value: "finance", label: "Finanças e investimentos" },
  { value: "sales", label: "Vendas e desenvolvimento comercial" },
  { value: "leadership", label: "Gestão e liderança" },
  { value: "health", label: "Saúde, esporte e performance" },
  { value: "education", label: "Educação, ciência e pesquisa" },
  { value: "creative", label: "Criação, comunicação e marketing" },
  { value: "public_service", label: "Serviço público e impacto social" },
  { value: "other", label: "Outra área" },
];

export type AssessmentAnswers = {
  profile: {
    age: number;
    country: string;
    education: string;
    professionalArea: ProfessionalArea;
    role: string;
    careerStage: string;
    employment: string;
    monthlyHouseholdIncomeUsd: number;
    householdSize: number;
    dependents: number;
    weeklyWorkHours: number;
    weeklyStudyHours: number;
  };
  physical: {
    moderateMinutes: number;
    vigorousMinutes: number;
    strengthDays: number;
    sleepHours: number;
    sleepQuality: number;
    energy: number;
    activeDays: number;
    consistencyMonths: number;
    pushups: number;
    restingHeartRate: number;
  };
  execution: Record<string, number>;
  personality: Record<string, number>;
  knowledge: Record<string, number>;
  judgment: Record<string, number>;
  trajectory: {
    projectsCompleted: number;
    peopleLed: number;
    presentationsLastYear: number;
    booksLastYear: number;
    savingsMonths: number;
    incomeGrowth: number;
    feedbackFrequency: number;
    goalClarity: number;
    riskTolerance: number;
    primaryGoal: string;
    horizon: string;
    biggestConstraint: string;
  };
};

export type AssessmentResult = {
  version: 3;
  completedAt: string;
  rank: Rank;
  overall: number;
  confidence: number;
  comparisonBand: string;
  professionalArea: ProfessionalArea;
  role: string;
  primaryGoal: string;
  dimensions: {
    physical: number;
    cognitive: number;
    execution: number;
    judgment: number;
    impact: number;
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
  recommendedArchetypes: string[];
  insights: string[];
  methodology: {
    weights: Record<string, number>;
    answeredItems: number;
    totalItems: number;
  };
  benchmarks: {
    source: string;
    dimension: string;
    reading: string;
    limitation: string;
  }[];
};

export const executionQuestions = [
  { id: "x1", text: "Transformo objetivos grandes em ações semanais observáveis." },
  { id: "x2", text: "Protejo blocos de foco mesmo quando aparecem distrações." },
  { id: "x3", text: "Cumpro prazos que defini para mim sem depender de cobrança externa." },
  { id: "x4", text: "Registro resultados e uso os dados para ajustar minha rotina." },
  { id: "x5", text: "Adio tarefas desconfortáveis até que se tornem urgentes.", reverse: true },
  { id: "x6", text: "Consigo manter um hábito importante por pelo menos doze semanas." },
  { id: "x7", text: "Quando falho um dia, retomo o plano na oportunidade seguinte." },
  { id: "x8", text: "Termino projetos antes de começar várias novas ideias." },
  { id: "x9", text: "Meu celular interrompe tarefas que exigem concentração.", reverse: true },
  { id: "x10", text: "Reviso toda semana o que funcionou, o que falhou e o próximo passo." },
] as const;

export const personalityQuestions = [
  { id: "o1", trait: "openness", text: "Tenho curiosidade por ideias abstratas e problemas difíceis." },
  { id: "o2", trait: "openness", text: "Procuro perspectivas que desafiam minhas crenças." },
  { id: "o3", trait: "openness", text: "Gosto de criar maneiras novas de resolver problemas." },
  { id: "o4", trait: "openness", text: "Prefiro quase sempre repetir métodos conhecidos.", reverse: true },
  { id: "c1", trait: "conscientiousness", text: "Preparo meu trabalho com atenção aos detalhes." },
  { id: "c2", trait: "conscientiousness", text: "Concluo o que começo mesmo quando a motivação cai." },
  { id: "c3", trait: "conscientiousness", text: "Organizo compromissos e raramente esqueço entregas." },
  { id: "c4", trait: "conscientiousness", text: "Costumo deixar tarefas importantes para a última hora.", reverse: true },
  { id: "e1", trait: "extraversion", text: "Sinto energia ao conversar e agir com outras pessoas." },
  { id: "e2", trait: "extraversion", text: "Inicio conversas e conexões profissionais com facilidade." },
  { id: "e3", trait: "extraversion", text: "Consigo me posicionar em grupos quando é necessário." },
  { id: "e4", trait: "extraversion", text: "Evito assumir a palavra mesmo quando conheço o assunto.", reverse: true },
  { id: "a1", trait: "agreeableness", text: "Procuro entender o ponto de vista dos outros antes de reagir." },
  { id: "a2", trait: "agreeableness", text: "Coopero sem deixar de comunicar limites claros." },
  { id: "a3", trait: "agreeableness", text: "Dou crédito e reconheço a contribuição de outras pessoas." },
  { id: "a4", trait: "agreeableness", text: "Tenho pouca paciência com os erros de outras pessoas.", reverse: true },
  { id: "s1", trait: "stability", text: "Consigo recuperar a calma depois de situações difíceis." },
  { id: "s2", trait: "stability", text: "Tomo decisões razoáveis mesmo sob pressão." },
  { id: "s3", trait: "stability", text: "Aceito feedback duro sem perder vários dias de produtividade." },
  { id: "s4", trait: "stability", text: "Preocupações pequenas tiram meu foco por muito tempo.", reverse: true },
] as const;

export const knowledgeQuestions = [
  { id: "k1", area: "Numeracia", question: "Um curso de R$ 240 recebe desconto de 15%. Qual é o novo preço?", options: ["R$ 196", "R$ 204", "R$ 210", "R$ 216"], answer: 1 },
  { id: "k2", area: "Lógica", question: "Todos os analistas estudam dados. Ana é analista. O que necessariamente é verdadeiro?", options: ["Ana lidera uma equipe", "Ana estuda dados", "Ana é estatística", "Ana trabalha em banco"], answer: 1 },
  { id: "k3", area: "Finanças", question: "Se a inflação é 6% e um investimento rende 8%, o ganho real aproximado é:", options: ["2%", "6%", "8%", "14%"], answer: 0 },
  { id: "k4", area: "Ciência", question: "Qual prática torna uma conclusão experimental mais confiável?", options: ["Ignorar resultados contrários", "Repetir e controlar variáveis", "Escolher a menor amostra", "Mudar a hipótese depois"], answer: 1 },
  { id: "k5", area: "Leitura", question: "Para avaliar um argumento, o principal é verificar:", options: ["O tamanho do texto", "A fama do autor", "Se as evidências sustentam a conclusão", "Se há palavras difíceis"], answer: 2 },
  { id: "k6", area: "Digital", question: "Qual atitude reduz mais o risco de invasão de uma conta?", options: ["Repetir a mesma senha", "Usar 2FA e senha única", "Salvar senha em mensagem", "Clicar em links urgentes"], answer: 1 },
  { id: "k7", area: "Probabilidade", question: "Uma moeda justa é lançada duas vezes. A chance de sair duas caras é:", options: ["25%", "33%", "50%", "75%"], answer: 0 },
  { id: "k8", area: "Dados", question: "Um valor atípico muito alto costuma afetar mais qual medida?", options: ["Mediana", "Moda", "Média", "Percentil 25"], answer: 2 },
  { id: "k9", area: "Estatística", question: "Correlação entre duas variáveis, sozinha, demonstra que uma causa a outra?", options: ["Sempre", "Nunca pode coexistir", "Não; são necessárias outras evidências", "Somente com amostra pequena"], answer: 2 },
  { id: "k10", area: "Finanças", question: "Diversificação é usada principalmente para:", options: ["Eliminar todo risco", "Reduzir concentração de riscos específicos", "Garantir lucro", "Aumentar taxas"], answer: 1 },
  { id: "k11", area: "Lógica", question: "Se uma afirmação é testável, qual atitude melhora sua análise?", options: ["Buscar apenas confirmações", "Definir o que poderia refutá-la", "Confiar no consenso do grupo", "Evitar medir"], answer: 1 },
  { id: "k12", area: "Proporção", question: "Uma equipe faz 18 entregas em 6 dias. Mantido o ritmo, quantas fará em 10 dias?", options: ["24", "28", "30", "36"], answer: 2 },
  { id: "k13", area: "Informação", question: "Qual fonte tende a ser mais forte para confirmar uma alegação técnica?", options: ["Post sem referências", "Documento primário com método verificável", "Vídeo viral", "Comentário anônimo"], answer: 1 },
  { id: "k14", area: "Aprendizagem", question: "Qual estratégia tende a melhorar retenção de longo prazo?", options: ["Reler passivamente", "Prática de recuperação espaçada", "Destacar todo o texto", "Estudar apenas na véspera"], answer: 1 },
] as const;

export const judgmentQuestions = [
  { id: "j1", area: "Decisão", question: "Você precisa escolher entre dois projetos importantes com informação incompleta. O melhor primeiro passo é:", options: ["Escolher o mais empolgante", "Definir critérios, premissas e custo de reversão", "Adiar indefinidamente", "Copiar um concorrente"], answer: 1 },
  { id: "j2", area: "Erro", question: "Um plano falhou depois de grande investimento. O que fazer?", options: ["Investir mais só para não desperdiçar", "Ocultar o resultado", "Reavaliar pelo valor futuro, não pelo custo passado", "Culpar quem alertou"], answer: 2 },
  { id: "j3", area: "Equipe", question: "Uma pessoa competente repete atrasos. A resposta mais robusta é:", options: ["Esperar melhorar", "Conversar com fatos, causa, acordo e acompanhamento", "Criticar em público", "Fazer tudo por ela"], answer: 1 },
  { id: "j4", area: "Risco", question: "Uma oportunidade promete retorno alto e risco pouco claro. Você deve:", options: ["Apostar tudo rápido", "Ignorar porque todo risco é ruim", "Limitar exposição e investigar cenários adversos", "Confiar apenas no vendedor"], answer: 2 },
  { id: "j5", area: "Feedback", question: "Você recebe críticas contraditórias de duas pessoas. O melhor é:", options: ["Aceitar ambas sem pensar", "Rejeitar as duas", "Buscar exemplos, padrões e testar uma mudança", "Responder imediatamente"], answer: 2 },
  { id: "j6", area: "Prioridade", question: "Há dez tarefas urgentes e capacidade para três. Você:", options: ["Começa todas", "Escolhe por impacto, prazo real e dependências", "Atende quem pressiona mais", "Evita decidir"], answer: 1 },
  { id: "j7", area: "Ética", question: "Um atalho aumentaria o resultado, mas omite um risco relevante ao cliente. Você:", options: ["Usa se ninguém descobrir", "Comunica o risco e busca alternativa sustentável", "Deixa outro decidir", "Apaga registros"], answer: 1 },
  { id: "j8", area: "Previsão", question: "Para estimar o tempo de um projeto novo, é mais prudente:", options: ["Usar apenas o cenário ideal", "Observar projetos semelhantes e incluir margem", "Prometer antes de analisar", "Dobrar qualquer palpite"], answer: 1 },
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scaleFive(value: number) {
  return clamp(((value - 1) / 4) * 100);
}

function likertScore<T extends readonly { id: string; reverse?: boolean }[]>(answers: Record<string, number>, questions: T) {
  const total = questions.reduce((sum, question) => {
    const raw = answers[question.id] || 3;
    return sum + (question.reverse ? 6 - raw : raw);
  }, 0);
  return clamp(((total - questions.length) / (questions.length * 4)) * 100);
}

function personalityScore(answers: Record<string, number>, trait: string) {
  const questions = personalityQuestions.filter((question) => question.trait === trait);
  return likertScore(answers, questions);
}

function resourceScore(monthlyIncome: number, householdSize: number, savingsMonths: number) {
  const perPerson = monthlyIncome / Math.max(householdSize, 1);
  const incomeBand = perPerson < 100 ? 10 : perPerson < 250 ? 25 : perPerson < 500 ? 40 : perPerson < 1000 ? 55 : perPerson < 2000 ? 70 : perPerson < 4000 ? 85 : 100;
  return clamp(incomeBand * 0.65 + Math.min(savingsMonths / 12, 1) * 35);
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
  if (score < 30) return "fundação — várias capacidades ainda não têm evidência consistente";
  if (score < 45) return "desenvolvimento — fundamentos presentes, porém irregulares";
  if (score < 60) return "competência funcional — base utilizável com lacunas claras";
  if (score < 75) return "execução avançada — resultados sólidos em múltiplas dimensões";
  if (score < 90) return "alta performance — repertório e execução raros nesta escala";
  return "excelência na avaliação — precisa ser confirmada por resultados sustentados";
}

function objectiveScore(answers: Record<string, number>, questions: readonly { id: string; answer: number }[]) {
  const correct = questions.filter((question) => answers[question.id] === question.answer).length;
  return { correct, score: clamp(correct / questions.length * 100) };
}

export function scoreAssessment(answers: AssessmentAnswers): AssessmentResult {
  const weightedActivity = answers.physical.moderateMinutes + answers.physical.vigorousMinutes * 2;
  const activity = Math.min(weightedActivity / 150, 1) * 32;
  const strength = Math.min(answers.physical.strengthDays / 2, 1) * 16;
  const activeDays = Math.min(answers.physical.activeDays / 5, 1) * 10;
  const sleepDuration = Math.max(0, 18 - Math.abs(7.5 - answers.physical.sleepHours) * 6);
  const recovery = scaleFive(answers.physical.sleepQuality) * 0.09 + scaleFive(answers.physical.energy) * 0.09;
  const consistency = Math.min(answers.physical.consistencyMonths / 12, 1) * 6;
  const physical = clamp(activity + strength + activeDays + sleepDuration + recovery + consistency);

  const knowledge = objectiveScore(answers.knowledge, knowledgeQuestions);
  const judgmentResult = objectiveScore(answers.judgment, judgmentQuestions);
  const execution = likertScore(answers.execution, executionQuestions);
  const personality = {
    openness: personalityScore(answers.personality, "openness"),
    conscientiousness: personalityScore(answers.personality, "conscientiousness"),
    extraversion: personalityScore(answers.personality, "extraversion"),
    agreeableness: personalityScore(answers.personality, "agreeableness"),
    stability: personalityScore(answers.personality, "stability"),
  };

  const careerStageScore: Record<string, number> = { exploring: 15, entry: 30, specialist: 52, manager: 70, executive: 85, owner: 82 };
  const output = Math.min(answers.trajectory.projectsCompleted / 12, 1) * 24;
  const leadershipEvidence = Math.min(answers.trajectory.peopleLed / 10, 1) * 18;
  const communicationEvidence = Math.min(answers.trajectory.presentationsLastYear / 12, 1) * 14;
  const learningEvidence = Math.min(answers.trajectory.booksLastYear / 24, 1) * 12;
  const feedback = scaleFive(answers.trajectory.feedbackFrequency) * 0.10;
  const clarity = scaleFive(answers.trajectory.goalClarity) * 0.10;
  const economicTrajectory = clamp((answers.trajectory.incomeGrowth + 20) / 70 * 100) * 0.08;
  const impact = clamp(output + leadershipEvidence + communicationEvidence + learningEvidence + feedback + clarity + economicTrajectory + (careerStageScore[answers.profile.careerStage] || 35) * 0.08);
  const resources = resourceScore(answers.profile.monthlyHouseholdIncomeUsd, answers.profile.householdSize, answers.trajectory.savingsMonths);

  const weights = { cognitive: 24, execution: 23, physical: 18, judgment: 15, impact: 15, resources: 5 };
  const overall = clamp(
    knowledge.score * 0.24
      + execution * 0.23
      + physical * 0.18
      + judgmentResult.score * 0.15
      + impact * 0.15
      + resources * 0.05,
  );

  const educationBoost: Record<string, number> = { fundamental: 28, medio: 45, technical: 55, superior: 68, pos: 82 };
  const education = educationBoost[answers.profile.education] || 40;
  const skills: SkillLevels = {
    body: physical,
    knowledge: clamp(knowledge.score * 0.68 + answers.profile.weeklyStudyHours * 1.2 + personality.openness * 0.2),
    discipline: clamp(execution * 0.72 + personality.conscientiousness * 0.18 + physical * 0.1),
    communication: clamp(personality.extraversion * 0.35 + communicationEvidence * 2.1 + knowledge.score * 0.2 + education * 0.15),
    capital: clamp(resources * 0.22 + judgmentResult.score * 0.26 + impact * 0.32 + execution * 0.2),
    leadership: clamp(judgmentResult.score * 0.27 + impact * 0.3 + execution * 0.2 + personality.stability * 0.13 + personality.agreeableness * 0.1),
  };

  const archetypeScores = {
    sage: skills.knowledge * 0.46 + skills.discipline * 0.25 + personality.openness * 0.2 + skills.communication * 0.09,
    entrepreneur: skills.capital * 0.35 + skills.communication * 0.24 + skills.discipline * 0.21 + skills.leadership * 0.2,
    athlete: skills.body * 0.58 + skills.discipline * 0.32 + personality.stability * 0.1,
    leader: skills.leadership * 0.38 + skills.communication * 0.25 + skills.knowledge * 0.17 + skills.discipline * 0.2,
  };
  const recommendedArchetypes = Object.entries(archetypeScores).sort((a, b) => b[1] - a[1]).map(([id]) => id);

  const answeredItems = Object.keys(answers.execution).length
    + Object.keys(answers.personality).length
    + Object.keys(answers.knowledge).length
    + Object.keys(answers.judgment).length
    + 34;
  const totalItems = executionQuestions.length + personalityQuestions.length + knowledgeQuestions.length + judgmentQuestions.length + 34;
  const confidence = clamp(answeredItems / totalItems * 100);

  const insights = [
    weightedActivity >= 150
      ? "Você alcança a referência semanal mínima de atividade física usada pela OMS."
      : `Faltam aproximadamente ${Math.max(0, 150 - weightedActivity)} minutos moderados equivalentes para a referência semanal usada.`,
    `Você acertou ${knowledge.correct} de ${knowledgeQuestions.length} itens de conhecimento e ${judgmentResult.correct} de ${judgmentQuestions.length} cenários de julgamento.`,
    execution >= 65
      ? "Sua execução declarada mostra bons mecanismos de foco, retomada e revisão. Valide isso com registros semanais."
      : "A maior alavanca imediata é criar um sistema semanal simples: planejar, executar, registrar e revisar.",
    "A personalidade descreve como você tende a agir; ela orienta a rota, mas não aumenta nem reduz o ranking.",
    "Renda e reserva representam acesso a recursos, têm peso de apenas 5% e não definem potencial.",
  ];
  const benchmarks = [
    {
      source: "OMS",
      dimension: "Atividade física",
      reading: weightedActivity >= 150 ? "Referência semanal atingida" : `${weightedActivity} de 150 min equivalentes`,
      limitation: "Referência populacional geral; não substitui avaliação individual.",
    },
    {
      source: "OECD PIAAC",
      dimension: "Literacia e resolução",
      reading: `${knowledge.correct}/${knowledgeQuestions.length} itens corretos no instrumento Nexo`,
      limitation: "Itens inspirados nas competências do programa; não equivalem a uma prova ou percentil PIAAC.",
    },
    {
      source: "Banco Mundial PIP",
      dimension: "Contexto de recursos",
      reading: `Índice contextual ${resources}/100 com peso de 5%`,
      limitation: "Sem ajuste completo de poder de compra, ano e distribuição do país; não é percentil global.",
    },
    {
      source: "IPIP / Big Five",
      dimension: "Personalidade",
      reading: "Cinco tendências usadas para adaptar a estratégia",
      limitation: "Descritivo e autodeclarado; não soma nem remove pontos do rank.",
    },
  ];

  return {
    version: 3,
    completedAt: new Date().toISOString(),
    rank: rankFromScore(overall),
    overall,
    confidence,
    comparisonBand: comparisonBand(overall),
    professionalArea: answers.profile.professionalArea,
    role: answers.profile.role,
    primaryGoal: answers.trajectory.primaryGoal,
    dimensions: { physical, cognitive: knowledge.score, execution, judgment: judgmentResult.score, impact, resources },
    personality,
    skills,
    recommendedArchetype: recommendedArchetypes[0],
    recommendedArchetypes,
    insights,
    methodology: { weights, answeredItems, totalItems },
    benchmarks,
  };
}
