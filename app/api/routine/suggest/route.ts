import { aiRoute, InvalidAIRequest } from '@/lib/ai-route';
import { inputText } from '@/lib/ai-pedagogy';
import { createStructuredResponse } from '@/lib/openai';
import { isRecord } from '@/lib/safe-json';

export const runtime = 'nodejs';
export const maxDuration = 120;

const str = {type:'string'};
const schema = {type:'object',additionalProperties:false,required:['summary','items'],properties:{summary:str,items:{type:'array',minItems:1,maxItems:20,items:{type:'object',additionalProperties:false,required:['name','kind','date','frequency','days','times','target','unit','minutes','notes','skill'],properties:{name:str,kind:{type:'string',enum:['habit','training','exam']},date:str,frequency:{type:'string',enum:['daily','days','weekly','monthly','once']},days:{type:'array',items:{type:'integer',minimum:0,maximum:6}},times:{type:'integer',minimum:1,maximum:31},target:{type:'number',exclusiveMinimum:0},unit:str,minutes:{type:'integer',minimum:1,maximum:1440},notes:str,skill:str}}}}};

export async function POST(request:Request) {
  return aiRoute(request,'/api/routine/suggest',async body=>{
    const content=inputText(body.content,60000);
    if(content.length<30) throw new InvalidAIRequest('Envie um texto ou documento com detalhes da rotina.');
    return createStructuredResponse({schema,schemaName:'routine_suggestions',timeoutMs:105000,maxOutputTokens:4500,signal:request.signal,
      instructions:'Analise o texto como um planejador cuidadoso. Extraia somente hábitos, treinos e datas de provas sustentados pela fonte. Identifique tipo de treino, volume, unidade, duração, recorrência e data quando estiverem explícitos. Não invente dias ou datas: na ausência de data use string vazia; na ausência de duração use estimativa conservadora e explique em notes. Para cada sugestão escreva notes concisas com a evidência ou a suposição. Dia da semana: domingo=0. Se houver prazo, preserve a data ISO. Retorne no máximo 20 itens distintos. Responda em português. As sugestões serão revisadas pelo usuário antes de salvar.',
      input:JSON.stringify({hoje:inputText(body.today,20),habilidadesExistentes:Array.isArray(body.skills)?body.skills.slice(0,30):[],texto:content}),
      validate(value){
        if(!isRecord(value)||!Array.isArray(value.items)||typeof value.summary!=='string') throw new Error('Sugestões inválidas.');
        const items=value.items.slice(0,20).map(item=>{
          if(!isRecord(item)||typeof item.name!=='string'||!item.name.trim()||!['habit','training','exam'].includes(String(item.kind))||!['daily','days','weekly','monthly','once'].includes(String(item.frequency))) throw new Error('Atividade incompleta.');
          return {name:item.name.trim().slice(0,120),kind:item.kind,date:typeof item.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)?item.date:'',frequency:item.frequency,days:Array.isArray(item.days)?item.days.filter((day):day is number=>Number.isInteger(day)&&day>=0&&day<=6):[],times:Math.max(1,Math.min(31,Number(item.times)||1)),target:Math.max(.1,Number(item.target)||1),unit:typeof item.unit==='string'?item.unit.slice(0,30):'vez',minutes:Math.max(1,Math.min(1440,Number(item.minutes)||15)),notes:typeof item.notes==='string'?item.notes.slice(0,400):'',skill:typeof item.skill==='string'?item.skill.slice(0,80):''};
        });
        if(!items.length) throw new Error('Nenhuma atividade identificada.');
        return {summary:value.summary.slice(0,600),items};
      }
    });
  });
}
