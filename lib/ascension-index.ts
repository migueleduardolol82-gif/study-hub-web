/** Performance is intentionally independent of XP. No universal human percentile is inferred. */
export const domains = ["Corpo", "Intelecto", "Disciplina", "Carreira", "Finanças", "Comunicação", "Social", "Criatividade", "Liderança", "Propósito"] as const;
export type SkillEvidence = { id: string; value: number; date: string; note: string; source: string };
export type SkillTrack = {
  id: string; name: string; domain: string; unit: string; direction: "lower" | "higher";
  context: string; journeyId: string; weeklyDays: number; mission: string;
  baseline: number; target: number; referenceUrl: string; referenceDate: string;
  evidence: SkillEvidence[]; archived: boolean;
};
export const levelBands = [[10,"Iniciado"],[25,"Aprendiz"],[40,"Praticante"],[55,"Consistente"],[70,"Competente"],[85,"Avançado"],[100,"Especialista"],[115,"Elite"],[125,"Mestre"],[135,"Ascendente"],[142,"Lendário"],[147,"Mítico"],[149,"Transcendente"],[150,"Apex"]] as const;
export const ascensionGates = [50,75,100,125,135,143,150];
export function bandForLevel(level: number) { return levelBands.find(([ceiling]) => level <= ceiling)?.[1] ?? "Apex"; }
export function validEvidence(track: SkillTrack, now = Date.now()) {
  return track.evidence.filter(e => Number.isFinite(e.value) && e.value >= 0 && Number.isFinite(Date.parse(e.date)) && Date.parse(e.date) <= now).sort((a,b) => Date.parse(a.date)-Date.parse(b.date));
}
export function personalLevel(track: SkillTrack, value: number) {
  const delta = track.target-track.baseline;
  if (!Number.isFinite(value) || !Number.isFinite(delta) || delta === 0 || (track.direction === "lower" ? delta >= 0 : delta <= 0)) return null;
  const fraction = Math.max(0, Math.min(1, (value-track.baseline)/delta));
  // Increasing marginal difficulty: an ever smaller performance gain separates high levels.
  return Math.min(150, 1 + Math.floor(149 * (1-Math.sqrt(1-fraction))));
}
export function skillSummary(track: SkillTrack, now = Date.now()) {
  const evidence = validEvidence(track, now);
  const best = evidence.reduce<SkillEvidence | null>((acc,e) => !acc || (track.direction === "lower" ? e.value < acc.value : e.value > acc.value) ? e : acc, null);
  const recent = evidence.filter(e => now-Date.parse(e.date) <= 30*86400000);
  const latest = recent.at(-1);
  const level = best ? personalLevel(track, best.value) : null;
  const recentLevel = latest ? personalLevel(track, latest.value) : null;
  const first = evidence[0];
  const improvement = first && best && first.value !== 0 ? Math.round((best.value-first.value)/Math.abs(first.value)*1000)*(track.direction === "lower" ? -1 : 1)/10 : null;
  return { best, latest, level, recentLevel, improvement, count: evidence.length, nextGate: ascensionGates.find(g => g > (level ?? 0)) ?? null };
}
export function recentRank(level: number | null) {
  if (level === null) return "Sem avaliação recente";
  if (level >= 148) return "Transcendente";
  if (level >= 143) return "Mítico";
  if (level >= 136) return "Grão-Mestre";
  if (level >= 126) return "Mestre";
  const index = Math.min(17, Math.floor((Math.max(1,level)-1)*18/125));
  return `${["Ferro","Bronze","Prata","Ouro","Platina","Diamante"][Math.floor(index/3)]} ${["III","II","I"][index%3]}`;
}
export function consistencyScore(dates: string[], weeklyDays: number, now = Date.now()) {
  const days = new Set(dates.filter(date => Date.parse(date) <= now && now-Date.parse(date) < 28*86400000).map(date => date.slice(0,10)));
  return Math.min(100,Math.round(days.size/Math.max(1,Math.min(7,weeklyDays)*4)*100));
}
export function overallIndex(tracks: SkillTrack[], consistency: number, now = Date.now()) {
  const groups = new Map<string,number[]>();
  for (const track of tracks.filter(t=>!t.archived)) {
    const level = skillSummary(track,now).level;
    if (level !== null) groups.set(track.domain,[...(groups.get(track.domain)??[]),level]);
  }
  const values = [...groups.values()].map(levels => levels.reduce((a,b)=>a+b,0)/levels.length).sort((a,b)=>b-a);
  // Missing domains stay unknown. Do not publish a general score from just one specialty.
  if (values.length < 3) return null;
  const peak = values.slice(0,3).reduce((a,b)=>a+b,0)/3;
  const breadth = values.reduce((a,b)=>a+b,0)/values.length;
  return Math.min(150,Math.round(peak*.5 + Math.max(0,Math.min(100,consistency))*1.5*.3 + breadth*.2));
}
export function suggestedClass(tracks: SkillTrack[], now = Date.now()) {
  const scored = tracks.filter(t=>!t.archived).map(t=>({domain:t.domain,level:skillSummary(t,now).level})).filter(t=>t.level!==null).sort((a,b)=>b.level!-a.level!);
  if (!scored.length) return "Em descoberta";
  const names: Record<string,string> = { Corpo:"Atleta", Intelecto:"Erudito", Disciplina:"Executor", Carreira:"Estrategista", Finanças:"Empreendedor", Comunicação:"Comunicador", Social:"Conector", Criatividade:"Criador", Liderança:"Líder", Propósito:"Explorador" };
  return names[scored[0].domain] ?? "Explorador";
}
