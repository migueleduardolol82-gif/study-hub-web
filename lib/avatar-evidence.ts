import { avatarDay, emptyAvatarEvidence, observeDay, type AvatarAccount } from './avatar.ts';
import { skillSummary, type SkillTrack } from './ascension-index.ts';
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
export function syncAvatarEvidence(account:AvatarAccount,source:unknown,now:string) {
 const state=record(source);const today=avatarDay(now);const start=avatarDay(account.created);
 const evidence=account.evidence??emptyAvatarEvidence();account.evidence=evidence;
 const habits=list(record(state.routine).entries).map(record);
 const routine=habits.some(e=>e.date===today&&typeof e.target==='number'&&e.target>0&&typeof e.value==='number'&&e.value>=e.target);
 const progress=Object.values(record(state.learningProgress)).map(record);
 const attempts=progress.flatMap(p=>[...list(p.reviewHistory),...list(record(p.reviewSession).answers)]).map(record);
 const answered=[...new Map(attempts.filter(a=>typeof a.answeredAt==='string'&&Number.isFinite(Date.parse(a.answeredAt))&&avatarDay(a.answeredAt)===today&&Date.parse(a.answeredAt as string)<=Date.parse(now)&&typeof a.selected==='string'&&a.selected.trim()).map(a=>[String(a.id||`${a.exerciseId}:${a.answeredAt}`),a])).values()];
 const masteryAttempts=[...new Map(answered.filter(a=>a.mode==='dominio').map(a=>[String(a.exerciseId),a])).values()];
 const mastered=masteryAttempts.length>=10&&masteryAttempts.filter(a=>record(a.grade).correct===true).length/masteryAttempts.length>=.8;
 const tracks=list(state.skillTracks).map(record).filter(t=>typeof t.id==='string'&&typeof t.name==='string'&&typeof t.domain==='string'&&['lower','higher'].includes(String(t.direction))&&typeof t.baseline==='number'&&typeof t.target==='number'&&Array.isArray(t.evidence)).map(t=>({...t,evidence:list(t.evidence).map(record).filter(e=>typeof e.id==='string'&&typeof e.date==='string'&&typeof e.value==='number')})) as unknown as SkillTrack[];
 const physical=tracks.filter(t=>t.domain==='Corpo'&&!t.archived).some(t=>{
  const values=t.evidence.filter(e=>e.date.slice(0,10)>=start&&Date.parse(e.date)<=Date.parse(now)).sort((a,b)=>a.date.localeCompare(b.date));
  const latest=values.at(-1),first=values[0];
  return latest&&first&&latest.date.slice(0,10)===today&&Date.parse(latest.date)-Date.parse(first.date)>=14*86400000&&(t.direction==='higher'?latest.value>first.value:latest.value<first.value);
 });
 if(mastered&&!evidence.studyDays.includes(today))evidence.studyDays.push(today);
 if(physical&&!evidence.physicalDays.includes(today))evidence.physicalDays.push(today);
 observeDay(account,today,routine||answered.length>=5||Boolean(physical));
 const masters=progress.flatMap(p=>Object.values(record(p.conceptMastery))).map(record).filter(c=>typeof c.answered==='number'&&c.answered>0);
 evidence.summary={archetypes:[state.primaryArchetypeId,state.secondaryArchetypeId,state.tertiaryArchetypeId].filter((x):x is string=>typeof x==='string'&&x.length>0).slice(0,3),skills:tracks.filter(t=>!t.archived).slice(0,20).map(t=>({name:t.name.slice(0,100),domain:t.domain,level:skillSummary(t,Date.parse(now)).level})),mastery:masters.length?Math.round(masters.reduce((sum,c)=>sum+(typeof c.mastery==='number'?Math.max(0,Math.min(100,c.mastery)):0),0)/masters.length):null,studiedConcepts:masters.length};
 for(const [kind,count] of [['study',evidence.studyDays.length],['physical',evidence.physicalDays.length]] as const) {
  for(const threshold of [7,30,100]) {
   const id=`${kind}:${threshold}`;
   if(count>=threshold&&!account.transactions.some(t=>t.id===id)){const amount=threshold===7?30:threshold===30?100:200;account.balance+=amount;account.transactions.push({id,at:now,amount,label:`${threshold} dias de ${kind==='study'?'domínio demonstrado':'resultado físico'}`});}
  }
 }
 evidence.lastSync=now;
}
