import assert from "node:assert/strict";
import test from "node:test";
import { validateDocumentAnalysis } from "../lib/document-analysis.ts";
import { acceptedStudyExtensions, DOCUMENT_CHUNK_CHARS, extractStudyDocument, MAX_STUDY_FILE_BYTES, MAX_STUDY_FILE_MB, MAX_STUDY_FILES, studyFileFormat } from "../lib/study-documents.ts";
import JSZip from "jszip";

test("biblioteca aceita todos os formatos solicitados sem confiar em maiúsculas", () => {
  assert.deepEqual(acceptedStudyExtensions, ["pdf", "docx", "pptx", "txt", "jpg", "jpeg", "png"]);
  for (const extension of acceptedStudyExtensions) assert.equal(studyFileFormat({ name: `material.${extension.toUpperCase()}` }), extension);
  assert.equal(studyFileFormat({ name: "video.mp4" }), null);
  assert.equal(MAX_STUDY_FILES, 12);
  assert.equal(MAX_STUDY_FILE_BYTES, 200 * 1024 * 1024);
  assert.equal(MAX_STUDY_FILE_MB, 200);
  assert.ok(DOCUMENT_CHUNK_CHARS >= 4000);
});

test("análise documental valida o contrato estruturado antes de reutilizar cache", () => {
  const valid = { summary: "Síntese", topics: ["Tópico"], definitions: [], formulas: [], examples: [], warnings: [], references: ["Página 1"] };
  assert.deepEqual(validateDocumentAnalysis(valid), valid);
  assert.throws(() => validateDocumentAnalysis({ ...valid, topics: "não é uma lista" }));
  assert.throws(() => validateDocumentAnalysis({ ...valid, summary: "" }));
});

test("extração lê TXT completo e conteúdo real de DOCX", async () => {
  const text = Array.from({ length: 260 }, (_, index) => `Linha ${index + 1}`).join("\n");
  const txtChunks = await extractStudyDocument(new File([text], "curso.txt", { type: "text/plain" }), "txt", () => undefined);
  assert.equal(txtChunks.length, 3);
  assert.match(txtChunks.map((chunk) => chunk.text).join("\n"), /Linha 260/);

  const zip = new JSZip();
  zip.file("word/document.xml", '<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Conteúdo principal &amp; completo</w:t></w:r></w:p></w:body></w:document>');
  zip.file("word/header1.xml", '<w:hdr xmlns:w="x"><w:p><w:r><w:t>Cabeçalho importante</w:t></w:r></w:p></w:hdr>');
  const docx = new File([await zip.generateAsync({ type: "arraybuffer" })], "curso.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const docxChunks = await extractStudyDocument(docx, "docx", () => undefined);
  assert.match(docxChunks.map((chunk) => chunk.text).join("\n"), /Conteúdo principal & completo/);
  assert.match(docxChunks.map((chunk) => chunk.text).join("\n"), /Cabeçalho importante/);
});

test("extração lê slides e notas de um PPTX", async () => {
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:a="x" xmlns:p="y"><a:t>Conceito do slide</a:t></p:sld>');
  zip.file("ppt/notesSlides/notesSlide1.xml", '<p:notes xmlns:a="x" xmlns:p="y"><a:t>Explicação das notas</a:t></p:notes>');
  const pptx = new File([await zip.generateAsync({ type: "arraybuffer" })], "aula.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  const chunks = await extractStudyDocument(pptx, "pptx", () => undefined);
  assert.match(chunks.map((chunk) => chunk.text).join("\n"), /Conceito do slide/);
  assert.match(chunks.map((chunk) => chunk.text).join("\n"), /Explicação das notas/);
});
