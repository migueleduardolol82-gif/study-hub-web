export const metricIndicators = [
  { id: "xp", label: "XP total", unit: "XP" },
  { id: "streak", label: "Sequência", unit: "dias" },
  { id: "reviews", label: "Revisões pendentes", unit: "conceitos" },
  { id: "path", label: "Progresso da trilha", unit: "%" },
  { id: "mastery", label: "Domínio dos conceitos", unit: "%" },
  { id: "goals", label: "Metas da semana", unit: "%" },
  { id: "habits", label: "Hábitos de hoje", unit: "%" },
  { id: "study", label: "Estudo na semana", unit: "h" },
  { id: "training", label: "Treino na semana", unit: "h" },
  { id: "journeys", label: "Progresso das jornadas", unit: "%" },
  { id: "plans", label: "Progresso do plano", unit: "%" },
] as const;

export type MetricIndicator = (typeof metricIndicators)[number]["id"];
export type MetricWidgetSize = "sm" | "wide" | "tall" | "lg";
export type MetricWidgetView = "number" | "progress" | "bars";

export interface MetricWidgetConfig {
  id: string;
  indicator: MetricIndicator;
  title: string;
  size: MetricWidgetSize;
  view: MetricWidgetView;
  prompt: string;
  color?: string;
}

export const defaultMetricWidgets: MetricWidgetConfig[] = [
  { id: "metric-default-xp", indicator: "xp", title: "XP acumulado", size: "wide", view: "bars", prompt: "" },
  { id: "metric-default-study", indicator: "study", title: "Ritmo de estudo", size: "wide", view: "bars", prompt: "" },
  { id: "metric-default-goals", indicator: "goals", title: "Metas da semana", size: "sm", view: "progress", prompt: "" },
  { id: "metric-default-streak", indicator: "streak", title: "Sequência", size: "sm", view: "number", prompt: "" },
];

const sizes = new Set<MetricWidgetSize>(["sm", "wide", "tall", "lg"]);
const views = new Set<MetricWidgetView>(["number", "progress", "bars"]);
const indicators = new Set<string>(metricIndicators.map((item) => item.id));

export function normalizeMetricWidgets(value: unknown): MetricWidgetConfig[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 30).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<MetricWidgetConfig>;
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || seen.has(item.id) || !indicators.has(String(item.indicator))) return [];
    seen.add(item.id);
    const indicator = item.indicator as MetricIndicator;
    return [{
      id: item.id,
      indicator,
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim().slice(0, 60) : metricIndicators.find((entry) => entry.id === indicator)!.label,
      size: sizes.has(item.size as MetricWidgetSize) ? item.size as MetricWidgetSize : "sm",
      view: views.has(item.view as MetricWidgetView) ? item.view as MetricWidgetView : "number",
      prompt: typeof item.prompt === "string" ? item.prompt.slice(0, 300) : "",
      ...(typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color) ? { color: item.color } : {}),
    }];
  });
}

export function widgetFromPrompt(prompt: string, indicator: MetricIndicator, title: string, size: MetricWidgetSize, view: MetricWidgetView): MetricWidgetConfig {
  const lower = prompt.toLocaleLowerCase("pt-BR");
  const inferredSize = /grande|destaque/.test(lower) ? "lg" : /largo|horizontal/.test(lower) ? "wide" : /alto|vertical/.test(lower) ? "tall" : /compacto|pequeno/.test(lower) ? "sm" : size;
  const inferredView = /barras|gráfico|grafico|histograma/.test(lower) ? "bars" : /progresso|barra de progresso|percentual/.test(lower) ? "progress" : /número|numero|valor/.test(lower) ? "number" : view;
  const named = prompt.match(/(?:chamad[oa]|título|titulo)\s+["“']([^"”']{1,60})["”']/i)?.[1];
  return {
    id: `metric-${crypto.randomUUID()}`,
    indicator,
    title: (named || title.trim() || metricIndicators.find((item) => item.id === indicator)!.label).slice(0, 60),
    size: inferredSize,
    view: inferredView,
    prompt: prompt.trim().slice(0, 300),
  };
}
