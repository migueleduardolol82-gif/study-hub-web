"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Check, MessageSquare, Plus, Send, Trash2, Brain, Pencil, Plug } from "lucide-react";
import { readApiResponse } from "@/lib/api-contract";
import type { AgendaItem, AssistantMessage } from "@/lib/assistant-store";
import "./personal-assistant.css";

type Conversation = { id: string; title: string; messages?: AssistantMessage[] };
type Memory = { id: string; content: string };

const promptPresets = [
  { title: "Revisar escrita", prompt: "Revise minha escrita abaixo. Corrija erros gramaticais e ortográficos e sugira mudanças para torná-la mais clara. Explique brevemente as principais correções.\n\n[cole sua escrita]" },
  { title: "Aprender com 80/20", prompt: "Quero aprender sobre [tópico]. Quais são os 20% de conceitos e práticas mais importantes que me ajudam a compreender 80% do tema? Organize uma sequência de estudo com exemplos." },
  { title: "Plano de 30 dias", prompt: "Quero aprender ou melhorar [habilidade]. Estou começando do zero. Crie um plano prático de 30 dias, com uma tarefa por dia, progressão de dificuldade e formas de medir meu avanço." },
  { title: "Insights de um livro", prompt: "Resuma o livro [título], de [autor]. Destaque as ideias e os insights mais úteis. Se você não tiver informações confiáveis sobre o livro, diga o que falta em vez de inventar." },
  { title: "Avaliar argumento", prompt: "Analise meu argumento sob a perspectiva de [pessoa de referência]. Aponte pontos fortes, fragilidades e melhorias, sem atribuir falas inventadas a essa pessoa.\n\n[cole seu argumento]" },
  { title: "Resolver problema", prompt: "Ajude-me a resolver [problema]. Divida a solução em passos concretos, explique as decisões importantes e indique como verificar se cada passo funcionou." },
  { title: "Gerar ideias", prompt: "Estou escrevendo sobre [tópico]. Crie um esboço com dez pontos e cinco opções de título. Considere este público: [público]." },
  { title: "Resumir texto", prompt: "Resuma o texto abaixo em até 500 palavras. Separe os pontos principais em seções curtas e preserve as nuances importantes.\n\n[cole o texto]" },
  { title: "Memorizar com histórias", prompt: "Estou aprendendo sobre [tópico]. Transforme as lições principais em histórias e metáforas fáceis de lembrar. Depois explique os limites de cada metáfora." },
  { title: "Testar conhecimento", prompt: "Estou aprendendo sobre [tópico]. Faça uma pergunta de cada vez para testar meu conhecimento. Depois de cada resposta, identifique lacunas, explique a resposta melhor e avance para a próxima pergunta." },
];

async function api<T>(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  return readApiResponse<T>(response);
}

