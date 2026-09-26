export const widgetCatalog = [
  {id:'continue', label:'Continuar', description:'Retome sua trilha mais recente.'},
  {id:'today', label:'Hoje e metas', description:'Agenda, hábitos e metas da semana.'},
  {id:'evolution', label:'Evolução', description:'Nível, ranking, XP e sequência.'},
  {id:'focus', label:'Sessão de foco', description:'Cronômetro de estudo na página inicial.'},
  {id:'shortcuts', label:'Acessos rápidos', description:'Atalhos para as áreas principais.'},
] as const;
export type HomeWidgetId = typeof widgetCatalog[number]['id'];

export const platformPalettes = [
  {id:'neon',label:'Verde original',accent:'#caff55',accent2:'#765ee8',base:'#08090b',surface:'#101216'},
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
export type PlatformFont = 'geist'|'system'|'editorial'|'mono';
export type PlatformTypeScale = 'compact'|'normal'|'large';
export type PlatformPreferences = {palette:PlatformPaletteId; customAccent:string; customSecondary:string; customBackground:string; customSurface:string; customText:string; customTextSecondary:string; customTextTertiary:string; widgets:HomeWidgetId[]; density:PlatformDensity; radius:PlatformRadius; effects:PlatformEffects; mode:PlatformMode; font:PlatformFont; typeScale:PlatformTypeScale};
export const defaultPlatformPreferences: PlatformPreferences = {palette:'neon',customAccent:'',customSecondary:'',customBackground:'',customSurface:'',customText:'',customTextSecondary:'',customTextTertiary:'',widgets:['continue','today','evolution','shortcuts'],density:'comfortable',radius:'rounded',effects:'minimal',mode:'dark',font:'geist',typeScale:'normal'};

const hex=/^#[0-9a-f]{6}$/i;
export function normalizePlatformPreferences(value: unknown): PlatformPreferences {
  if(!value || typeof value !== 'object') return {...defaultPlatformPreferences,widgets:[...defaultPlatformPreferences.widgets]};
  const raw=value as Partial<PlatformPreferences>;
  const palette=platformPalettes.some(item=>item.id===raw.palette)?raw.palette as PlatformPaletteId:'neon';
  const valid=new Set(widgetCatalog.map(item=>item.id));
  const widgets=Array.isArray(raw.widgets)?raw.widgets.filter((id,index,all):id is HomeWidgetId=>typeof id==='string'&&valid.has(id as HomeWidgetId)&&all.indexOf(id)===index):defaultPlatformPreferences.widgets;
  const density:PlatformDensity=raw.density==='compact'?'compact':'comfortable';
  const radius:PlatformRadius=raw.radius==='sharp'||raw.radius==='soft'?raw.radius:'rounded';
  const effects:PlatformEffects=raw.effects==='ambient'?'ambient':'minimal';
  const mode:PlatformMode=raw.mode==='light'?'light':'dark';
  const font:PlatformFont=raw.font==='system'||raw.font==='editorial'||raw.font==='mono'?raw.font:'geist';
  const typeScale:PlatformTypeScale=raw.typeScale==='compact'||raw.typeScale==='large'?raw.typeScale:'normal';
  const color = (value: unknown) => typeof value==='string'&&hex.test(value)?value:'';
  return {palette,customAccent:color(raw.customAccent),customSecondary:color(raw.customSecondary),customBackground:color(raw.customBackground),customSurface:color(raw.customSurface),customText:color(raw.customText),customTextSecondary:color(raw.customTextSecondary),customTextTertiary:color(raw.customTextTertiary),widgets:[...widgets],density,radius,effects,mode,font,typeScale};
}

export function moveWidget(widgets: HomeWidgetId[], id: HomeWidgetId, direction: -1|1) {
  const index=widgets.indexOf(id),next=index+direction;if(index<0||next<0||next>=widgets.length)return widgets;
  const result=[...widgets];[result[index],result[next]]=[result[next],result[index]];return result;
}
