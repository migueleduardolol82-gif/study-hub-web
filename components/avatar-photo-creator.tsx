'use client';

import { useEffect, useRef, useState } from 'react';
import { readApiResponse } from '@/lib/api-contract';
import type { Appearance } from '@/lib/avatar';

type PhotoResult = {
  appearance: Appearance;
  confidence: number;
  observations: string[];
};

async function preparePhoto(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Envie uma foto JPG, PNG ou WEBP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('A foto pode ter no máximo 15 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar esta foto.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AvatarPhotoCreator({current,busy,onPreview,onSave}:{current:Appearance;busy:boolean;onPreview:(appearance:Appearance)=>void;onSave:(appearance:Appearance)=>void}) {
  const input = useRef<HTMLInputElement>(null);
  const [file,setFile] = useState<File|null>(null);
  const [previewUrl,setPreviewUrl] = useState('');
  const [result,setResult] = useState<PhotoResult|null>(null);
  const [analyzing,setAnalyzing] = useState(false);
  const [error,setError] = useState('');

  useEffect(()=>{
    if(!file){setPreviewUrl('');return;}
    const url=URL.createObjectURL(file);setPreviewUrl(url);
    return()=>URL.revokeObjectURL(url);
  },[file]);

  async function analyze(){
    if(!file||analyzing)return;
    setAnalyzing(true);setError('');setResult(null);
    try{
      const image=await preparePhoto(file);
      const data=await readApiResponse<PhotoResult>(await fetch('/api/avatar/photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,current})}));
      setResult(data);onPreview(data.appearance);
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Não foi possível analisar esta foto.');
    }finally{setAnalyzing(false);}
  }

  return <section className="avatar-photo">
    <div className="avatar-photo-heading"><span className="eyebrow">CRIAÇÃO HÍBRIDA</span><h3>Criar por Foto</h3><p>A foto define os traços visuais. Altura, peso, gordura e massa muscular permanecem sob seu controle.</p></div>
    <input ref={input} className="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{setFile(event.target.files?.[0]??null);setResult(null);setError('');}} />
    <button type="button" className={'avatar-photo-drop '+(previewUrl?'has-photo':'')} onClick={()=>input.current?.click()}>
      {previewUrl?<img src={previewUrl} alt="Foto escolhida para criar o avatar" />:<><strong>Adicionar uma foto</strong><span>JPG, PNG ou WEBP · até 15 MB</span><small>Use uma foto frontal, nítida e bem iluminada.</small></>}
    </button>
    {error&&<div className="avatar-error" role="alert">{error}</div>}
    {!result&&<button type="button" className="primary-button" disabled={!file||analyzing} onClick={()=>void analyze()}>{analyzing?'Analisando rosto e estilo…':'Gerar prévia do avatar'}</button>}
    {result&&<div className="avatar-photo-result">
      <div><span>Correspondência visual</span><strong>{result.confidence}%</strong></div>
      <div className="avatar-photo-detected"><span><small>Rosto</small>{result.appearance.face}</span><span><small>Cabelo</small>{result.appearance.hair}</span><span><small>Barba</small>{result.appearance.beardStyle??'sem barba'}</span><span><small>Apresentação</small>{result.appearance.shape}</span></div><ul>{result.observations.map(note=><li key={note}>{note}</li>)}</ul>
      <p>A prévia já está no personagem. Use Evolução para ajustar cabelo, rosto, barba, cores e corpo antes de confirmar.</p>
      <div className="avatar-photo-actions"><button type="button" onClick={()=>{setResult(null);setFile(null);}}>Escolher outra</button><button type="button" onClick={()=>onSave(result.appearance)} disabled={busy}>{busy?'Salvando…':'Confirmar avatar'}</button></div>
    </div>}
    <p className="avatar-photo-privacy">A imagem é reduzida no aparelho, usada somente para esta análise e não é salva no perfil.</p>
  </section>;
}
