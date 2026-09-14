const { chromium } = await import(process.env.PLATFORM_PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';

const url = process.env.PLATFORM_TEST_URL || 'http://127.0.0.1:3103';
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLATFORM_CHROMIUM_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const now = '2026-09-14T12:00:00.000Z';
    localStorage.setItem('nexo-dashboard-v6', JSON.stringify({
      journeys: [
        { id: 'journey-search-one', name: 'Maratona Aurora', category: 'Corrida', icon: '🏃', color: '#d0ff65', objective: 'Correr 42 km', status: 'active', startDate: '2026-09-14', metricName: 'Distância', metricUnit: 'km', target: 42, current: 12, activities: [], sourceThemeIds: [], sourceMapIds: [], createdAt: now, updatedAt: now },
        { id: 'journey-search-two', name: 'Projeto Nebulosa', category: 'Projeto', icon: '✦', color: '#765ee8', objective: 'Publicar o projeto', status: 'active', startDate: '2026-09-14', metricName: 'Progresso', metricUnit: '%', target: 100, current: 30, activities: [], sourceThemeIds: [], sourceMapIds: [], createdAt: now, updatedAt: now }
      ],
      studyPlans: [{ id: 'plan-search', name: 'Plano Órbita', createdAt: now, weeks: [{ week: 1, theme: 'Fundamentos orbitais', sessions: [{ id: 'session-search', day: 'Segunda', topic: 'Gravidade', activity: 'Revisar conceitos', minutes: 40, done: false }] }] }],
      activePlanId: '',
      learningPaths: [{ id: 'path-search', title: 'Trilha Constelação', createdAt: now, updatedAt: now, units: [{ id: 'unit-search', title: 'Unidade Estelar', description: 'Astronomia básica', lessons: [{ id: 'lesson-search', title: 'Primeira estrela', description: 'Introdução', difficulty: 'iniciante', xp: 10, exercises: [] }] }] }],
      learningProgress: {},
      documents: [{ id: 'doc-search', name: 'material-cosmos.pdf', format: 'pdf', size: 1024, hash: 'fixture', priority: 1, selected: false, pageCount: 1, charCount: 100, status: 'ready', stage: 'Pronto', createdAt: now }]
    }));
  });
  await page.goto(url);

  const search = page.getByLabel('Pesquisar em toda a plataforma');
  await search.fill('Nebulosa');
  await page.getByRole('option', { name: /Projeto Nebulosa/ }).click();
  await page.getByRole('heading', { name: 'Projeto Nebulosa' }).waitFor();
  assert.equal(await page.getByLabel('Pesquisar jornadas').inputValue(), 'Projeto Nebulosa');
  assert.equal(await page.locator('.journey-card').count(), 1);

  await search.fill('Órbita');
  await page.getByRole('option', { name: /Plano Órbita/ }).click();
  await page.getByText('PLANO ÓRBITA', { exact: true }).waitFor();
  await page.getByText('Fundamentos orbitais', { exact: true }).waitFor();

  await search.fill('Constelação');
  await page.getByRole('option', { name: /Trilha Constelação/ }).click();
  await page.getByRole('heading', { name: 'Trilha Constelação' }).waitFor();

  await search.fill('material-cosmos');
  await page.getByRole('option', { name: /material-cosmos\.pdf/ }).click();
  await page.getByRole('dialog', { name: 'Criar nova trilha' }).waitFor();
  const documentRow = page.locator('.document-list article').filter({ hasText: 'material-cosmos.pdf' });
  await documentRow.waitFor();
  assert.equal(await documentRow.getByRole('checkbox').isChecked(), true);
  assert.deepEqual(errors, []);
  console.log('Global search opens the exact journey, plan, learning path and selected document.');
} finally {
  await browser.close();
}
