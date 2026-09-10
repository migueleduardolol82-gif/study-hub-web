import assert from "node:assert/strict";
import test from "node:test";
import { personalLevel, skillSummary, overallIndex, consistencyScore, recentRank, type SkillTrack } from "../lib/ascension-index.ts";
const now=Date.parse("2026-09-10T12:00:00Z");
const base: SkillTrack={id:"1",name:"Teste",domain:"Corpo",unit:"min",context:"protocolo",journeyId:"",mission:"",weeklyDays:3,baseline:40,target:12,direction:"lower",referenceUrl:"",referenceDate:"",evidence:[],archived:false};
test("ausência de resultado não vira nível zero ou iniciante fictício",()=>{
  assert.equal(skillSummary(base,now).level,null);
  assert.equal(overallIndex([base],100,now),null);
});
test("métrica menor é melhor tem curva crescente e respeita extremos",()=>{
  assert.equal(personalLevel(base,40),1);
  assert.equal(personalLevel(base,12),150);
  assert.equal(personalLevel(base,8),150);
  assert.ok(personalLevel(base,20)!>personalLevel(base,30)!);
  assert.equal(personalLevel({...base,target:50},30),null);
  assert.equal(personalLevel({...base,target:40},30),null);
});
test("métrica maior é melhor, NaN e infinidade são tratados",()=>{
  const track={...base,direction:"higher" as const,baseline:0,target:100};
  assert.equal(personalLevel(track,100),150);
  assert.equal(personalLevel(track,Number.NaN),null);
  assert.equal(personalLevel(track,Infinity),null);
});
test("inatividade retira avaliação recente sem apagar recorde ou evidência",()=>{
  const track={...base,evidence:[{id:"a",value:20,date:"2026-01-01",note:"",source:""}]};
  const before=JSON.stringify(track);
  const result=skillSummary(track,now);
  assert.ok(result.level!>1);
  assert.equal(result.recentLevel,null);
  assert.equal(recentRank(result.recentLevel),"Sem avaliação recente");
  assert.equal(JSON.stringify(track),before);
});
test("data futura e resultado inválido não influenciam capacidade",()=>{
  const track={...base,evidence:[{id:"a",value:12,date:"2027-01-01",note:"",source:""},{id:"b",value:NaN,date:"2026-09-01",note:"",source:""}]};
  assert.equal(skillSummary(track,now).level,null);
});
test("repetir lançamentos no mesmo dia não infla consistência",()=>{
  assert.equal(consistencyScore(Array(100).fill("2026-09-09"),1,now),25);
  assert.equal(consistencyScore(["2027-01-01"],1,now),0);
});
test("várias habilidades da mesma área não fabricam amplitude geral",()=>{
  const track={...base,evidence:[{id:"a",value:12,date:"2026-09-01",note:"",source:""}]};
  assert.equal(overallIndex([track,{...track,id:"2"},{...track,id:"3"}],100,now),null);
  assert.equal(overallIndex([track,{...track,id:"2",domain:"Intelecto"},{...track,id:"3",domain:"Carreira"}],100,now),150);
});
