import assert from 'node:assert/strict';
import test from 'node:test';
import { initialTimer, nextTimerPhase, remainingTime, restoreTimer } from '../lib/study-timer.ts';
import { buildStudySchedule } from '../lib/study-planning.ts';
import { validateLessonContent, validateOutline } from '../lib/learning-generation.ts';
import { relevantMaterial } from '../lib/ai-pedagogy.ts';

test('timer calcula pelo relógio real mesmo após a aba ficar suspensa', () => {
  const timer = { ...initialTimer(), running: true, endsAt: 61000, sessionId: 'test-focus' };
  assert.equal(remainingTime(timer, 1000), 60);
  assert.equal(remainingTime(timer, 51500), 10);
  assert.equal(remainingTime(timer, 90000), 0);
  assert.equal(remainingTime({ ...timer, running: false, remainingSeconds: 17 }, 90000), 17);
});

test('pomodoro alterna foco/pausa e oferece pausa longa no quarto ciclo', () => {
  let timer = initialTimer({ technique: 'pomodoro', focusMinutes: 37, shortBreakMinutes: 7, longBreakMinutes: 22, cycles: 4 });
  for (let cycle = 1; cycle <= 4; cycle++) {
    timer = nextTimerPhase(timer);
    assert.equal(timer.phase, cycle === 4 ? 'longBreak' : 'shortBreak');
    assert.equal(timer.remainingSeconds, (cycle === 4 ? 22 : 7) * 60);
    assert.equal(timer.running, false);
    assert.equal(timer.completedCycles, cycle);
    timer = nextTimerPhase(timer);
    assert.equal(timer.phase, 'focus');
    assert.equal(timer.remainingSeconds, 37 * 60);
    assert.equal(timer.completedCycles, cycle);
  }
});

test('timer restaurado mantém duração e sessão e ignora configuração inválida', () => {
  const timer = { ...initialTimer(), running: true, endsAt: 61000, sessionId: 'keep-me', sessionMinutes: 17, topic: 'Álgebra' };
  assert.deepEqual(restoreTimer(JSON.parse(JSON.stringify(timer))), timer);
  assert.equal(restoreTimer({ settings: { focusMinutes: -1 } }).sessionMinutes, 50);
});

test('plano respeita minutos personalizados por dia e não modifica as etapas', () => {
  const steps = [{ title: 'Funções', study: 'Explicar parâmetros', practice: 'Implementar uma função', review: 'Recordar entradas e saídas', difficulty: 'easy' as const }];
  const before = JSON.stringify(steps);
  const weeks = buildStudySchedule({ steps, weeks: 2, days: 3, minutes: 17, dayMinutes: [11, 29, 73], prefix: 'plan-one' });
  assert.equal(weeks.length, 2);
  for (const week of weeks) assert.deepEqual(week.sessions.map((s) => s.minutes), [11, 29, 73]);
  assert.equal(new Set(weeks.flatMap((w) => w.sessions.map((s) => s.id))).size, 6);
  assert.equal(JSON.stringify(steps), before);
  assert.throws(() => buildStudySchedule({ steps, weeks: 2, days: 3, minutes: 0, prefix: 'bad' }));
});

test('planejamento é salvo sem inventar exercícios prontos', () => {
  const path = validateOutline({ title: 'Python', units: Array.from({length: 3}, (_, i) => ({ title: `Unidade ${i}`, description: 'Aprender uma habilidade', lessons: Array.from({length: 2}, (_, j) => ({title: `Lição ${j}`, description: 'Aplicar uma técnica', difficulty: 'iniciante'})) })) });
  assert.equal(path.units.flatMap((u) => u.lessons).length, 6);
  assert.ok(path.units.every((u) => u.lessons.every((l) => l.exercises.length === 0 && l.id)));
  assert.equal(new Set(path.units.flatMap((u) => u.lessons.map((l) => l.id))).size, 6);
});

test('lição rejeita resposta ausente, alternativas duplicadas e ordenação inválida', () => {
  const exercise = { type: 'multiple_choice', prompt: 'Quanto é 2 + 2?', options: ['1','2','3','4'], answer: '4', explanation: 'Somamos duas unidades a duas unidades.' };
  const content = { studyNotes: 'Adição', exercises: Array.from({length: 4}, () => ({...exercise})) };
  assert.equal(validateLessonContent(content).exercises.length, 4);
  assert.throws(() => validateLessonContent({ ...content, exercises: [{...exercise, answer: '5'}, ...content.exercises.slice(1)] }));
  assert.throws(() => validateLessonContent({ ...content, exercises: [{...exercise, options: ['1','2','4','4']}, ...content.exercises.slice(1)] }));
  assert.throws(() => validateLessonContent({ ...content, exercises: [{...exercise, type: 'ordering', answer: '1|1|3|4'}, ...content.exercises.slice(1)] }));
});

test('material relevante é selecionado mesmo quando está depois das primeiras páginas', () => {
  const text = 'Texto de introdução. '.repeat(2000) + 'DERIVADAS regra da cadeia aplicada a funções compostas. '.repeat(100);
  assert.match(relevantMaterial(text, 'derivadas regra cadeia', 6400), /DERIVADAS/);
});
