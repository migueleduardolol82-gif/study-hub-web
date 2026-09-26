import { aiRoute } from '@/lib/ai-route';
import { createStructuredResponse } from '@/lib/openai';
import { isRecord } from '@/lib/safe-json';

export const runtime = 'nodejs';
export const maxDuration = 120;

const actors = [
  'Fernanda Montenegro', 'Viola Davis', 'Denzel Washington', 'Michelle Yeoh',
  'Keanu Reeves', 'Morgan Freeman', 'Wagner Moura',
] as const;
const schema = {type:'object',additionalProperties:false,required:['line'],properties:{line:{type:'string'}}};

export async function POST(request: Request) {
  return aiRoute(request, '/api/home/inspiration', async body => {
    const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : new Date().toISOString().slice(0, 10);
    const index = [...day].reduce((sum, character) => sum + character.charCodeAt(0), 0) % actors.length;
    const actor = actors[index];
    const result = await createStructuredResponse({
      schema, schemaName:'daily_inspiration', timeoutMs:30000, maxOutputTokens:180, signal:request.signal,
      instructions:'Escreva uma frase inspiradora ORIGINAL em português, de 8 a 20 palavras, para iniciar um painel de estudos e evolução pessoal. Inspire-se de modo amplo na disciplina e trajetória pública do ator informado. Não invente nem reproduza uma citação atribuída a ele; não use aspas, nome próprio, clichês de produtividade ou promessa de sucesso. Tom caloroso e sóbrio. Retorne somente o campo line.',
      input:JSON.stringify({actor,day}),
      validate(value) {
        if (!isRecord(value) || typeof value.line !== 'string') throw new Error('Frase inválida.');
        const line = value.line.trim().replace(/[“”"']/g, '').slice(0, 180);
        if (line.length < 20) throw new Error('Frase muito curta.');
        return {line};
      },
    });
    return {...result, actor, day};
  });
}
