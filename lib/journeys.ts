import type { StudyMapRecord, ThemeRecord } from "./learning.ts";

export type JourneyStatus = "active" | "paused" | "completed" | "archived";
export type JourneyActivity = {
  id: string;
  title: string;
  date: string;
  minutes: number;
  done: boolean;
  notes?: string;
  value?: number;
};

export type JourneyRecord = {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  objective: string;
  status: JourneyStatus;
  startDate: string;
  deadline?: string;
  metricName: string;
  metricUnit: string;
  target: number;
  current: number;
  activities: JourneyActivity[];
  sourceThemeIds: string[];
  sourceMapIds: string[];
  createdAt: string;
  updatedAt: string;
};

export const journeySuggestions = ["Estudos", "Corrida", "Musculação", "Leitura", "Carreira", "Finanças", "Saúde", "Projeto pessoal"];

export function journeyProgress(journey: JourneyRecord) {
  if (journey.target > 0) return Math.min(100, Math.round(journey.current / journey.target * 100));
  if (!journey.activities.length) return 0;
  return Math.round(journey.activities.filter((item) => item.done).length / journey.activities.length * 100);
}

export function migrateStudyOrganizationToJourneys(themes: ThemeRecord[], maps: StudyMapRecord[], existing: JourneyRecord[]) {
  const now = new Date().toISOString();
  const mapIds = new Set(existing.flatMap((journey) => journey.sourceMapIds));
  const themeIds = new Set(existing.flatMap((journey) => journey.sourceThemeIds));
  const migratedMaps = maps.filter((map) => !mapIds.has(map.id)).map((map): JourneyRecord => {
    const linkedTheme = themes.find((theme) => map.themeIds.includes(theme.id));
    return {
      id: `journey-map-${map.id}`, name: map.name, category: linkedTheme?.category || "Estudos",
      icon: linkedTheme?.icon || "📚", color: linkedTheme?.color || "#c6ff4a", objective: map.objective,
      status: map.status, startDate: map.createdAt.slice(0, 10), deadline: map.deadline,
      metricName: "Conteúdo dominado", metricUnit: "%", target: 100, current: map.mapping.coverage,
      activities: [], sourceThemeIds: map.themeIds, sourceMapIds: [map.id], createdAt: map.createdAt, updatedAt: now,
    };
  });
  const linkedThemeIds = new Set(maps.flatMap((map) => map.themeIds));
  const migratedThemes = themes.filter((theme) => !linkedThemeIds.has(theme.id) && !themeIds.has(theme.id)).map((theme): JourneyRecord => ({
    id: `journey-theme-${theme.id}`, name: theme.name, category: theme.category || "Estudos", icon: theme.icon,
    color: theme.color, objective: theme.objective, status: theme.archived ? "archived" : "active",
    startDate: theme.createdAt.slice(0, 10), metricName: "Progresso", metricUnit: "%", target: 100, current: 0,
    activities: [], sourceThemeIds: [theme.id], sourceMapIds: [], createdAt: theme.createdAt, updatedAt: now,
  }));
  return [...existing, ...migratedMaps, ...migratedThemes];
}
