"use client";

import { useState, type FormEvent } from "react";
import { domains, skillSummary, recentRank, bandForLevel, consistencyScore, overallIndex, suggestedClass, type SkillTrack } from "@/lib/ascension-index";
import type { JourneyRecord } from "@/lib/journeys";

type Props = { tracks: SkillTrack[]; onChange: (tracks: SkillTrack[]) => void; journeys: JourneyRecord[]; xp: number; compact?: boolean };
export function AscensionIndex({ tracks, onChange, journeys, xp, compact = false }: Props) {
  const [editing, setEditing] = useState<SkillTrack | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const active = tracks.filter(t=>!t.archived);
  const dates = journeys.filter(j=>active.some(t=>t.journeyId===j.id)).flatMap(j=>j.activities.filter(a=>a.done).map(a=>a.date));
  const consistency = consistencyScore(dates, active.length ? Math.max(...active.map(t=>t.weeklyDays)) : 1);
  const general = overallIndex(active,consistency);
  function saveTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const baseline = Number(data.get("baseline")), target = Number(data.get("target"));
    const direction = data.get("direction") === "lower" ? "lower" : "higher";
    if ((direction === "lower" ? target >= baseline : target <= baseline)) { setError("A meta deve representar uma melhora em relação ao ponto inicial."); return; }
    const track: SkillTrack = { id: editing?.id ?? crypto.randomUUID(), name:String(data.get("name")).trim(), domain:String(data.get("domain")), unit:String(data.get("unit")).trim(), context:String(data.get("context")).trim(), journeyId:String(data.get("journeyId")), mission:String(data.get("mission")).trim(), weeklyDays:Number(data.get("weeklyDays")), baseline,target,direction,referenceUrl:String(data.get("referenceUrl")).trim(),referenceDate:new Date().toISOString(),evidence:editing?.evidence ?? [],archived:false };
    onChange(editing?.id ? tracks.map(t=>t.id===editing.id?track:t) : [...tracks,track]);
    setEditing(null);setError("");
  }
  function saveResult(event: FormEvent<HTMLFormElement>, track: SkillTrack) {
    event.preventDefault();const data = new FormData(event.currentTarget);
    const value = Number(data.get("value")),date=String(data.get("date"));
    if (!Number.isFinite(value) || value < 0 || !date || Date.parse(date)>Date.now()) { setError("Informe um resultado válido e uma data que não esteja no futuro.");return; }
    onChange(tracks.map(t=>t.id===track.id?{...t,evidence:[...t.evidence,{id:crypto.randomUUID(),value,date,note:String(data.get("note")).trim(),source:String(data.get("source")).trim()}]}:t));
    setRecording(null);setError("");
  }
  return <section className="hli panel">
    <header><span className="eyebrow">SISTEMA · EVOLUÇÃO POR RESULTADOS</span><h2>Sua vida é a medida.</h2><p>Esforço constrói história. Resultados demonstram habilidade.</p></header>
    <div className="hli-metrics"><article><small>Índice pessoal · escala 1–150</small><strong>{general ?? "—"}</strong><span>{general === null ? "Avalie pelo menos três áreas" : "Composto das áreas avaliadas"}</span></article><article><small>Classe sugerida</small><strong>{suggestedClass(active)}</strong><span>Derivada dos seus resultados pessoais</span></article><article><small>XP de esforço preservado</small><strong>{xp.toLocaleString("pt-BR")}</strong><span>Não concede habilidade ou recordes</span></article><article><small>Consistência · últimas 4 semanas</small><strong>{consistency}%</strong><span>Ações concluídas nas jornadas vinculadas</span></article></div>
    <p className="hli-method">Esta escala é <strong>pessoal e experimental</strong>: compara seus resultados com a base e a meta que você definiu. Não é um percentil mundial. Nível histórico: <strong>não avaliado</strong>, até haver referências comparáveis e evidências verificadas. Seu diagnóstico e seu histórico anteriores permanecem abaixo.</p>
    {compact ? null : <>
      <div className="hli-toolbar"><h3>Habilidades que você escolhe</h3><button className="primary-button" onClick={()=>{setEditing({id:"",name:"",domain:"Corpo",unit:"",context:"",journeyId:"",mission:"",weeklyDays:3,baseline:0,target:100,direction:"higher",referenceUrl:"",referenceDate:"",evidence:[],archived:false});setError("");}}>Adicionar habilidade</button><label><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Mostrar arquivadas</label></div>
      {error && <p role="alert">{error}</p>}
      {editing && <form className="hli-form" onSubmit={saveTrack} key={editing.id}>
        <h3>{editing.id ? "Editar habilidade" : "Nova habilidade"}</h3>
        <label>Nome<input name="name" required maxLength={100} defaultValue={editing.name} placeholder="O que você quer desenvolver?"/></label>
        <label>Área<select name="domain" defaultValue={editing.domain}>{domains.map(d=><option key={d}>{d}</option>)}</select></label>
        <label>Métrica / unidade<input name="unit" required defaultValue={editing.unit} placeholder="Minutos, pontos, kg…"/></label>
        <label>Condições de comparação<textarea name="context" required defaultValue={editing.context} placeholder="Distância, modalidade, protocolo, categoria ou critérios da avaliação"/></label>
        <label>Melhor resultado<select name="direction" defaultValue={editing.direction}><option value="higher">Quanto maior, melhor</option><option value="lower">Quanto menor, melhor</option></select></label>
        <label>Seu ponto inicial<input name="baseline" type="number" min="0" step="any" required defaultValue={editing.baseline}/></label>
        <label>Sua meta pessoal (150 nesta escala)<input name="target" type="number" min="0" step="any" required defaultValue={editing.target}/></label>
        <label>Fonte de referência opcional<input name="referenceUrl" type="url" defaultValue={editing.referenceUrl} placeholder="https://… (não equivale a validação)"/></label>
        <label>Jornada vinculada<select name="journeyId" defaultValue={editing.journeyId}><option value="">Sem vínculo</option>{journeys.map(j=><option value={j.id} key={j.id}>{j.name}</option>)}</select></label>
        <label>Missão escolhida por você<input name="mission" defaultValue={editing.mission} placeholder="Uma ação concreta para esta habilidade"/></label>
        <label>Dias por semana<input name="weeklyDays" type="number" min="1" max="7" required defaultValue={editing.weeklyDays}/></label>
        {editing.evidence.length>0 && <p>Alterar a base ou a meta recalcula o índice pessoal; os resultados registrados serão preservados.</p>}
        <div className="hli-toolbar"><button className="primary-button" type="submit">Salvar habilidade</button><button className="secondary-button" type="button" onClick={()=>setEditing(null)}>Cancelar</button></div>
      </form>}
      {!active.length && <p>Comece escolhendo uma habilidade. Nenhum esporte, profissão ou objetivo será atribuído a você automaticamente.</p>}
      <div className="hli-tracks">{tracks.filter(t=>showArchived||!t.archived).map(track=>{
        const summary=skillSummary(track);
        const journey=journeys.find(j=>j.id===track.journeyId);
        const done=journey?.activities.filter(a=>a.done&&Date.now()-Date.parse(a.date)<7*86400000&&Date.parse(a.date)<=Date.now()).length??0;
        return <article key={track.id} className="hli-skill"><span className="eyebrow">{track.domain}{track.archived?" · Arquivada":""}</span><h3>{track.name}</h3><p>{track.context}</p>
          <div className="hli-score"><strong>{summary.level??"—"}<small> / 150 pessoal</small></strong><span>{summary.level===null?"Não avaliado":bandForLevel(summary.level)}</span></div>
          <progress aria-label={`Progresso pessoal de ${track.name}`} max={150} value={summary.level??0}/>
          <p>Ranking pessoal recente: <strong>{recentRank(summary.recentLevel)}</strong></p>
          <p>Melhor resultado: <strong>{summary.best?`${summary.best.value} ${track.unit}`:"Sem resultado"}</strong>{summary.improvement!==null?` · Evolução desde o primeiro registro: ${summary.improvement}%`:""}</p>
          <p>Próximo marco pessoal: {summary.nextGate??"Meta atingida"}. Requer melhora mensurável; XP não altera este nível.</p>
          {track.mission&&<p><strong>Missão da semana:</strong> {track.mission} · {track.weeklyDays} dias. {journey?`${done} atividades concluídas em ${journey.name}.`:"Vincule uma jornada para acompanhar as ações."}</p>}
          {track.referenceUrl&&<p>Referência informada: <a href={/^https?:\/\//i.test(track.referenceUrl)?track.referenceUrl:undefined} target="_blank" rel="noreferrer">Consultar fonte</a> · Não verificada</p>}
          <div className="hli-toolbar"><button className="secondary-button" onClick={()=>{setRecording(recording===track.id?null:track.id);setError("");}}>Registrar resultado</button><button className="text-button" onClick={()=>setEditing(track)}>Editar</button><button className="text-button" onClick={()=>onChange(tracks.map(t=>t.id===track.id?{...t,archived:!t.archived}:t))}>{track.archived?"Reativar":"Arquivar"}</button></div>
          {recording===track.id&&<form className="hli-form" onSubmit={e=>saveResult(e,track)}><label>Resultado em {track.unit}<input name="value" type="number" min="0" step="any" required/></label><label>Data<input name="date" type="date" max={new Date().toISOString().slice(0,10)} required defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Contexto e observações<textarea name="note" required placeholder="Como foi medido? Use as mesmas condições."/></label><label>Comprovante ou fonte (opcional)<input name="source" type="url"/></label><p>Registro autodeclarado. Não equivale a uma marca certificada.</p><button className="primary-button">Salvar resultado</button></form>}
          <details><summary>Histórico · {track.evidence.length} resultados</summary>{track.evidence.map(e=><div className="hli-history" key={e.id}><span>{e.date} · {e.value} {track.unit}<br/>{e.note}</span><button className="text-button" onClick={()=>{if(window.confirm(`Remover o resultado ${e.value} ${track.unit}? O índice será recalculado. Seu XP não será alterado.`))onChange(tracks.map(t=>t.id===track.id?{...t,evidence:t.evidence.filter(item=>item.id!==e.id)}:t));}}>Excluir resultado</button></div>)}</details>
        </article>;
      })}</div>
      <details><summary>Como o sistema calcula</summary><p>Nível pessoal = 1 + 149 × (1 − √(1 − progresso)), arredondado para baixo. Progresso compara o melhor resultado ao intervalo entre sua base e sua meta. O ranking usa a última medição dos últimos 30 dias; sem medição recente, fica sem avaliação. O melhor resultado continua preservado.</p><p>Índice geral: 50% das três melhores áreas, 30% da consistência e 20% da média das áreas avaliadas. Só aparece com três áreas medidas e representa apenas essas áreas. Resultados não verificados não desbloqueiam classes históricas nem Apex humano.</p></details>
    </>}
  </section>;
}
