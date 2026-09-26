'use client';

import {useState} from 'react';
import {FileText, Sparkles} from 'lucide-react';
import {requestAI} from '@/lib/ai-client';
import {habitTemplate, localDate, type Habit, type RoutineState} from '@/lib/routine';
import type {SkillTrack} from '@/lib/ascension-index';

type Draft = {name:string;kind:'habit'|'training'|'exam';date:string;frequency:Habit['frequency'];days:number[];times:number;target:number;unit:string;minutes:number;notes:string;skill:string;selected:boolean};
type Suggestions = {summary:string;items:Omit<Draft,'selected'>[]};

async function documentText(file:File):Promise<string> {
  if(file.size>20*1024*1024) throw new Error('O documento precisa ter até 20 MB.');
  if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url).toString();
    const document=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const pages:string[]=[];
    for(let pageNumber=1;pageNumber<=Math.min(document.numPages,60);pageNumber++){
      const page=await document.getPage(pageNumber);
      const content=await page.getTextContent();
      pages.push(content.items.map(item=>'str' in item?item.str:'').join(' '));
      page.cleanup();
    }
    await document.destroy();
    return pages.join('\n').slice(0,60000);
  }
  if(file.name.toLowerCase().endsWith('.docx')) {
    const JSZip=(await import('jszip')).default;
    const archive=await JSZip.loadAsync(await file.arrayBuffer());
    const xml=await archive.file('word/document.xml')?.async('string');
    if(!xml) throw new Error('Não foi possível ler o DOCX.');
    const document=new DOMParser().parseFromString(xml,'application/xml');
    return Array.from(document.getElementsByTagName('w:p')).map(paragraph=>paragraph.textContent?.trim()||'').filter(Boolean).join('\n').slice(0,60000);
  }
  if(file.type.startsWith('text/')||/\.(txt|md|csv)$/i.test(file.name)) return (await file.text()).slice(0,60000);
  throw new Error('Use um arquivo PDF, DOCX, TXT, MD ou CSV.');
}

