"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { Grip, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { DraggableWidgetGrid, type WidgetItem } from "@/components/ui/draggable-widget-grid";
import { metricIndicators, widgetFromPrompt, type MetricIndicator, type MetricWidgetConfig, type MetricWidgetSize, type MetricWidgetView } from "@/lib/home-metric-widgets";

export interface MetricSnapshot {
  value: string;
  detail: string;
  progress?: number;
  series?: number[];
}

interface Props {
  widgets: MetricWidgetConfig[];
  onChange: (widgets: MetricWidgetConfig[]) => void;
  values: Record<MetricIndicator, MetricSnapshot>;
  themeAccent: string;
}

const sizeOptions: { value: MetricWidgetSize; label: string }[] = [
  { value: "sm", label: "Compacto" },
  { value: "wide", label: "Largo" },
  { value: "tall", label: "Alto" },
  { value: "lg", label: "Destaque" },
];

const viewOptions: { value: MetricWidgetView; label: string }[] = [
  { value: "number", label: "Número" },
  { value: "progress", label: "Progresso" },
  { value: "bars", label: "Barras" },
];

function MetricTile({ widget, snapshot, onEdit, onRemove, rearranging }: {
  widget: MetricWidgetConfig;
  snapshot: MetricSnapshot;
  onEdit: () => void;
  onRemove: () => void;
  rearranging: boolean;
}) {
  const progress = snapshot.progress === undefined ? undefined : Math.max(0, Math.min(100, snapshot.progress));
  const series = snapshot.series ?? [];
  const maximum = Math.max(...series, 1);
  return (
    <article className="mers-metric-tile" style={widget.color ? { "--widget-accent": widget.color } as CSSProperties : undefined}>
      <div className="mers-metric-tile-head">
        <span>{widget.title}</span>
        {rearranging ? <Grip size={17} aria-hidden="true" /> : <div className="mers-metric-actions"><button type="button" onClick={onEdit} aria-label={`Editar ${widget.title}`}><Pencil size={15} /></button><button type="button" onClick={onRemove} aria-label={`Remover ${widget.title}`}><Trash2 size={15} /></button></div>}
      </div>
      <strong className="mers-metric-value">{snapshot.value}</strong>
      <p className="mers-metric-detail">{snapshot.detail}</p>
      {widget.view === "progress" && (progress === undefined ? <p className="mers-metric-empty">Sem meta percentual para este indicador.</p> : <div className="mers-metric-progress" role="meter" aria-label={`${widget.title}: ${Math.round(progress)}%`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>)}
      {widget.view === "bars" && (series.length ? <div className="mers-metric-bars" role="img" aria-label={`Valores dos últimos ${series.length} dias: ${series.join(", ")}`}>
        {series.map((value, index) => <span key={index} title={`${value}`} style={{ height: `${Math.max(5, value / maximum * 100)}%` }} />)}
      </div> : <p className="mers-metric-empty">Histórico diário ainda não disponível.</p>)}
      <small className="mers-metric-indicator">{metricIndicators.find((item) => item.id === widget.indicator)?.label}</small>
    </article>
  );
}

export function HomeMetricWidgetBoard({ widgets, onChange, values, themeAccent }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [rearranging, setRearranging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<MetricIndicator>("xp");
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<MetricWidgetSize>("sm");
  const [view, setView] = useState<MetricWidgetView>("number");
  const [prompt, setPrompt] = useState("");
  const [color, setColor] = useState("");

  const openCreate = () => {
    setEditingId(null);
    setIndicator("xp");
    setTitle("");
    setSize("sm");
    setView("number");
    setPrompt("");
    setColor("");
    setRearranging(false);
    setFormOpen(true);
  };
  const openEdit = (widget: MetricWidgetConfig) => {
    setEditingId(widget.id);
    setIndicator(widget.indicator);
    setTitle(widget.title);
    setSize(widget.size);
    setView(widget.view);
    setPrompt(widget.prompt);
    setColor(widget.color || "");
    setFormOpen(true);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const next = { ...widgetFromPrompt(prompt, indicator, title, size, view), color: color || undefined };
    if (editingId) onChange(widgets.map((item) => item.id === editingId ? { ...next, id: editingId } : item));
    else onChange([...widgets, next]);
    setFormOpen(false);
    setEditingId(null);
  };
  const items: WidgetItem[] = widgets.map((widget) => ({ id: widget.id, size: widget.size, label: widget.title }));
  const gridKey = widgets.map((widget) => `${widget.id}:${widget.size}`).sort().join("|");

  return (
    <section className="home-metric-board" aria-labelledby="home-metrics-title">
      <div className="home-metric-board-header">
        <div><span className="eyebrow">SEU PAINEL</span><h3 id="home-metrics-title">Indicadores à sua maneira</h3><p>Escolha um indicador real, crie o visual e organize os cartões.</p></div>
        <div className="home-metric-board-buttons"><button type="button" className="outline-button" onClick={() => setRearranging((value) => !value)} aria-pressed={rearranging} disabled={!widgets.length}><Grip size={17} />{rearranging ? "Concluir" : "Mover"}</button><button type="button" className="primary-button" onClick={openCreate}><Plus size={17} />Criar widget</button></div>
      </div>

      {formOpen && <form className="home-metric-form panel" onSubmit={save}>
        <div className="home-metric-form-heading"><div><strong>{editingId ? "Editar widget" : "Criar widget"}</strong><small>Use seu indicador e descreva o estilo desejado.</small></div><button type="button" aria-label="Fechar criação" onClick={() => setFormOpen(false)}><X size={18} /></button></div>
        <div className="home-metric-form-fields">
          <label>Indicador<select value={indicator} onChange={(event) => setIndicator(event.target.value as MetricIndicator)}>{metricIndicators.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Título<input maxLength={60} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={metricIndicators.find((item) => item.id === indicator)?.label} /></label>
          <label>Visual<select value={view} onChange={(event) => setView(event.target.value as MetricWidgetView)}>{viewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Tamanho<select value={size} onChange={(event) => setSize(event.target.value as MetricWidgetSize)}>{sizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Cor do widget<span className="home-metric-color"><input type="color" value={color || themeAccent} onChange={(event) => setColor(event.target.value)} aria-label="Cor do widget" /><button type="button" onClick={() => setColor("")}>{color ? "Usar cor do tema" : "Cor do tema"}</button></span></label>
        </div>
        <label className="home-metric-prompt">Descreva seu widget<textarea maxLength={300} rows={2} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={'Ex.: Mostre meu estudo da semana em barras, em um cartão largo chamado "Meu ritmo".'} /><small>O texto reconhece “barras”, “progresso”, “número”, “compacto”, “largo”, “alto”, “grande” e títulos entre aspas. Os valores vêm dos seus registros.</small></label>
        <div className="home-metric-form-footer"><button type="button" className="outline-button" onClick={() => { setPrompt(""); setTitle(""); setSize("sm"); setView("number"); }}><RotateCcw size={16} />Limpar</button><button type="submit" className="primary-button">{editingId ? "Salvar widget" : "Adicionar ao painel"}</button></div>
      </form>}

      {widgets.length ? <><p className="home-metric-hint">{rearranging ? "Arraste os cartões. No celular, pressione e segure; no teclado, use Alt + setas." : "Toque em Mover para reorganizar seus widgets."}</p><DraggableWidgetGrid key={gridKey} items={items} editable={rearranging} cellSize={215} maxColumns={4} gap={14} onChange={(order) => onChange(order.flatMap(({ id }) => widgets.find((widget) => widget.id === id) ?? []))} renderItem={(item) => {
        const widget = widgets.find((entry) => entry.id === item.id);
        return widget ? <MetricTile widget={widget} snapshot={values[widget.indicator]} onEdit={() => openEdit(widget)} onRemove={() => onChange(widgets.filter((entry) => entry.id !== widget.id))} rearranging={rearranging} /> : null;
      }} /></> : <div className="home-metric-empty-state"><Plus size={24} /><strong>Seu painel começa aqui</strong><p>Crie um widget para acompanhar XP, estudo, metas ou outro indicador.</p><button type="button" onClick={openCreate}>Escolher indicador</button></div>}
    </section>
  );
}