export function PersonalAssistant() {
  const [view, setView] = useState<"chat" | "agenda" | "memory" | "integrations">(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("assistant") === "integrations" ? "integrations" : "chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [text, setText] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [kind, setKind] = useState<"event" | "task">("event");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [notion, setNotion] = useState<{ configured: boolean; connected: boolean; workspaceName?: string; lastSyncAt?: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<Conversation[]>("/api/assistant/conversations"),
      api<AgendaItem[]>("/api/assistant/agenda"),
      api<Memory[]>("/api/assistant/memory"),
      api<{ configured: boolean; connected: boolean; workspaceName?: string; lastSyncAt?: string }>("/api/integrations/notion"),
    ]).then(([chats, agenda, memory, notionStatus]) => {
      if (mounted) { setConversations(chats); setItems(agenda); setMemories(memory); setNotion(notionStatus); }
    }).catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o assistente."); });
    return () => { mounted = false; };
  }, []);

  async function disconnectNotion() {
    if (!window.confirm("Remover o acesso do Notion neste aplicativo? Para revogar também no Notion, remova a conexão nas configurações do seu espaço de trabalho.")) return;
    try { await api("/api/integrations/notion", "DELETE"); setNotion((current) => current ? { ...current, connected: false } : current); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao desconectar Notion."); }
  }

  async function createConversation() {
    setError("");
    try {
      const conversation = await api<Conversation>("/api/assistant/conversations", "POST");
      setConversations((current) => [conversation, ...current]);
      setActive(conversation);
      setView("chat");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao criar conversa."); }
  }

  async function openConversation(id: string) {
    setError("");
    try { setActive(await api<Conversation>(`/api/assistant/conversations?id=${encodeURIComponent(id)}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao abrir conversa."); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true); setError(""); setText("");
    try {
      let conversation = active;
      if (!conversation) {
        conversation = await api<Conversation>("/api/assistant/conversations", "POST");
        setConversations((current) => [conversation!, ...current]);
      }
      setActive({ ...conversation, messages: [...(conversation.messages || []), { role: "user", text: message, at: new Date().toISOString() }] });
      const result = await api<{ messages: AssistantMessage[] }>("/api/assistant/message", "POST", { conversationId: conversation.id, message });
      setActive({ ...conversation, title: conversation.title === "Nova conversa" ? message.slice(0, 70) : conversation.title, messages: result.messages });
      setConversations((current) => current.map((entry) => entry.id === conversation!.id ? { ...entry, title: entry.title === "Nova conversa" ? message.slice(0, 70) : entry.title } : entry));
    } catch (reason) { setText(message); setError(reason instanceof Error ? reason.message : "Falha ao enviar mensagem."); }
    finally { setBusy(false); }
  }

  function choosePrompt(prompt: string) {
    setText(prompt);
    inputRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Excluir esta conversa?")) return;
    try {
      await api(`/api/assistant/conversations?id=${encodeURIComponent(id)}`, "DELETE");
      setConversations((current) => current.filter((entry) => entry.id !== id));
      if (active?.id === id) setActive(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao excluir conversa."); }
  }

  async function createAgendaItem(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const item = await api<AgendaItem>("/api/assistant/agenda", "POST", { title, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), kind });
      setItems((current) => [...current, item].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setTitle(""); setStartsAt(""); setEndsAt("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao salvar compromisso."); }
  }

  async function toggleTask(item: AgendaItem) {
    try {
      const updated = await api<AgendaItem>("/api/assistant/agenda", "PATCH", { id: item.id, done: !item.done });
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao atualizar tarefa."); }
  }

  async function deleteAgendaItem(id: string) {
    if (!window.confirm("Excluir este item da agenda?")) return;
    try { await api(`/api/assistant/agenda?id=${encodeURIComponent(id)}`, "DELETE"); setItems((current) => current.filter((item) => item.id !== id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao excluir item."); }
  }

  async function addMemory(event: FormEvent) {
    event.preventDefault(); setError("");
    try { const memory = await api<Memory>("/api/assistant/memory", "POST", { content: memoryText }); setMemories((current) => [memory, ...current]); setMemoryText(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao salvar memória."); }
  }

  async function editMemory(memory: Memory) {
    const content = window.prompt("Corrigir memória", memory.content)?.trim();
    if (!content || content === memory.content) return;
    try { const updated = await api<Memory>("/api/assistant/memory", "PATCH", { id: memory.id, content }); setMemories((current) => current.map((item) => item.id === memory.id ? updated : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao corrigir memória."); }
  }

  async function deleteMemory(id: string) {
    if (!window.confirm("Apagar esta memória?")) return;
    try { await api(`/api/assistant/memory?id=${encodeURIComponent(id)}`, "DELETE"); setMemories((current) => current.filter((item) => item.id !== id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao apagar memória."); }
  }

  return <div className="personal-assistant">
    <header className="assistant-heading"><div><span className="eyebrow">ASSISTENTE PESSOAL</span><h2>Seu espaço para pensar e organizar</h2><p>Converse com seus dados de estudo, acompanhe compromissos e escolha o que o assistente deve lembrar.</p></div></header>
    <div className="assistant-tabs" role="tablist" aria-label="Áreas do assistente">
      <button role="tab" aria-selected={view === "chat"} onClick={() => setView("chat")}><MessageSquare size={17} /> Conversas</button>
      <button role="tab" aria-selected={view === "agenda"} onClick={() => setView("agenda")}><CalendarDays size={17} /> Agenda</button>
      <button role="tab" aria-selected={view === "memory"} onClick={() => setView("memory")}><Brain size={17} /> Memória</button>
      <button role="tab" aria-selected={view === "integrations"} onClick={() => setView("integrations")}><Plug size={17} /> Integrações</button>
    </div>
    {error && <p className="assistant-error" role="alert">{error}</p>}
    {view === "chat" && <div className="assistant-chat-layout">
      <aside className="assistant-conversations"><button className="assistant-new" onClick={createConversation}><Plus size={18} /> Nova conversa</button>{conversations.map((conversation) => <div className="assistant-conversation" key={conversation.id}><button className={active?.id === conversation.id ? "selected" : ""} onClick={() => openConversation(conversation.id)}>{conversation.title}</button><button className="assistant-icon" aria-label={`Excluir ${conversation.title}`} onClick={() => deleteConversation(conversation.id)}><Trash2 size={15} /></button></div>)}</aside>
      <section className="assistant-chat"><div className="assistant-message-list" aria-live="polite">{!active?.messages?.length && <div className="assistant-empty"><MessageSquare size={28} /><h3>Em que posso ajudar?</h3><p>Posso considerar sua agenda e os dados disponíveis na sua conta. Ações externas ainda exigem uma integração ativa.</p><div className="assistant-prompt-list">{promptPresets.slice(0, showAllPrompts ? promptPresets.length : 4).map((preset) => <button key={preset.title} onClick={() => choosePrompt(preset.prompt)}>{preset.title}</button>)}</div><button className="assistant-more-prompts" onClick={() => setShowAllPrompts((value) => !value)}>{showAllPrompts ? "Mostrar menos" : "Ver os 10 atalhos"}</button></div>}{active?.messages?.map((message, index) => <div key={`${message.at}-${index}`} className={`assistant-message ${message.role}`}>{message.text}</div>)}{busy && <p className="assistant-thinking">Preparando resposta…</p>}</div><form className="assistant-compose" onSubmit={send}><label className="sr-only" htmlFor="assistant-input">Mensagem</label><textarea ref={inputRef} id="assistant-input" placeholder="Pergunte sobre seus estudos ou planeje seu dia…" value={text} onChange={(event) => setText(event.target.value)} maxLength={6000} /><button type="submit" disabled={!text.trim() || busy} aria-label="Enviar"><Send size={19} /></button></form></section>
    </div>}
    {view === "agenda" && <div className="assistant-panel"><h3>Compromissos e tarefas</h3><form className="assistant-agenda-form" onSubmit={createAgendaItem}><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required /></label><label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value as "event" | "task")}><option value="event">Compromisso</option><option value="task">Tarefa</option></select></label><label>Início<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label>Fim<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label><button type="submit"><Plus size={16} /> Adicionar</button></form><div className="assistant-items">{items.length === 0 && <p>Nenhum compromisso ou tarefa ainda.</p>}{items.map((item) => <article key={item.id} className={item.done ? "done" : ""}><div><strong>{item.title}</strong><small>{item.kind === "task" ? "Tarefa" : "Compromisso"} · {new Date(item.startsAt).toLocaleString("pt-BR")} – {new Date(item.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div>{item.kind === "task" && <button className="assistant-icon" onClick={() => toggleTask(item)} aria-label={item.done ? "Reabrir tarefa" : "Concluir tarefa"}><Check size={18} /></button>}<button className="assistant-icon" onClick={() => deleteAgendaItem(item.id)} aria-label="Excluir item"><Trash2 size={17} /></button></article>)}</div></div>}
    {view === "memory" && <div className="assistant-panel"><h3>O que o assistente pode lembrar</h3><p>Adicione preferências e objetivos. Você pode corrigir ou apagar qualquer memória.</p><form className="assistant-memory-form" onSubmit={addMemory}><input value={memoryText} onChange={(event) => setMemoryText(event.target.value)} maxLength={500} placeholder="Ex.: prefiro estudar à noite" required /><button type="submit"><Plus size={17} /> Salvar</button></form><div className="assistant-items">{memories.length === 0 && <p>Nenhuma memória salva.</p>}{memories.map((memory) => <article key={memory.id}><strong>{memory.content}</strong><button className="assistant-icon" onClick={() => editMemory(memory)} aria-label="Editar memória"><Pencil size={16} /></button><button className="assistant-icon" onClick={() => deleteMemory(memory.id)} aria-label="Apagar memória"><Trash2 size={16} /></button></article>)}</div></div>}
    {view === "integrations" && <div className="assistant-panel"><h3>Aplicativos conectados</h3><div className="assistant-integration"><div><strong>Notion</strong><p>{notion?.connected ? `Conectado ao espaço ${notion.workspaceName || "Notion"}. O assistente pode pesquisar páginas autorizadas e ler trechos do conteúdo.` : notion?.configured ? "Pronto para conectar. Você escolhe as páginas permitidas no Notion." : "Aguardando configuração OAuth no servidor."}</p>{notion?.lastSyncAt && <small>Última consulta: {new Date(notion.lastSyncAt).toLocaleString("pt-BR")}</small>}</div>{notion?.connected ? <button onClick={disconnectNotion}>Remover deste app</button> : notion?.configured ? <a href="/api/integrations/notion/start">Conectar Notion</a> : null}</div><p className="assistant-integration-note">Para ativar a conexão, configure NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, NOTION_REDIRECT_URI e INTEGRATION_ENCRYPTION_KEY na Vercel. Outros aplicativos serão adicionados após suas credenciais e permissões próprias.</p></div>}
  </div>;
}

