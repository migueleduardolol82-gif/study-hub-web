'use client';
import {useState} from 'react';
import {defaultItemColors,wardrobePalette,type ItemMaterialColors} from '@/lib/avatar-item-colors';

export default function AvatarItemColorEditor({name,slot,original,saved,busy,onPreview,onApply,onCancel}:{
 name:string;slot:string;original:string;saved:ItemMaterialColors;busy:boolean;
 onPreview:(colors:ItemMaterialColors)=>void;onApply:(colors:ItemMaterialColors)=>Promise<boolean>;onCancel:()=>void;
}){
 const [draft,setDraft]=useState(saved);
 const [region,setRegion]=useState<keyof ItemMaterialColors>('primaryColor');
 const regions:Array<[keyof ItemMaterialColors,string]>=slot==='tronco'||slot==='calçados'
  ? [['primaryColor','Principal'],['secondaryColor',slot==='calçados'?'Sola':'Secundária'],['detailColor','Detalhes']]
  : [['primaryColor','Principal']];
 const change=(next:ItemMaterialColors)=>{setDraft(next);onPreview(next);};
 return <fieldset className="wardrobe-color-editor" disabled={busy}>
  <legend>Cores · {name}</legend>
  <div role="group" aria-label="Área da roupa">{regions.map(([key,label])=><button type="button" key={key} aria-pressed={region===key} onClick={()=>setRegion(key)}>{label}</button>)}</div>
  <div className="wardrobe-swatches">{wardrobePalette.map(([label,color])=><button type="button" key={color} title={label} aria-label={label} aria-pressed={draft[region]===color} style={{backgroundColor:color}} onClick={()=>change({...draft,[region]:color})}/>)}</div>
  <label>Personalizar <input type="color" aria-label={`Personalizar cor de ${name}`} value={draft[region]} onChange={e=>change({...draft,[region]:e.target.value})}/></label>
  <p>Prévia imediata. A cor não altera a raridade.</p>
  <div><button type="button" onClick={()=>void onApply(draft)}>Aplicar</button><button type="button" onClick={()=>{setDraft(saved);onCancel();}}>Cancelar</button><button type="button" onClick={()=>change(defaultItemColors(original))}>Restaurar cor original</button></div>
 </fieldset>;
}
