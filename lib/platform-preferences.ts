export const widgetCatalog = [
  {id:'continue', label:'Continuar', description:'Retome sua trilha mais recente.'},
  {id:'today', label:'Hoje e metas', description:'Agenda, hábitos e metas da semana.'},
  {id:'evolution', label:'Evolução', description:'Nível, ranking, XP e sequência.'},
  {id:'focus', label:'Sessão de foco', description:'Cronômetro de estudo na página inicial.'},
  {id:'shortcuts', label:'Acessos rápidos', description:'Atalhos para as áreas principais.'},
] as const;
export type HomeWidgetId = typeof widgetCatalog[number]['id'];

export const platformPalettes = [
  {id:'neon',label:'Nexo',accent:'#caff55',accent2:'#765ee8',base:'#08090b',surface:'#101216'},
  {id:'ember',label:'Energia',accent:'#ff4b28',accent2:'#ffb14a',base:'#090807',surface:'#16110f'},
  {id:'violet',label:'Órbita',accent:'#d7ff4a',accent2:'#7351d6',base:'#08070c',surface:'#13101b'},
  {id:'ice',label:'Precisão',accent:'#68e1ff',accent2:'#5978ff',base:'#060a0c',surface:'#0d1418'},
  {id:'sand',label:'Editorial',accent:'#ff5a36',accent2:'#9c7cff',base:'#e7e3da',surface:'#f4f1e9'},
] as const;
export type PlatformPaletteId = typeof platformPalettes[number]['id'];
export type PlatformDensity = 'comfortable'|'compact';
export type PlatformRadius = 'rounded'|'soft'|'sharp';
export type PlatformEffects = 'ambient'|'minimal';
export type PlatformMode = 'dark'|'light';
export type PlatformPreferences = {palette:PlatformPaletteId; customAccent:string; widgets:HomeWidgetId[]; density:PlatformDensity; radius:PlatformRadius; effects:PlatformEffects; mode:PlatformMode};
export const defaultPlatformPreferences: PlatformPreferences = {palette:'neon',customAccent:'',widgets:['continue','today','evolution','shortcuts'],density:'comfortable',radius:'rounded',effects:'ambient',mode:'dark'};

const hex=/^#[0-9a-f]{6}$/i;
export function normalizePlatformPreferences(value: unknown): PlatformPreferences {
  if(!value || typeof value !== 'object') return {...defaultPlatformPreferences,widgets:[...defaultPlatformPreferences.widgets]};
  const raw=value as Partial<PlatformPreferences>;
  const palette=platformPalettes.some(item=>item.id===raw.palette)?raw.palette as PlatformPaletteId:'neon';
  const valid=new Set(widgetCatalog.map(item=>item.id));
  const widgets=Array.isArray(raw.widgets)?raw.widgets.filter((id,index,all):id is HomeWidgetId=>typeof id==='string'&&valid.has(id as HomeWidgetId)&&all.indexOf(id)===index):defaultPlatformPreferences.widgets;
  const density:PlatformDensity=raw.density==='compact'?'compact':'comfortable';
  const radius:PlatformRadius=raw.radius==='sharp'||raw.radius==='soft'?raw.radius:'rounded';
  const effects:PlatformEffects=raw.effects==='minimal'?'minimal':'ambient';
  const mode:PlatformMode=raw.mode==='light'?'light':'dark';
  return {palette,customAccent:typeof raw.customAccent==='string'&&hex.test(raw.customAccent)?raw.customAccent:'',widgets:[...widgets],density,radius,effects,mode};
}

export function moveWidget(widgets: HomeWidgetId[], id: HomeWidgetId, direction: -1|1) {
  const index=widgets.indexOf(id),next=index+direction;if(index<0||next<0||next>=widgets.length)return widgets;
  const result=[...widgets];[result[index],result[next]]=[result[next],result[index]];return result;
}
