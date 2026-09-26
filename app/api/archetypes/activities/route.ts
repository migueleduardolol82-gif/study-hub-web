import { aiRoute, InvalidAIRequest } from '@/lib/ai-route';
import { inputText } from '@/lib/ai-pedagogy';
import { createStructuredResponse } from '@/lib/openai';
import { isRecord } from '@/lib/safe-json';

export const runtime = 'nodejs';
export const maxDuration = 120;

const schema = {type:'object',additionalProperties:false,required:['summary','items'],properties:{summary:{type:'string'},items:{type:'array',minItems:3,maxItems:8,items:{type:'object',additionalProperties:false,required:['name','minutes','frequency','notes'],properties:{name:{type:'string'},minutes:{type:'integer',minimum:5,maximum:180},frequency:{type:'string',enum:['daily','weekly']},notes:{type:'string'}}}}}};

export async function POST(request:Request) {
  return aiRoute(request,'/api/archetypes/activities',async body=>{
    const archetype=inputText(body.archetype,120);
    const level=inputText(body.level,20);
    if(!archetype||!['zero','beginner','intermediate','advanced'].includes(level)) throw new InvalidAIRequest('Escolha um arquétipo e um nível válido.');
    return createStructuredResponse({schema,schemaName:'archetype_activities',timeoutMs:105000,maxOutputTokens:2100,signal:request.signal,
      instructions:'Você é um planejador educacional. Crie de 4 a 6 atividades específicas, realistas e progressivas em português para o arquétipo e o nível declarados. Para empresário, inclua empreendedorismo, pesquisa de cliente, proposta de valor, finanças e execução; adapte os temas à profissão ou objetivo informado. Zero deve começar por fundamentos e tarefas de baixa barreira; iniciante por prática guiada; intermediário por projetos e análise; avançado por estratégia e aprofundamento. Não trate o nível declarado como uma avaliação objetiva. Cada atividade deve ser concreta, mensurável, de 5 a 90 minutos e sem inventar datas. Frequência diária ou semanal. Escreva notes com resultado esperado e por que cabe ao nível. As sugestões serão revisadas antes de serem adicionadas.',
      input:JSON.stringify({archetype,level,objetivos:Array.isArray(body.milestones)?body.milestones.slice(0,8).map(item=>inputText(item,160)):[],atividadesAtuais:Array.isArray(body.existing)?body.existing.slice(0,20).map(item=>inputText(item,120)):[]}),
      validate(value){
        if(!isRecord(value)||typeof value.summary!=='string'||!Array.isArray(value.items)) throw new Error('Atividades inválidas.');
        const items=value.items.slice(0,8).map(item=>{
          if(!isRecord(item)||typeof item.name!=='string'||!item.name.trim()||!['daily','weekly'].includes(String(item.frequency))) throw new Error('Atividade incompleta.');
          return {name:item.name.trim().slice(0,120),minutes:Math.max(5,Math.min(180,Number(item.minutes)||15)),frequency:item.frequency,notes:typeof item.notes==='string'?item.notes.slice(0,400):''};
        });
        if(items.length<3) throw new Error('A IA gerou poucas atividades. Tente novamente.');
        return {summary:value.summary.slice(0,500),items};
      }
    });
  });
}