export function RoutineAssistant({state,onChange,tracks}:{state:RoutineState;onChange:(next:RoutineState)=>void;tracks:SkillTrack[]}) {
  const [content,setContent]=useState('');
  const [source,setSource]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [summary,setSummary]=useState('');
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const patch=(index:number,change:Partial<Draft>)=>setDrafts(items=>items.map((item,i)=>i===index?{...item,...change}:item));
  const analyze=async()=>{
    if(content.trim().length<30){setError('Adicione um texto com detalhes suficientes.');return;}
    setBusy(true);setError('');setDrafts([]);
    try {
      const data=await requestAI<Suggestions>('/api/routine/suggest',{content,today:localDate(),skills:tracks.filter(track=>!track.archived).map(track=>track.name)});
      setSummary(data.summary);setDrafts(data.items.map(item=>({...item,selected:true})));
    } catch(cause) {setError(cause instanceof Error?cause.message:'Não foi possível analisar o material.');}
    finally {setBusy(false);}
  };
  const save=()=>{
    const today=localDate();
    if(drafts.some(item=>item.selected&&item.frequency==='once'&&!item.date)){setError('Informe a data das provas e atividades de dia específico antes de salvar.');return;}
    if(drafts.some(item=>item.selected&&(!Number.isFinite(item.target)||item.target<=0||!Number.isFinite(item.minutes)||item.minutes<1))){setError('Confira a quantidade e a duração das atividades selecionadas.');return;}
    const additions=drafts.filter(item=>item.selected&&item.name.trim()).map(item=>{
      const date=item.date||today;
      return {...habitTemplate(item.name.trim(),today),kind:item.kind,date,created:item.frequency==='once'?date:today,frequency:item.frequency,days:item.frequency==='days'&&item.days.length?item.days:[1,2,3,4,5],times:item.times,target:item.target,unit:item.unit||'vez',minutes:item.minutes,notes:item.notes,physical:item.kind==='training',skillId:tracks.find(track=>track.name.toLocaleLowerCase('pt-BR')===item.skill.toLocaleLowerCase('pt-BR'))?.id||''} satisfies Habit;
    });
    if(!additions.length){setError('Selecione ao menos uma sugestão.');return;}
    onChange({...state,habits:[...state.habits,...additions]});setDrafts([]);setSummary('');setError(`${additions.length} atividade(s) incluída(s) na rotina.`);
  };
  return <div className="routine-assistant">
    <div className="routine-assistant-intro"><Sparkles size={22}/><div><strong>Planejar com IA</strong><p>Cole um cronograma ou envie um documento. Revise cada sugestão antes de adicioná-la.</p></div></div>
    <label>Texto ou cronograma<textarea rows={6} maxLength={60000} value={content} onChange={event=>setContent(event.target.value)} placeholder="Ex.: Prova de matemática em 18/10. Estudar 40 min por dia. Treino de força segunda, quarta e sexta, 4 séries por exercício..." /></label>
    <label className="routine-file"><FileText size={18}/> {source||'Adicionar PDF, DOCX, TXT, MD ou CSV'}<input type="file" accept=".pdf,.docx,.txt,.md,.csv,application/pdf,text/plain" onChange={async event=>{const file=event.target.files?.[0];if(!file)return;setError('');try {setContent(await documentText(file));setSource(file.name);}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível ler o documento.');}}}/></label>
    <button className="routine-primary" disabled={busy||content.trim().length<30} onClick={analyze}>{busy?'Analisando material…':'Analisar e sugerir'}</button>
    {error&&<p role="status" className="routine-status">{error}</p>}
    {drafts.length>0&&<div className="routine-proposals"><h3>Revise as sugestões</h3><p>{summary}</p>{drafts.map((item,index)=><article key={`${index}-${item.name}`}><label className="routine-check"><input type="checkbox" checked={item.selected} onChange={event=>patch(index,{selected:event.target.checked})}/> Incluir esta atividade</label><div className="routine-fields"><label>Nome<input value={item.name} maxLength={120} onChange={event=>patch(index,{name:event.target.value})}/></label><label>Tipo<select value={item.kind} onChange={event=>patch(index,{kind:event.target.value as Draft['kind']})}><option value="habit">Hábito</option><option value="training">Treino</option><option value="exam">Prova</option></select></label><label>Data {item.frequency==='once'?'(obrigatória)':'(opcional)'}<input type="date" value={item.date} onChange={event=>patch(index,{date:event.target.value})}/></label><label>Frequência<select value={item.frequency} onChange={event=>patch(index,{frequency:event.target.value as Draft['frequency']})}><option value="once">Data específica</option><option value="daily">Diária</option><option value="days">Dias da semana</option><option value="weekly">Vezes por semana</option><option value="monthly">Vezes por mês</option></select></label><label>Quantidade<input type="number" min="0.1" step="any" value={item.target} onChange={event=>patch(index,{target:Number(event.target.value)})}/></label><label>Unidade<input value={item.unit} onChange={event=>patch(index,{unit:event.target.value})}/></label><label>Duração (min)<input type="number" min="1" value={item.minutes} onChange={event=>patch(index,{minutes:Number(event.target.value)})}/></label><label>Habilidade<input value={item.skill} onChange={event=>patch(index,{skill:event.target.value})}/></label></div>{item.frequency==='days'&&<div className="routine-chips">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((day,i)=><button key={day} aria-pressed={item.days.includes(i)} onClick={()=>patch(index,{days:item.days.includes(i)?item.days.filter(value=>value!==i):[...item.days,i]})}>{day}</button>)}</div>}<label>Detalhes e origem<textarea rows={2} value={item.notes} onChange={event=>patch(index,{notes:event.target.value})}/></label></article>)}<button className="routine-primary" onClick={save}>Adicionar selecionadas à rotina</button></div>}
  </div>;
}
