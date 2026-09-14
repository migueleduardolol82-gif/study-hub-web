'use client';

import { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { readApiResponse } from '@/lib/api-contract';
import type { Appearance } from '@/lib/avatar';
import AvatarFaceControls from './avatar-face-controls';

type PhotoResult = {
  appearance: Appearance;
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
    if (image.naturalWidth < 160 || image.naturalHeight < 160 || image.naturalWidth * image.naturalHeight > 48_000_000) throw new Error('Use uma foto com pelo menos 160 px por lado e até 48 megapixels.');
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
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const [file,setFile] = useState<File|null>(null);
  const [previewUrl,setPreviewUrl] = useState('');
  const [result,setResult] = useState<PhotoResult|null>(null);
  const [analyzing,setAnalyzing] = useState(false);
  const [error,setError] = useState('');

  useEffect(()=>()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);},[previewUrl]);

  async function analyze(){
    if(!file||analyzing)return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    setAnalyzing(true);setError('');setResult(null);
    try{
      const image=await preparePhoto(file);
      controller.signal.throwIfAborted();
      const data=await readApiResponse<PhotoResult>(await fetch('/api/avatar/photo',{signal:controller.signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,current})}));
      if (request.current === controller && !controller.signal.aborted) {setResult(data);onPreview(data.appearance);}
    }catch(reason){
      if (request.current === controller) setError(controller.signal.aborted ? 'A análise demorou demais. Tente novamente.' : reason instanceof Error ? reason.message : 'Não foi possível analisar esta foto.');
    }finally{window.clearTimeout(timeout);if(request.current === controller) {setAnalyzing(false);request.current=null;}}
  }

  return <section className="avatar-photo">
    <div className="avatar-photo-heading"><span className="eyebrow">CRIAÇÃO HÍBRIDA</span><h3>Criar por Foto</h3><p>A foto sugere traços visuais aproximados. Altura, peso, gordura e massa muscular permanecem sob seu controle.</p></div>
    <input ref={input} className="avatar-file-input" aria-label="Selecionar foto" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{request.current?.abort();request.current=null;setAnalyzing(false);const next=event.target.files?.[0]??null;setFile(next);setPreviewUrl(next?URL.createObjectURL(next):'');setResult(null);setError('');}} />
    <button type="button" className={'avatar-photo-drop '+(previewUrl?'has-photo':'')} disabled={analyzing||busy} onClick={()=>input.current?.click()}>
      {previewUrl?<NextImage src={previewUrl} alt="Foto escolhida para criar o avatar" width={360} height={300} unoptimized />:<><strong>Adicionar uma foto</strong><span>JPG, PNG ou WEBP · até 15 MB</span><small>Use uma foto frontal, nítida e bem iluminada.</small></>}
    </button>
    {error&&<div className="avatar-error" role="alert">{error}</div>}
    {!result&&<button type="button" className="primary-button" disabled={!file||analyzing||busy} onClick={()=>void analyze()}>{analyzing?'Analisando rosto e estilo…':'Gerar prévia do avatar'}</button>}
    {result&&<div className="avatar-photo-result">
      <h4>Referência aproximada pronta</h4>
      <div className="avatar-photo-detected"><span><small>Rosto</small>{result.appearance.face}</span><span><small>Cabelo</small>{result.appearance.hair}</span><span><small>Barba</small>{result.appearance.beardStyle??'sem barba'}</span></div><ul>{result.observations.map(note=><li key={note}>{note}</li>)}</ul>
      <p>A prévia já está no personagem. Ajuste abaixo e confirme a versão que preferir. Uma única foto não permite reconstrução 3D exata.</p>
      <fieldset disabled={busy||analyzing}><legend>Ajustes da prévia</legend><AvatarFaceControls appearance={current} onChange={onPreview} includeStyles/></fieldset>
      <div className="avatar-photo-actions"><button type="button" disabled={busy} onClick={()=>{setResult(null);setFile(null);setPreviewUrl('');if(input.current)input.current.value='';}}>Escolher outra</button><button type="button" onClick={()=>onSave(current)} disabled={busy}>{busy?'Salvando…':'Confirmar avatar'}</button></div>
    </div>}
    <p className="avatar-photo-privacy">Ao gerar a prévia, a imagem reduzida é enviada à OpenAI, um serviço externo, para análise. Ela não é salva no perfil. Confira a foto antes de enviar.</p>
  </section>;
}
