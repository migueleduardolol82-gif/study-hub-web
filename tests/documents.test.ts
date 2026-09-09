import assert from "node:assert/strict";
import test from "node:test";
import { validateDocumentAnalysis } from "../lib/document-analysis.ts";
import { acceptedStudyExtensions, DOCUMENT_CHUNK_CHARS, MAX_STUDY_FILE_BYTES, MAX_STUDY_FILES, studyFileFormat } from "../lib/study-documents.ts";

test("biblioteca aceita todos os formatos solicitados sem confiar em maiúsculas", () => {
  assert.deepEqual(acceptedStudyExtensions, ["pdf", "docx", "pptx", "txt", "jpg", "jpeg", "png"]);
  for (const extension of acceptedStudyExtensions) assert.equal(studyFileFormat({ name: `material.${extension.toUpperCase()}` }), extension);
  assert.equal(studyFileFormat({ name: "video.mp4" }), null);
  assert.equal(MAX_STUDY_FILES, 12);
  assert.equal(MAX_STUDY_FILE_BYTES, 30 * 1024 * 1024);
  assert.ok(DOCUMENT_CHUNK_CHARS >= 4000);
});

test("análise documental valida o contrato estruturado antes de reutilizar cache", () => {
  const valid = { summary: "Síntese", topics: ["Tópico"], definitions: [], formulas: [], examples: [], warnings: [], references: ["Página 1"] };
  assert.deepEqual(validateDocumentAnalysis(valid), valid);
  assert.throws(() => validateDocumentAnalysis({ ...valid, topics: "não é uma lista" }));
  assert.throws(() => validateDocumentAnalysis({ ...valid, summary: "" }));
});
