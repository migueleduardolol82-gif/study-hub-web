export const acceptedStudyExtensions = ["pdf", "docx", "pptx", "txt", "jpg", "jpeg", "png"] as const;
export type StudyDocumentFormat = (typeof acceptedStudyExtensions)[number];

export type DocumentChunk = {
  id: string;
  documentId: string;
  order: number;
  locator: string;
  text: string;
};

export type StudyDocument = {
  id: string;
  name: string;
  format: StudyDocumentFormat;
  size: number;
  hash: string;
  priority: number;
  selected: boolean;
  pageCount: number;
  charCount: number;
  status: "extracting" | "ready" | "error";
  stage: string;
  error?: string;
  blobUrl?: string;
  localOnly?: boolean;
  createdAt: string;
};

export const MAX_STUDY_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_STUDY_FILE_MB = MAX_STUDY_FILE_BYTES / (1024 * 1024);
export const MAX_STUDY_FILES = 12;
export const DOCUMENT_CHUNK_CHARS = 6000;

export function studyFileFormat(file: Pick<File, "name">): StudyDocumentFormat | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return acceptedStudyExtensions.includes(extension as StudyDocumentFormat) ? extension as StudyDocumentFormat : null;
}

export async function hashFile(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function cleanText(value: string) {
  return value.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

function chunksForPage(documentId: string, page: number, label: string, text: string, startOrder: number) {
  const clean = cleanText(text);
  if (!clean) return [] as DocumentChunk[];
  const chunks: DocumentChunk[] = [];
  for (let offset = 0; offset < clean.length; offset += DOCUMENT_CHUNK_CHARS) {
    const part = clean.slice(offset, offset + DOCUMENT_CHUNK_CHARS);
    chunks.push({ id: crypto.randomUUID(), documentId, order: startOrder + chunks.length, locator: label || `Página ${page}`, text: part });
  }
  return chunks;
}

function xmlText(xml: string) {
  const decode = (value: string) => value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return decode(Array.from(xml.matchAll(/<(?:w:|a:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w:|a:)?t>/g), (match) => match[1]).join(" "));
}

export async function extractStudyDocument(file: File, documentId: string, progress: (stage: string) => void): Promise<DocumentChunk[]> {
  const format = studyFileFormat(file);
  if (!format) throw new Error("Formato não suportado.");
  const chunks: DocumentChunk[] = [];
  if (format === "txt") {
    progress("Extraindo texto");
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    for (let start = 0; start < lines.length; start += 120) chunks.push(...chunksForPage(documentId, Math.floor(start / 120) + 1, `Linhas ${start + 1}–${Math.min(lines.length, start + 120)}`, lines.slice(start, start + 120).join("\n"), chunks.length));
  } else if (format === "pdf") {
    progress("Abrindo PDF");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    for (let page = 1; page <= pdf.numPages; page += 1) {
      progress(`Lendo página ${page} de ${pdf.numPages}`);
      const pdfPage = await pdf.getPage(page);
      const content = await pdfPage.getTextContent();
      let pageText = content.items.map((item) => "str" in item ? item.str : "").join(" ").trim();
      if (pageText.length < 20) {
        progress(`Executando OCR na página ${page} de ${pdf.numPages}`);
        const viewport = pdfPage.getViewport({ scale: 1.65 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error(`Não foi possível preparar o OCR da página ${page}.`);
        await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
        const { recognize } = await import("tesseract.js");
        pageText = (await recognize(canvas, "por+eng")).data.text;
      }
      chunks.push(...chunksForPage(documentId, page, `Página ${page}`, pageText, chunks.length));
    }
  } else if (format === "docx" || format === "pptx") {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files).filter((name) => format === "docx"
      ? /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(name)
      : /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!names.length) throw new Error("O documento não contém texto legível.");
    for (let index = 0; index < names.length; index += 1) {
      progress(format === "pptx" ? `Lendo slide ${index + 1} de ${names.length}` : "Lendo conteúdo do DOCX");
      const text = xmlText(await zip.file(names[index])!.async("string"));
      const slide = names[index].match(/slide(\d+)\.xml$/i)?.[1];
      const label = format === "pptx" ? `${names[index].includes("notesSlides") ? "Notas do slide" : "Slide"} ${slide || index + 1}` : names[index] === "word/document.xml" ? "Documento DOCX" : `DOCX — ${names[index].split("/").pop()?.replace(".xml", "")}`;
      chunks.push(...chunksForPage(documentId, index + 1, label, text, chunks.length));
    }
  } else {
    progress("Executando OCR na imagem");
    const { recognize } = await import("tesseract.js");
    const result = await recognize(file, "por+eng", { logger: (event) => event.status && progress(`OCR: ${event.status}${event.progress ? ` ${Math.round(event.progress * 100)}%` : ""}`) });
    chunks.push(...chunksForPage(documentId, 1, "Imagem 1", result.data.text, 0));
  }
  if (!chunks.length || !chunks.some((chunk) => chunk.text.trim())) throw new Error("Nenhum texto legível foi encontrado. O arquivo pode estar corrompido ou ser um PDF somente com imagens.");
  return chunks;
}

const DB_NAME = "nexo-study-documents";
function openLocalDocuments() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("chunks", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalChunks(chunks: DocumentChunk[]) {
  const db = await openLocalDocuments();
  await new Promise<void>((resolve, reject) => { const transaction = db.transaction("chunks", "readwrite"); const store = transaction.objectStore("chunks"); chunks.forEach((chunk) => store.put(chunk)); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  db.close();
}

export async function loadLocalChunks(documentIds: string[]) {
  const db = await openLocalDocuments();
  const all = await new Promise<DocumentChunk[]>((resolve, reject) => { const request = db.transaction("chunks").objectStore("chunks").getAll(); request.onsuccess = () => resolve(request.result as DocumentChunk[]); request.onerror = () => reject(request.error); });
  db.close();
  const selected = new Set(documentIds);
  return all.filter((chunk) => selected.has(chunk.documentId)).sort((a, b) => a.order - b.order);
}

export async function deleteLocalChunks(documentId: string) {
  const chunks = await loadLocalChunks([documentId]);
  const db = await openLocalDocuments();
  await new Promise<void>((resolve, reject) => { const transaction = db.transaction("chunks", "readwrite"); const store = transaction.objectStore("chunks"); chunks.forEach((chunk) => store.delete(chunk.id)); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  db.close();
}
