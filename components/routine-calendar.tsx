'use client';
import {useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {complete,due,entryFor,localDate,type RoutineState} from '@/lib/routine';

export function RoutineCalendar({state,onDay}:{state:RoutineState;onDay:(date:string)=>void}) {
  const [month,setMonth]=useState(localDate().slice(0,7));
  const [year,number]=month.split('-').map(Number);
  const first=new Date(year,number-1,1);
  const count=new Date(year,number,0).getDate();
  const blanks=Array.from({length:first.getDay()},(_,index)=>index);
  const days=Array.from({length:count},(_,index)=>`${month}-${String(index+1).padStart(2,'0')}`);
  const move=(delta:number)=>{const next=new Date(year,number-1+delta,1);setMonth(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`);};
  return <div className="routine-calendar"><header><button aria-label="Mês anterior" onClick={()=>move(-1)}><ChevronLeft/></button><h3>{first.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h3><button aria-label="Próximo mês" onClick={()=>move(1)}><ChevronRight/></button></header><div className="routine-calendar-grid">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(label=><span className="routine-calendar-weekday" key={label}>{label}</span>)}{blanks.map(blank=><span key={`blank-${blank}`}/>)}{days.map(date=>{const habits=state.habits.filter(h=>due(h,date,state));const done=habits.filter(h=>complete(entryFor(state,h.id,date))).length;const exams=habits.filter(h=>h.kind==='exam');const training=habits.filter(h=>h.kind==='training');return <button key={date} className={date===localDate()?'today':''} onClick={()=>onDay(date)} aria-label={`${new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')}: ${habits.length} atividades, ${done} concluídas`}><strong>{Number(date.slice(-2))}</strong><small>{habits.length?`${done}/${habits.length}`:''}</small><span>{exams.length?'Prova ':''}{training.length?'Treino':''}</span></button>;})}</div><p className="routine-muted">Toque em um dia para ver os hábitos, treinos e provas previstos.</p></div>;
}
