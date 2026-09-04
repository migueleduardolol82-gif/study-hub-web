"use client";

import { Archive, Check, Copy, Edit3, FolderOpen, Link2, MoreVertical, Pause, Play, Plus, Search, Star, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { StudyMapRecord, StudyMapStatus, ThemeDifficulty, ThemeRecord } from "@/lib/learning";

const emptyTheme = { name: "", description: "", icon: "✦", color: "#a78bfa", imageUrl: "", category: "", difficulty: "iniciante" as ThemeDifficulty, objective: "" };

export function ThemesWorkspace({
  themes, maps, onSave, onDelete, onDuplicate, onArchive, onCreateMap,
}: {
  themes: ThemeRecord[];
  maps: StudyMapRecord[];
  onSave: (theme: ThemeRecord) => void;
  onDelete: (themeId: string, deleteLearningData: boolean) => void;
  onDuplicate: (themeId: string) => void;
  onArchive: (themeId: string) => void;
  onCreateMap: (theme: ThemeRecord) => void;
}) {
  const [draft, setDraft] = useState(emptyTheme);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const visible = useMemo(() => themes.filter((theme) => (showArchived || !theme.archived) && `${theme.name} ${theme.category} ${theme.description}`.toLowerCase().includes(query.toLowerCase())), [themes, query, showArchived]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    const previous = themes.find((theme) => theme.id === editingId);
    const now = new Date().toISOString();
    onSave({
      id: previous?.id || `theme-${Date.now()}`, name, description: draft.description.trim(), icon: draft.icon.trim() || "✦",
      color: draft.color, imageUrl: draft.imageUrl.trim() || undefined, category: draft.category.trim() || "Personalizado",
      difficulty: draft.difficulty, objective: draft.objective.trim(), createdAt: previous?.createdAt || now, updatedAt: now,
      archived: previous?.archived || false, mapIds: previous?.mapIds || [],
    });
    setDraft(emptyTheme);
    setEditingId("");
  }

  function edit(theme: ThemeRecord) {
    setEditingId(theme.id);
    setDraft({ name: theme.name, description: theme.description, icon: theme.icon, color: theme.color, imageUrl: theme.imageUrl || "", category: theme.category, difficulty: theme.difficulty, objective: theme.objective });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const deleting = themes.find((theme) => theme.id === deletingId);
  const affectedMaps = deleting ? maps.filter((map) => map.themeIds.includes(deleting.id)) : [];

  return (
    <div className="entity-page">
      <section className="entity-hero">
        <div><span className="eyebrow lime">BIBLIOTECA PESSOAL</span><h2>Temas que conectam estudo, mapas e revisão.</h2><p>Crie áreas livres para qualquer assunto. Cada tema mantém identidade, objetivo, trilhas e vínculos próprios.</p></div>
        <div className="entity-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar temas" /><button onClick={() => setShowArchived((value) => !value)} className={showArchived ? "active" : ""}><Archive size={16} /> Arquivados</button></div>
      </section>

      <form className="entity-form panel" onSubmit={submit}>
        <div className="panel-heading"><div><span className="eyebrow">{editingId ? "EDITAR TEMA" : "NOVO TEMA"}</span><h3>{editingId ? "Atualize sem perder os vínculos" : "Defina o próximo domínio"}</h3></div>{editingId && <button type="button" className="icon-button" onClick={() => { setEditingId(""); setDraft(emptyTheme); }} aria-label="Cancelar edição"><X size={17} /></button>}</div>
        <div className="entity-form-grid">
          <label><span>Nome</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Inglês para negócios" /></label>
          <label><span>Categoria</span><input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Ex.: Idiomas" /></label>
          <label><span>Ícone</span><input value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value.slice(0, 4) })} aria-label="Ícone do tema" /></label>
          <label><span>Cor</span><input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label>
          <label><span>Dificuldade</span><select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as ThemeDifficulty })}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label>
          <label><span>Imagem opcional (URL)</span><input value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="https://..." /></label>
          <label className="wide-field"><span>Objetivo</span><input value={draft.objective} onChange={(event) => setDraft({ ...draft, objective: event.target.value })} placeholder="Resultado que você quer alcançar" /></label>
          <label className="wide-field"><span>Descrição</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Escopo, contexto e limites deste tema" /></label>
        </div>
        <button className="primary-button" type="submit"><Check size={17} /> {editingId ? "Salvar alterações" : "Criar tema"}</button>
      </form>

      {visible.length ? <section className="entity-grid">{visible.map((theme) => {
        const linkedMaps = maps.filter((map) => map.themeIds.includes(theme.id));
        const totalTopics = linkedMaps.reduce((total, map) => total + map.mapping.topics.length, 0);
        const progress = linkedMaps.length ? Math.round(linkedMaps.reduce((total, map) => total + map.mapping.coverage, 0) / linkedMaps.length) : 0;
        return <article className={`entity-card panel ${theme.archived ? "archived" : ""}`} key={theme.id} style={{ "--entity-color": theme.color } as React.CSSProperties}>
          <div className="entity-card-head"><span>{theme.icon}</span><div><small>{theme.category} · {theme.difficulty}</small><h3>{theme.name}</h3></div></div>
          <p>{theme.description || "Sem descrição."}</p><strong className="entity-objective">{theme.objective || "Objetivo ainda não definido"}</strong>
          <div className="entity-metrics"><span><strong>{progress}%</strong> progresso</span><span><strong>{linkedMaps.length}</strong> mapas</span><span><strong>{totalTopics}</strong> tópicos</span></div>
          <div className="entity-actions"><button onClick={() => onCreateMap(theme)}><Plus size={15} /> Criar mapa</button><button onClick={() => edit(theme)}><Edit3 size={15} /> Editar</button><button onClick={() => onDuplicate(theme.id)}><Copy size={15} /> Duplicar</button><button onClick={() => onArchive(theme.id)}><Archive size={15} /> {theme.archived ? "Reativar" : "Arquivar"}</button><button className="danger" onClick={() => setDeletingId(theme.id)}><Trash2 size={15} /> Excluir</button></div>
        </article>;
      })}</section> : <section className="entity-empty panel"><FolderOpen size={28} /><strong>Nenhum tema encontrado</strong><p>Crie um tema acima para organizar mapas, lições e atividades.</p></section>}

      {deleting && <div className="modal-backdrop" role="presentation"><section className="confirm-modal panel" role="dialog" aria-modal="true" aria-labelledby="delete-theme-title"><span className="danger-icon"><Trash2 /></span><h3 id="delete-theme-title">Excluir “{deleting.name}”?</h3><p>{affectedMaps.length ? `Este tema está vinculado a ${affectedMaps.length} mapa(s): ${affectedMaps.map((map) => map.name).join(", ")}. Os mapas não serão apagados.` : "Nenhum mapa será afetado."}</p><div className="confirm-actions"><button onClick={() => setDeletingId("")}>Cancelar</button><button onClick={() => { onDelete(deleting.id, false); setDeletingId(""); }}>Excluir só o tema</button><button className="danger-button" onClick={() => { onDelete(deleting.id, true); setDeletingId(""); }}>Excluir tema e trilhas</button></div></section></div>}
    </div>
  );
}

