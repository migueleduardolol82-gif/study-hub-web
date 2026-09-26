export type Habit = {
  id: string; name: string; target: number; unit: string; period: 'Manhã'|'Tarde'|'Noite'|'Sem horário'; time: string;
  frequency: 'daily'|'days'|'weekly'|'monthly'|'once'; days: number[]; times: number; date: string;
  skillId: string; routine: string; minutes: number; importance: number; physical: boolean;
  contributions: { id: string; weight: number }[]; archived: boolean; created: string; kind?: 'habit'|'training'|'exam'; notes?: string;
};
export type HabitEntry = { habitId: string; date: string; value: number; target: number; name: string; unit: string };
export type ArchetypeLevel = 'zero'|'beginner'|'intermediate'|'advanced';
export type RoutineState = { habits: Habit[]; entries: HabitEntry[]; goals: Record<string, boolean>; dismissed: string[]; minutes: number; recovery: boolean; archetypeLevels: Record<string,ArchetypeLevel> };
export const emptyRoutine = (): RoutineState => ({ habits: [], entries: [], goals: {}, dismissed: [], minutes: 90, recovery: false, archetypeLevels: {} });
export function localDate(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function shiftDate(date: string, days: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+days); return localDate(d); }
export function weekDates(date: string) { const day = new Date(`${date}T12:00:00`).getDay(); const start=shiftDate(date,-((day+6)%7)); return Array.from({length:7},(_,i)=>shiftDate(start,i)); }
export function normalizeRoutine(value?: Partial<RoutineState> | null): RoutineState { const levels=value?.archetypeLevels??{}; return { ...emptyRoutine(), ...value, habits: Array.isArray(value?.habits)?value.habits:[], entries: Array.isArray(value?.entries)?value.entries:[], goals: value?.goals??{}, dismissed:value?.dismissed??[], archetypeLevels:Object.fromEntries(Object.entries(levels).filter((entry):entry is [string,ArchetypeLevel]=>['zero','beginner','intermediate','advanced'].includes(entry[1]))) }; }
export function complete(entry?: HabitEntry) { return Boolean(entry && entry.value >= entry.target); }
export function entryFor(state: RoutineState, id: string, date: string) { return state.entries.find(e=>e.habitId===id&&e.date===date); }
export function due(h: Habit, date: string, state: RoutineState) {
  if(h.archived || date<h.created) return false;
  if(h.frequency==='once') return date===h.date;
  if(h.frequency==='days') return h.days.includes(new Date(`${date}T12:00:00`).getDay());
  if(h.frequency==='weekly'||h.frequency==='monthly') {
    const start=h.frequency==='weekly'?weekDates(date)[0]:date.slice(0,7)+'-01';
    const count=state.entries.filter(e=>e.habitId===h.id && e.date>=start && e.date<date && complete(e)).length;
    return count<h.times;
  }
  return true;
}
export function record(state: RoutineState,h: Habit,date: string,value: number): RoutineState {
  if(!Number.isFinite(value)||value<0) return state;
  const previous=entryFor(state,h.id,date);
  const next={habitId:h.id,date,value,target:previous?.target??h.target,name:previous?.name??h.name,unit:previous?.unit??h.unit};
  return {...state,entries:[...state.entries.filter(e=>!(e.habitId===h.id&&e.date===date)),next]};
}
export function weekSummary(state: RoutineState,date: string) {
  const dates=weekDates(date); let target=0,done=0;
  for(const h of state.habits.filter(h=>!h.archived)) {
    const count=state.entries.filter(e=>e.habitId===h.id&&dates.includes(e.date)&&complete(e)).length;
    const planned=h.frequency==='weekly'?h.times:h.frequency==='monthly'?Math.min(h.times,dates.filter(d=>due(h,d,state)).length):dates.filter(d=>due(h,d,state)).length;
    target+=planned;done+=Math.min(count,planned);
  }
  return {done,target,percent:target?Math.round(done/target*100):0};
}
export type ArchetypePlan = { id:string; name:string; dailyProtocol:string[]; milestones:string[] };
export function archetypeWeights(ids:string[]) { const unique=[...new Set(ids.filter(Boolean))].slice(0,3); const weights=[50,30,20];const total=weights.slice(0,unique.length).reduce((a,b)=>a+b,0);return unique.map((id,i)=>({id,weight:weights[i]/total})); }
export function habitTemplate(name:string,date=localDate()):Habit { return {id:crypto.randomUUID(),name,target:1,unit:'vez',period:'Sem horário',time:'',frequency:'daily',days:[1,2,3,4,5],times:3,date,skillId:'',routine:'',minutes:15,importance:3,physical:false,contributions:[],archived:false,created:date,kind:'habit',notes:''}; }
export const habitPresets = [
  {name:'Estudo focado',kind:'habit',unit:'min',target:40,minutes:40,physical:false,frequency:'daily'},
  {name:'Revisão ativa',kind:'habit',unit:'cartões',target:20,minutes:20,physical:false,frequency:'daily'},
  {name:'Leitura',kind:'habit',unit:'páginas',target:15,minutes:25,physical:false,frequency:'daily'},
  {name:'Treino de força',kind:'training',unit:'séries',target:12,minutes:50,physical:true,frequency:'weekly'},
  {name:'Corrida',kind:'training',unit:'km',target:5,minutes:35,physical:true,frequency:'weekly'},
  {name:'Mobilidade',kind:'training',unit:'min',target:15,minutes:15,physical:true,frequency:'weekly'},
  {name:'Dia de prova',kind:'exam',unit:'prova',target:1,minutes:120,physical:false,frequency:'once'},
] as const;
export const skillPresets = ['Concentração','Memorização','Escrita','Matemática','Comunicação','Condicionamento físico','Força','Organização'];
export function habitFromPreset(preset:typeof habitPresets[number],date=localDate()):Habit { return {...habitTemplate(preset.name,date),kind:preset.kind,target:preset.target,unit:preset.unit,minutes:preset.minutes,physical:preset.physical,frequency:preset.frequency,times:preset.frequency==='weekly'?3:1}; }
const key=(name:string)=>name.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
export function priorities(state:RoutineState,archetypes:ArchetypePlan[],ids:string[],date:string,deficits:Record<string,number>={}) {
  const weights=archetypeWeights(ids);const candidates=new Map<string,Habit>();
  for(const a of archetypes.filter(a=>weights.some(w=>w.id===a.id))) for(const name of a.dailyProtocol) {
    const k=key(name);const existing=candidates.get(k);
    if(existing) existing.contributions.push({id:a.id,weight:1});
    else candidates.set(k,{...habitTemplate(name,date),id:`suggestion:${k}`,frequency:'once',contributions:[{id:a.id,weight:1}],minutes:Number(name.match(/(\d+)\s*min/)?.[1]||15)});
  }
  for(const h of state.habits.filter(h=>due(h,date,state))) candidates.set(key(h.name),{...h,contributions:h.contributions.length?h.contributions:candidates.get(key(h.name))?.contributions??[]});
  const ranked=[...candidates.values()].filter(h=>!state.dismissed.includes(`${date}:${h.id}`)&&!complete(entryFor(state,h.id,date))&&!(state.recovery&&h.physical)).map(h=>{
    const last=state.entries.filter(e=>(e.habitId===h.id||key(e.name)===key(h.name))&&complete(e)&&e.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const gap=last?Math.min(7,Math.max(0,Math.round((Date.parse(date)-Date.parse(last.date))/86400000))):7;
    const impact=h.contributions.reduce((n,c)=>n+(weights.find(w=>w.id===c.id)?.weight??0)*c.weight,0)/Math.max(1,h.contributions.reduce((n,c)=>n+c.weight,0));
    const unfinished=h.contributions.some(c=>{const a=archetypes.find(a=>a.id===c.id);return a?.milestones.some((_,i)=>!state.goals[`${a.id}:${i}`]);});
    const deficit=Math.max(0,Math.min(1,deficits[h.skillId]??0));
    const score=(1+deficit)*(impact||.1)*h.importance*(1+gap/7)*(h.frequency==='once'?1.4:1)*(unfinished?1.2:1)*(h.contributions.length>1?1.15:1);
    return {habit:h,score,reason:`Peso dos arquétipos: ${Math.round(impact*100)}%. Importância ${h.importance}/5. ${deficit>0?`Distância da meta pessoal da habilidade: ${Math.round(deficit*100)}%.`:""} ${last?`Última conclusão em ${last.date}.`:'Sem conclusão registrada.'} ${unfinished?'Há objetivos pendentes.':''} ${h.contributions.length>1?'Contribui para mais de um arquétipo.':''}`};
  }).sort((a,b)=>b.score-a.score||a.habit.name.localeCompare(b.habit.name));
  let budget=state.minutes;return ranked.filter(r=>{if(r.habit.minutes>budget)return false;budget-=r.habit.minutes;return true;}).slice(0,7);
}
