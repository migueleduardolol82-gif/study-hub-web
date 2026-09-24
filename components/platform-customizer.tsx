"use client";

import {ArrowDown,ArrowUp,Check,LayoutGrid,Moon,Palette,Plus,RotateCcw,Sparkles,Sun,X} from 'lucide-react';
import {defaultPlatformPreferences,moveWidget,platformPalettes,widgetCatalog,type HomeWidgetId,type PlatformPreferences} from '@/lib/platform-preferences';

export function PlatformCustomizer({value,onChange,onClose}: {value:PlatformPreferences;onChange:(next:PlatformPreferences)=>void;onClose?:()=>void}) {
  const active=new Set(value.widgets);
  const toggle=(id:HomeWidgetId)=>onChange({...value,widgets:active.has(id)?value.widgets.filter(item=>item!==id):[...value.widgets,id]});
  return <section className="platform-customizer panel" aria-labelledby="customizer-title">
    <header><div><span className="eyebrow"><Palette size={14}/> APARÊNCIA</span><h3 id="customizer-title">Deixe o Mers com a sua cara</h3><p>Escolha as cores e monte a página inicial com os módulos que usa.</p></div>{onClose&&<button className="icon-button" onClick={onClose} aria-label="Fechar personalização"><X/></button>}</header>
    <div className="palette-list" role="group" aria-label="Paletas da plataforma">{platformPalettes.map(palette=><button key={palette.id} aria-pressed={value.palette===palette.id&&!value.customAccent} onClick={()=>onChange({...value,palette:palette.id,customAccent:''})}><i style={{background:palette.accent}}/>{palette.label}{value.palette===palette.id&&!value.customAccent&&<Check size={15}/>}</button>)}<label className={value.customAccent?'active':''}><input aria-label="Cor personalizada" type="color" value={value.customAccent||platformPalettes.find(item=>item.id===value.palette)?.accent} onChange={event=>onChange({...value,customAccent:event.target.value})}/><span>Personalizada</span></label></div>
    <div className="appearance-editor">
      <div className="design-preview" aria-hidden="true"><span><Sparkles/></span><div><small>SEU ESTILO</small><strong>Interface viva e modular</strong><i/></div></div>
      <fieldset><legend>Tema</legend><div><button aria-pressed={value.mode==='dark'} onClick={()=>onChange({...value,mode:'dark'})}><Moon/>Escuro</button><button aria-pressed={value.mode==='light'} onClick={()=>onChange({...value,mode:'light'})}><Sun/>Claro</button></div></fieldset>
      <fieldset><legend>Densidade</legend><div>{([['comfortable','Confortável'],['compact','Compacta']] as const).map(([id,label])=><button key={id} aria-pressed={value.density===id} onClick={()=>onChange({...value,density:id})}>{label}</button>)}</div></fieldset>
      <fieldset><legend>Cantos</legend><div>{([['rounded','Redondos'],['soft','Suaves'],['sharp','Retos']] as const).map(([id,label])=><button key={id} aria-pressed={value.radius===id} onClick={()=>onChange({...value,radius:id})}>{label}</button>)}</div></fieldset>
      <fieldset><legend>Efeitos</legend><div>{([['ambient','Atmosfera'],['minimal','Minimalista']] as const).map(([id,label])=><button key={id} aria-pressed={value.effects===id} onClick={()=>onChange({...value,effects:id})}>{label}</button>)}</div></fieldset>
    </div>
    <div className="widget-editor"><div><LayoutGrid size={18}/><span><strong>Widgets da página inicial</strong><small>Adicione, remova e escolha a ordem.</small></span></div>{widgetCatalog.map(widget=>{const index=value.widgets.indexOf(widget.id);return <article key={widget.id} className={active.has(widget.id)?'active':''}><span><strong>{widget.label}</strong><small>{widget.description}</small></span>{index>=0?<div><button aria-label={`Mover ${widget.label} para cima`} disabled={index===0} onClick={()=>onChange({...value,widgets:moveWidget(value.widgets,widget.id,-1)})}><ArrowUp/></button><button aria-label={`Mover ${widget.label} para baixo`} disabled={index===value.widgets.length-1} onClick={()=>onChange({...value,widgets:moveWidget(value.widgets,widget.id,1)})}><ArrowDown/></button><button aria-label={`Remover ${widget.label}`} onClick={()=>toggle(widget.id)}><X/></button></div>:<button className="widget-add" onClick={()=>toggle(widget.id)}><Plus/>Adicionar</button>}</article>})}</div>
    <button className="customizer-reset" onClick={()=>onChange({...defaultPlatformPreferences,widgets:[...defaultPlatformPreferences.widgets]})}><RotateCcw/>Restaurar visual original</button>
  </section>;
}
