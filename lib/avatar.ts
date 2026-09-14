export const avatarHairStyles = ['social','moderno','bagunçado','ondulado','heroico','longo','raspado'] as const;
export const avatarBeardStyles = ['sem barba','barba curta','barba marcada','cavanhaque'] as const;
export type Appearance = {
 skin: string;
 hairColor: string;
 eyeColor?: string;
 hair: typeof avatarHairStyles[number] | 'curto';
 face?: 'oval'|'angular'|'arredondado';
 beard: boolean;
 beardStyle?: typeof avatarBeardStyles[number];
 shape: 'masculino'|'feminino'|'neutro';
 height: number;
 weight: number;
 fat: number;
 muscle: number;
};
export const initialAppearance: Appearance = { skin:'#b8896a', hairColor:'#191b24', eyeColor:'#647d91', hair:'moderno', face:'angular', beard:false, beardStyle:'sem barba', shape:'neutro', height:175, weight:75, fat:24, muscle:45 };
export type AvatarItem = { id:string; name:string; slot:string; rarity:string; price:number; days:number; color:string };
export const avatarItems: AvatarItem[] = [
 {id:'base',name:'Traje essencial',slot:'tronco',rarity:'Comum',price:0,days:0,color:'#45505e'},
 {id:'shoes',name:'Passo firme',slot:'calçados',rarity:'Comum',price:40,days:7,color:'#849294'},
 {id:'wrist',name:'Relógio de campo',slot:'mão',rarity:'Incomum',price:100,days:21,color:'#9fa9b6'},
 {id:'head',name:'Faixa do atleta',slot:'cabeça',rarity:'Raro',price:250,days:60,color:'#799eaf'},
 {id:'frame',name:'Moldura de conquista',slot:'moldura',rarity:'Épico',price:600,days:100,color:'#a18cbe'},
 {id:'title',name:'Discípulo da Disciplina',slot:'título',rarity:'Raro',price:250,days:100,color:'#bdd087'},
 {id:'slate',name:'Jaqueta grafite',slot:'tronco',rarity:'Comum',price:40,days:7,color:'#293344'},
 {id:'sage',name:'Traje do estudioso',slot:'tronco',rarity:'Incomum',price:100,days:30,color:'#475d58'},
 {id:'athlete',name:'Atleta ascendente',slot:'tronco',rarity:'Raro',price:250,days:60,color:'#264c6b'},
 {id:'command',name:'Manto de comando',slot:'tronco',rarity:'Épico',price:600,days:100,color:'#534969'},
 {id:'gold',name:'Selo da constância',slot:'insígnia',rarity:'Lendário',price:1500,days:180,color:'#d1ad62'},
 {id:'aura',name:'Presença mítica',slot:'aura',rarity:'Mítico',price:3000,days:365,color:'#9388e8'},
 {id:'apex',name:'Horizonte transcendente',slot:'aura',rarity:'Transcendente',price:5000,days:730,color:'#bce7ee'},
];
export type AvatarAccount = { evidence?:AvatarEvidence; appearance:Appearance; balance:number; inventory:string[]; equipped:Record<string,string>; days:string[]; claimed:number[]; created:string; history:{at:string; appearance:Appearance}[]; transactions:{id:string; at:string; amount:number; label:string}[] };
export function newAvatar(now:string):AvatarAccount { return {appearance:{...initialAppearance},balance:0,inventory:['base'],equipped:{tronco:'base'},days:[],claimed:[],created:now,history:[],transactions:[]}; }
export function validateAppearance(value:unknown):Appearance {
 if(!value || typeof value!=='object') throw new AvatarInputError('Informe as características do avatar.');
 const a=value as Appearance;
 const validHair = [...avatarHairStyles, 'curto'].includes(a.hair);
 const validBeardStyle = a.beardStyle === undefined || avatarBeardStyles.includes(a.beardStyle);
 if(!/^#[0-9a-f]{6}$/i.test(a.skin)||!/^#[0-9a-f]{6}$/i.test(a.hairColor)||!validHair||!validBeardStyle||!['masculino','feminino','neutro'].includes(a.shape)||typeof a.beard!=='boolean') throw new AvatarInputError('Aparência inválida.');
 if(a.eyeColor !== undefined && !/^#[0-9a-f]{6}$/i.test(a.eyeColor)) throw new AvatarInputError('Cor dos olhos inválida.');
 for(const [key,min,max] of [['height',100,230],['weight',30,300],['fat',3,65],['muscle',0,100]] as const) if(!Number.isFinite(a[key])||a[key]<min||a[key]>max) throw new AvatarInputError(`Valor inválido: ${key}.`);
 if(a.face!==undefined&&!['oval','angular','arredondado'].includes(a.face))throw new AvatarInputError('Formato de rosto inválido.');
 return {...(a.face?{face:a.face}:{}),skin:a.skin,hairColor:a.hairColor,...(a.eyeColor?{eyeColor:a.eyeColor}:{}),hair:a.hair,beard:a.beard,...(a.beardStyle?{beardStyle:a.beardStyle}:{}),shape:a.shape,height:a.height,weight:a.weight,fat:a.fat,muscle:a.muscle};
}
export function purchase(account:AvatarAccount,id:string,now:string) {
 const item=avatarItems.find(i=>i.id===id); if(!item) throw new AvatarInputError('Item inexistente.');
 if(account.inventory.includes(id)) throw new AvatarInputError('Você já possui este item.');
 if(account.days.length<item.days) throw new AvatarInputError(`Requer ${item.days} dias de atividade observados.`);
 if(['gold','aura','apex'].includes(id)&&((account.evidence?.studyDays.length||0)<30||(account.evidence?.physicalDays.length||0)<30)) throw new AvatarInputError('Requer 30 dias de estudo com domínio e 30 dias de resultados físicos observados.');
 if(account.balance<item.price) throw new AvatarInputError('Essência insuficiente.');
 account.balance-=item.price; account.inventory.push(id); account.transactions.push({id:`buy:${id}`,at:now,amount:-item.price,label:item.name});
}
// One server-observed day cannot be earned again by editing or replaying a request.
export function observeDay(account:AvatarAccount,date:string,active:boolean) {
 if(!active||account.days.includes(date)) return;
 account.days.push(date);
 // Milestones grow more slowly than activity. No currency for opening the app.
 const count=account.days.length;
 const milestones=[7,21,30,60,100,180,365,730];
 for(const threshold of milestones) if(count>=threshold&&!account.claimed.includes(threshold)) {
  const amount=threshold===7?10:threshold<=30?20:threshold<=100?50:100;
  account.claimed.push(threshold);account.balance+=amount;
  account.transactions.push({id:`days:${threshold}`,at:date,amount,label:`${threshold} dias ativos observados`});
 }
 // Sustainable long-term supply, capped at one 30-day milestone per observed block.
 if(count>30&&count%30===0&&!account.claimed.includes(10000+count)) {account.claimed.push(10000+count);account.balance+=40;account.transactions.push({id:`cycle:${count}`,at:date,amount:40,label:'Ciclo de 30 dias ativos'});}
}

export class AvatarInputError extends Error {}
export function parseAvatarDescription(text:string,current:Appearance):{appearance:Appearance;matched:string[]} {
 const draft={...current}; const matched:string[]=[]; const s=text.toLocaleLowerCase('pt-BR');
 const set=<K extends keyof Appearance>(key:K,value:Appearance[K])=>{draft[key]=value;matched.push(key);};
 const weight=s.match(/(\d{2,3}(?:[.,]\d+)?)\s*kg/);if(weight)set('weight',Number(weight[1].replace(',','.')));
 const cm=s.match(/(\d{3})\s*cm/);const meters=s.match(/([12][.,]\d{1,2})\s*m\b/);
 if(cm)set('height',Number(cm[1]));else if(meters)set('height',Math.round(Number(meters[1].replace(',','.'))*100));
 const fat=s.match(/(\d{1,2}(?:[.,]\d+)?)\s*%\s*(?:de\s*)?gordura/);if(fat)set('fat',Number(fat[1].replace(',','.')));
 if(/\b(homem|masculino)\b/.test(s))set('shape','masculino');else if(/\b(mulher|feminino)\b/.test(s))set('shape','feminino');
 if(/cabelo[^,.]*(bagunçado|despojado)/.test(s))set('hair','bagunçado');
 else if(/cabelo[^,.]*(ondulado|cacheado)/.test(s))set('hair','ondulado');
 else if(/cabelo[^,.]*(social|elegante)/.test(s))set('hair','social');
 else if(/cabelo[^,.]*(heroico|espetado)/.test(s))set('hair','heroico');
 else if(/cabelo\s+(?:curto|curtos|moderno)/.test(s))set('hair','moderno');
 else if(/cabelo\s+(?:longo|comprido)/.test(s))set('hair','longo');
 else if(/raspado|careca/.test(s))set('hair','raspado');
 if(/sem barba/.test(s)){set('beard',false);set('beardStyle','sem barba');}
 else if(/cavanhaque/.test(s)){set('beard',true);set('beardStyle','cavanhaque');}
 else if(/barba[^,.]*(marcada|cheia)/.test(s)){set('beard',true);set('beardStyle','barba marcada');}
 else if(/\bbarba\b/.test(s)){set('beard',true);set('beardStyle','barba curta');}
 if(/cabelo[^,.]*\b(escuro|preto)\b/.test(s))set('hairColor','#292323');else if(/\b(loiro|louro)\b/.test(s))set('hairColor','#bda475');else if(/\bruivo\b/.test(s))set('hairColor','#8d4530');
 return {appearance:validateAppearance(draft),matched};
}
export type AvatarSummary={archetypes:string[];skills:{name:string;level:number|null;domain:string}[];mastery:number|null;studiedConcepts:number};
export type AvatarEvidence={fingerprint?:string;studyDays:string[];physicalDays:string[];lastSync:string;summary:AvatarSummary};
export const emptyAvatarEvidence=():AvatarEvidence=>({studyDays:[],physicalDays:[],lastSync:'',summary:{archetypes:[],skills:[],mastery:null,studiedConcepts:0}});

export function avatarDay(iso:string){return /^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));}
