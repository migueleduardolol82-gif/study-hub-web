"use client";

import { ArrowDown, ArrowUp, Check, FileText, LoaderCircle, Plus, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { deleteLocalChunks, extractStudyDocument, hashFile, MAX_STUDY_FILE_BYTES, MAX_STUDY_FILE_MB, MAX_STUDY_FILES, saveLocalChunks, studyFileFormat, type StudyDocument } from "@/lib/study-documents";

function sizeLabel(bytes: number) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export function DocumentUploadPanel({ documents, setDocuments, title = "Criar usando arquivos", onReady, notify }: {
  documents: StudyDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<StudyDocument[]>>;
  title?: string;
  onReady?: (documents: StudyDocument[]) => void;
  notify: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (documents.length + files.length > MAX_STUDY_FILES) { notify(`Selecione no máximo ${MAX_STUDY_FILES} arquivos.`); return; }
    for (const file of files) {
      const format = studyFileFormat(file);
      if (!format) { notify(`${file.name}: formato não suportado.`); continue; }
      if (file.size > MAX_STUDY_FILE_BYTES) { notify(`${file.name}: limite de ${MAX_STUDY_FILE_MB} MB por arquivo.`); continue; }
      const hash = await hashFile(file);
      if (documents.some((item) => item.hash === hash)) { notify(`${file.name} já foi adicionado.`); continue; }
      const id = `doc-${crypto.randomUUID()}`;
      const base: StudyDocument = { id, name: file.name, format, size: file.size, hash, priority: documents.length + 1, selected: true, pageCount: 0, charCount: 0, status: "extracting", stage: "Validando arquivo", createdAt: new Date().toISOString(), localOnly: true };
      setDocuments((current) => [...current, base]);
      try {
        const chunks = await extractStudyDocument(file, id, (stage) => setDocuments((current) => current.map((item) => item.id === id ? { ...item, stage } : item)));
        await saveLocalChunks(chunks);
        let blobUrl: string | undefined;
        let localOnly = true;
        try {
          setDocuments((current) => current.map((item) => item.id === id ? { ...item, stage: "Sincronizando arquivo" } : item));
          const { upload } = await import("@vercel/blob/client");
          const blob = await upload(`nexo-documents/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`, file, { access: "private", handleUploadUrl: "/api/documents/upload" });
          blobUrl = blob.url;
          const metadata = { ...base, blobUrl, pageCount: new Set(chunks.map((chunk) => chunk.locator)).size, charCount: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) };
          const metadataResponse = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "upsert", document: metadata }) });
          if (!metadataResponse.ok) throw new Error("Nuvem indisponível");
          for (let start = 0; start < chunks.length; start += 25) {
            const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "chunks", documentId: id, chunks: chunks.slice(start, start + 25), complete: start + 25 >= chunks.length }) });
            if (!response.ok) throw new Error("Falha ao sincronizar partes");
          }
          localOnly = false;
        } catch { localOnly = true; }
        const ready = { ...base, status: "ready" as const, stage: localOnly ? "Pronto neste aparelho" : "Pronto e sincronizado", pageCount: new Set(chunks.map((chunk) => chunk.locator)).size, charCount: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0), blobUrl, localOnly };
        setDocuments((current) => current.map((item) => item.id === id ? ready : item));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha de extração.";
        setDocuments((current) => current.map((item) => item.id === id ? { ...item, status: "error", stage: "Falha na extração", error: message } : item));
      }
    }
  }

  function move(id: string, direction: -1 | 1) {
    setDocuments((current) => { const index = current.findIndex((item) => item.id === id); const target = index + direction; if (index < 0 || target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next.map((item, priority) => ({ ...item, priority: priority + 1 })); });
  }

  async function remove(document: StudyDocument) {
    if (!window.confirm(`Excluir “${document.name}”? Trilhas e planos existentes serão preservados, mas poderão perder o acesso à fonte.`)) return;
    if (!document.localOnly) await fetch(`/api/documents?id=${encodeURIComponent(document.id)}`, { method: "DELETE" }).catch(() => undefined);
    await deleteLocalChunks(document.id);
    setDocuments((current) => current.filter((item) => item.id !== document.id).map((item, priority) => ({ ...item, priority: priority + 1 })));
  }

  const selected = documents.filter((item) => item.selected && item.status === "ready");
  return <section className="document-uploader panel">
    <div className="panel-heading"><div><span className="eyebrow">FONTES DO CONTEÚDO</span><h3>{title}</h3></div><UploadCloud /></div>
    <button type="button" className={`document-dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files); }}>
      <UploadCloud /><strong>Arraste os arquivos ou toque para selecionar</strong><small>PDF, DOCX, PPTX, TXT, JPG, JPEG e PNG · até 12 arquivos de {MAX_STUDY_FILE_MB} MB</small>
    </button>
    <input ref={inputRef} hidden type="file" multiple accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,application/pdf,text/plain,image/jpeg,image/png" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.currentTarget.value = ""; }} />
    {documents.length > 0 && <div className="document-list">{documents.map((document, index) => <article key={document.id}>
      <label><input type="checkbox" checked={document.selected} disabled={document.status !== "ready"} onChange={(event) => setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, selected: event.target.checked } : item))} /><span className="document-icon">{document.status === "extracting" ? <LoaderCircle className="spin" /> : document.status === "ready" ? <Check /> : <FileText />}</span><span><strong>{document.name}</strong><small>{document.format.toUpperCase()} · {sizeLabel(document.size)} · {document.status === "ready" ? `${document.pageCount} referência(s), ${document.charCount.toLocaleString("pt-BR")} caracteres` : document.error || document.stage}</small></span></label>
      <div><button type="button" aria-label={`Aumentar prioridade de ${document.name}`} disabled={index === 0} onClick={() => move(document.id, -1)}><ArrowUp /></button><button type="button" aria-label={`Diminuir prioridade de ${document.name}`} disabled={index === documents.length - 1} onClick={() => move(document.id, 1)}><ArrowDown /></button><button type="button" aria-label={`Remover ${document.name}`} onClick={() => void remove(document)}><Trash2 /></button></div>
    </article>)}</div>}
    {onReady && <button type="button" className="outline-button wide" disabled={!selected.length || documents.some((item) => item.status === "extracting")} onClick={() => onReady(selected)}><Plus /> Usar {selected.length || "estes"} arquivo(s)</button>}
  </section>;
}
