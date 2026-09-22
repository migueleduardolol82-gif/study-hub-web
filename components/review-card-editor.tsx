"use client";
import { useState } from "react";
import type { LearningExercise } from "@/lib/learning";
import type { CardEdit } from "@/lib/review-customization";

export function ReviewCardEditor({ exercise, onSave, onCancel, onRestore }: { exercise: LearningExercise; onSave: (edit: CardEdit) => void; onCancel: () => void; onRestore: () => void }) {
  const [prompt, setPrompt] = useState(exercise.prompt);
  const [answer, setAnswer] = useState(exercise.answer);
  const [explanation, setExplanation] = useState(exercise.explanation);
  const [criteria, setCriteria] = useState((exercise.essentialCriteria || [exercise.answer]).join("\n"));
  const [error, setError] = useState("");
  return <form className="review-card-editor" aria-label="Editar flashcard" onSubmit={event => { event.preventDefault(); try { onSave({ prompt, answer, explanation, essentialCriteria: criteria.split("\n") }); } catch (error) { setError(error instanceof Error ? error.message : "Revise os campos."); } }}>
    <h3>Editar flashcard</h3><p>Sua edição será usada nas próximas respostas. O histórico anterior e o cartão original serão preservados.</p>
    <label>Pergunta<textarea required maxLength={1200} value={prompt} onChange={event => setPrompt(event.target.value)} /></label>
    <label>Resposta<textarea required maxLength={3000} value={answer} onChange={event => setAnswer(event.target.value)} /></label>
    <label>Explicação<textarea maxLength={3000} value={explanation} onChange={event => setExplanation(event.target.value)} /></label>
    <label>Pontos essenciais para a correção (um por linha, até 12)<textarea required value={criteria} maxLength={12012} onChange={event => setCriteria(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <div><button type="submit">Salvar edição</button><button type="button" onClick={onCancel}>Cancelar</button><button type="button" onClick={onRestore}>Restaurar original</button></div>
  </form>;
}