export function StudyMapsLibrary({ maps, themes, activeMapId, onCreate, onOpen, onUpdate, onDelete, onDuplicate }: {
  maps: StudyMapRecord[];
  themes: ThemeRecord[];
  activeMapId: string;
  onCreate: () => void;
  onOpen: (map: StudyMapRecord) => void;
  onUpdate: (map: StudyMapRecord) => void;
  onDelete: (map: StudyMapRecord) => void;
  onDuplicate: (map: StudyMapRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StudyMapStatus | "all">("all");
  const [menuId, setMenuId] = useState("");
  const [deleteMap, setDeleteMap] = useState<StudyMapRecord | null>(null);
  const visible = maps.filter((map) => (status === "all" || map.status === status) && `${map.name} ${map.description} ${map.objective}`.toLowerCase().includes(query.toLowerCase()));
  const statusLabel: Record<StudyMapStatus, string> = { active: "Ativo", paused: "Pausado", completed: "Concluído", archived: "Arquivado" };
  function setMapStatus(map: StudyMapRecord, next: StudyMapStatus) { onUpdate({ ...map, status: next, updatedAt: new Date().toISOString() }); setMenuId(""); }
  function primary(map: StudyMapRecord) {
    maps.forEach((item) => onUpdate({ ...item, isPrimary: item.id === map.id, updatedAt: item.id === map.id ? new Date().toISOString() : item.updatedAt }));
    setMenuId("");
  }
  return <section className="map-library panel">
    <div className="panel-heading"><div><span className="eyebrow">MEUS MAPAS DE ESTUDOS</span><h3>{maps.length} mapa(s) independente(s)</h3></div><button className="primary-button" onClick={onCreate}><Plus size={16} /> Novo mapa</button></div>
    <div className="library-tools"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar mapas" /></label><select value={status} onChange={(event) => setStatus(event.target.value as StudyMapStatus | "all")}><option value="all">Todos os status</option><option value="active">Ativos</option><option value="paused">Pausados</option><option value="completed">Concluídos</option><option value="archived">Arquivados</option></select></div>
    {visible.length ? <div className="map-library-grid">{visible.map((map) => <article key={map.id} className={activeMapId === map.id ? "active" : ""}>
      <button className="map-open" onClick={() => onOpen(map)}><span className="map-icon"><FolderOpen size={19} /></span><div><span>{statusLabel[map.status]} {map.isPrimary && "· Principal"}</span><strong>{map.name}</strong><small>{map.mapping.topics.length} tópicos · {map.mapping.coverage}% · {new Date(map.lastActivityAt).toLocaleDateString("pt-BR")}</small></div><i><b style={{ width: `${map.mapping.coverage}%` }} /></i></button>
      <button className="map-menu-button" aria-label={`Ações de ${map.name}`} onClick={() => setMenuId(menuId === map.id ? "" : map.id)}><MoreVertical size={18} /></button>
      {menuId === map.id && <div className="card-menu"><button onClick={() => onOpen(map)}><FolderOpen size={15} /> Abrir/editar</button><button onClick={() => onDuplicate(map)}><Copy size={15} /> Duplicar</button><button onClick={() => primary(map)}><Star size={15} /> Definir principal</button>{map.status === "paused" ? <button onClick={() => setMapStatus(map, "active")}><Play size={15} /> Reativar</button> : <button onClick={() => setMapStatus(map, "paused")}><Pause size={15} /> Pausar</button>}<button onClick={() => setMapStatus(map, map.status === "archived" ? "active" : "archived")}><Archive size={15} /> {map.status === "archived" ? "Reativar" : "Arquivar"}</button><button className="danger" onClick={() => { setDeleteMap(map); setMenuId(""); }}><Trash2 size={15} /> Excluir</button></div>}
      <div className="map-theme-links"><Link2 size={13} /> {map.themeIds.length ? map.themeIds.map((id) => themes.find((theme) => theme.id === id)?.name).filter(Boolean).join(", ") : "Sem tema vinculado"}</div>
    </article>)}</div> : <div className="entity-empty"><FolderOpen size={26} /><strong>Nenhum mapa nesta visualização</strong><p>Crie seu primeiro mapa sem substituir os dados existentes.</p></div>}
    {deleteMap && <div className="modal-backdrop"><section className="confirm-modal panel" role="dialog" aria-modal="true"><span className="danger-icon"><Trash2 /></span><h3>Excluir “{deleteMap.name}”?</h3><p>Serão removidos {deleteMap.mapping.topics.length} tópicos deste mapa. Temas vinculados e outros mapas serão preservados. Esta ação pode alterar progresso e atividades vinculadas.</p><div className="confirm-actions"><button onClick={() => setDeleteMap(null)}>Cancelar</button><button className="danger-button" onClick={() => { onDelete(deleteMap); setDeleteMap(null); }}>Excluir mapa</button></div></section></div>}
  </section>;
}
