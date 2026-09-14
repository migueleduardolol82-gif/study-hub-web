import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyActionsForDay, type JourneyRecord} from '../lib/journeys.ts';
const journey=(status:JourneyRecord['status']):JourneyRecord=>({id:status,name:status,category:'Leitura',icon:'',color:'#000',objective:'',status,startDate:'2026-09-01',metricName:'Páginas',metricUnit:'páginas',target:100,current:0,activities:[{id:'late',title:'Atrasada',date:'2026-09-13',minutes:30,done:false},{id:'today',title:'Hoje',date:'2026-09-14',minutes:30,done:false},{id:'next',title:'Amanhã',date:'2026-09-15',minutes:30,done:false},{id:'done',title:'Concluída',date:'2026-09-14',minutes:30,done:true}],sourceMapIds:[],sourceThemeIds:[],createdAt:'',updatedAt:''});
test('today excludes paused, archived, completed journeys and future actions',()=>{
 const rows=journeyActionsForDay(['active','paused','completed','archived'].map(s=>journey(s as JourneyRecord['status'])),'2026-09-14');assert.deepEqual(rows.map(r=>[r.journey.id,r.activity.id]),[['active','late'],['active','today']]);
});
test('completed actions remain available for reopening without mutating source data',()=>{const source=[journey('active')],before=JSON.stringify(source);assert.deepEqual(journeyActionsForDay(source,'2026-09-14',true).map(r=>r.activity.id),['done']);assert.equal(JSON.stringify(source),before);});
