'use client';

import { avatarBeardStyles, avatarHairStyles, facialControls, resolveFacial, type Appearance } from '@/lib/avatar';

export default function AvatarFaceControls({appearance, onChange, includeStyles = false}: {appearance: Appearance; onChange: (a: Appearance) => void; includeStyles?: boolean}) {
  const facial = resolveFacial(appearance);
  return <div className="avatar-facial-controls">
    {includeStyles && <div className="avatar-fields">
      <label>Formato do rosto<select value={appearance.face ?? 'oval'} onChange={e => onChange({...appearance, face:e.target.value as Appearance['face']})}>{['oval','angular','arredondado'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Cabelo<select value={appearance.hair === 'curto' ? 'moderno' : appearance.hair} onChange={e => onChange({...appearance,hair:e.target.value as Appearance['hair']})}>{avatarHairStyles.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Barba<select value={appearance.beardStyle ?? (appearance.beard ? 'barba curta' : 'sem barba')} onChange={e => onChange({...appearance,beardStyle:e.target.value as Appearance['beardStyle'],beard:e.target.value !== 'sem barba'})}>{avatarBeardStyles.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Comprimento do cabelo<input type="range" min="0.6" max="1.5" step="0.01" value={appearance.hairLength ?? 1} onChange={e => onChange({...appearance,hairLength:Number(e.target.value)})}/></label>
    </div>}
    <label>Mais anime ↔ Mais realista<input type="range" min="0" max="1" step="0.01" value={appearance.realism ?? 0.75} onChange={e => onChange({...appearance,realism:Number(e.target.value)})}/><small>Ajusta o tamanho dos olhos entre estilizado e mais realista.</small></label>
    <details className="avatar-proportions" open>
      <summary>Proporções faciais</summary>
      {facialControls.map(([key,label,min,max]) => <label key={key}><span>{label} <span>{facial[key].toFixed(2)}×</span></span><input aria-label={label} type="range" min={min} max={max} step="0.01" value={facial[key]} onChange={e => onChange({...appearance,facial:{...appearance.facial,[key]:Number(e.target.value)}})}/></label>)}
    </details>
    {includeStyles && <div className="avatar-colors">{([['skin','Tom de pele'],['hairColor','Cor do cabelo'],['eyeColor','Cor dos olhos']] as const).map(([key,label]) => <label key={key}>{label}<input type="color" value={appearance[key] ?? '#647d91'} onChange={e => onChange({...appearance,[key]:e.target.value})}/></label>)}</div>}
  </div>;
}
