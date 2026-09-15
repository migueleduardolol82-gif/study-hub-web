import test from 'node:test';
import assert from 'node:assert/strict';
import { newAvatar, observeDay, purchase, setAvatarItemColor, validateAppearance, initialAppearance, parseAvatarDescription, avatarDay } from '../lib/avatar.ts';
import { syncAvatarEvidence } from '../lib/avatar-evidence.ts';
const at='2026-09-14T15:00:00.000Z';
test('appearance rejects nonfinite values, invalid colors and retains only permitted fields',()=>{
 assert.throws(()=>validateAppearance({...initialAppearance,weight:NaN}));assert.throws(()=>validateAppearance({...initialAppearance,skin:'url(x)'}));
 assert.deepEqual(validateAppearance({...initialAppearance,balance:999999}),initialAppearance);
});
test('text parser uses explicit measurements, not guessed body composition',()=>{
 const result=parseAvatarDescription('homem, 1,80 m, 92 kg, cabelo curto escuro, pouca barba, corpo forte com gordura moderada',initialAppearance);
 assert.equal(result.appearance.height,180);assert.equal(result.appearance.weight,92);assert.equal(result.appearance.beard,true);assert.equal(result.appearance.fat,initialAppearance.fat);assert.equal(result.appearance.muscle,initialAppearance.muscle);
});
test('anime appearance keeps premium hair, beard and eye options compatible',()=>{
 const parsed=parseAvatarDescription('homem, cabelo heroico escuro e cavanhaque',initialAppearance);
 assert.equal(parsed.appearance.hair,'heroico');assert.equal(parsed.appearance.beardStyle,'cavanhaque');
 assert.deepEqual(validateAppearance({...parsed.appearance,eyeColor:'#68a4c8'}),{...parsed.appearance,eyeColor:'#68a4c8'});
 assert.throws(()=>validateAppearance({...parsed.appearance,hair:'fantasia'}));
});
test('opening app and replaying a daily observation cannot farm currency',()=>{
 const a=newAvatar(at);observeDay(a,'2026-09-14',false);assert.equal(a.days.length,0);
 for(let n=1;n<=7;n++)observeDay(a,`2026-09-${String(n+13).padStart(2,'0')}`,true);
 assert.equal(a.balance,10);for(let n=0;n<50;n++)observeDay(a,'2026-09-20',true);assert.equal(a.balance,10);assert.equal(a.transactions.length,1);
});
test('purchases reject insufficient balance, unmet gates and repeated purchase without changing wallet',()=>{
 const a=newAvatar(at);a.balance=10000;assert.throws(()=>purchase(a,'gold',at));assert.equal(a.balance,10000);
 a.days=Array.from({length:7},(_,i)=>String(i));purchase(a,'slate',at);assert.equal(a.balance,9960);assert.throws(()=>purchase(a,'slate',at));assert.equal(a.balance,9960);
 a.balance=0;assert.throws(()=>purchase(a,'sage',at));assert.equal(a.balance,0);
});
test('unknown item cannot be bought and legendary needs domain evidence',()=>{
 const a=newAvatar(at);a.balance=10000;a.days=Array.from({length:730},(_,i)=>String(i));assert.throws(()=>purchase(a,'unknown',at));assert.throws(()=>purchase(a,'gold',at));assert.equal(a.inventory.length,4);
});
test('common equipment starts owned and only owned items accept safe color overrides',()=>{
 const a=newAvatar(at);assert.deepEqual(a.inventory,['base','starter-boots','starter-bracer','starter-band']);assert.equal(a.equipped.calçados,'starter-boots');
 setAvatarItemColor(a,'base','#58664D');assert.equal(a.itemColors?.base,'#58664d');
 assert.throws(()=>setAvatarItemColor(a,'slate','#ffffff'));assert.throws(()=>setAvatarItemColor(a,'base','url(x)'));
});
test('only answered questions count; domain evidence requires 10 distinct questions and 80% correct',()=>{
 const a=newAvatar(at);const make=(i:number,correct=true)=>({id:String(i),exerciseId:String(i),answeredAt:at,mode:'dominio',selected:'conceito',grade:{correct}});
 syncAvatarEvidence(a,{learningProgress:{p:{reviewHistory:[make(1),make(1)]}}},at);assert.equal(a.evidence?.studyDays.length,0);assert.equal(a.days.length,0);
 syncAvatarEvidence(a,{learningProgress:{p:{reviewHistory:Array.from({length:10},(_,i)=>make(i,i<8))}}},at);assert.equal(a.evidence?.studyDays.length,1);assert.equal(a.days.length,1);
 syncAvatarEvidence(a,{learningProgress:{p:{reviewHistory:Array.from({length:10},(_,i)=>make(i,i<8))}}},at);assert.equal(a.evidence?.studyDays.length,1);
});
test('old activity cannot backfill observed days; local Brazilian day remains stable after UTC midnight',()=>{
 const a=newAvatar(at);syncAvatarEvidence(a,{routine:{entries:[{date:'2026-09-13',target:1,value:1}]}},at);assert.equal(a.days.length,0);
 assert.equal(avatarDay('2026-09-15T01:00:00Z'),'2026-09-14');
});
test('physical rewards require improvement over separated records after avatar enrollment',()=>{
 const a=newAvatar('2026-09-01T12:00:00Z');
 const track={id:'r',name:'5 km',domain:'Corpo',direction:'lower',baseline:40,target:25,evidence:[{id:'1',value:40,date:'2026-09-01'},{id:'2',value:35,date:'2026-09-16'}]};
 syncAvatarEvidence(a,{skillTracks:[track]},'2026-09-16T12:00:00Z');assert.equal(a.evidence?.physicalDays.length,1);assert.equal(a.appearance.weight,75);
 const b=newAvatar('2026-09-16T12:00:00Z');syncAvatarEvidence(b,{skillTracks:[track]},'2026-09-16T12:00:00Z');assert.equal(b.evidence?.physicalDays.length,0);
});
