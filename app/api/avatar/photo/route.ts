import { auth } from '@clerk/nextjs/server';
import { isCloudConfigured } from '@/lib/auth-config';
import { validateAppearance, type Appearance } from '@/lib/avatar';
import { OPENAI_API_URL, extractOutputText, getOpenAIKey, OpenAIRequestError } from '@/lib/openai';
import { isRecord, parseJsonSafely } from '@/lib/safe-json';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const schema={
  type:'object',
  additionalProperties:false,
  required:['shape','skin','hairColor','eyeColor','hair','face','beardStyle','confidence','observations'],
  properties:{
    shape:{type:'string',enum:['masculino','feminino','neutro']},
    skin:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},
    hairColor:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},
    eyeColor:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},
    hair:{type:'string',enum:['social','moderno','bagunçado','ondulado','heroico','longo','raspado']},
    face:{type:'string',enum:['oval','angular','arredondado']},
    beardStyle:{type:'string',enum:['sem barba','barba curta','barba marcada','cavanhaque']},
    confidence:{type:'integer',minimum:0,maximum:100},
    observations:{type:'array',minItems:2,maxItems:5,items:{type:'string',minLength:2,maxLength:120}}
  }
};

function validatePhotoResult(value:unknown,current:Appearance){
  if(!isRecord(value))throw new Error('Resposta visual inválida.');
  const observations=Array.isArray(value.observations)?value.observations.filter(item=>typeof item==='string').slice(0,5):[];
  const confidence=Number(value.confidence);
  if(!Number.isInteger(confidence)||confidence<0||confidence>100||observations.length<2)throw new Error('Resposta visual incompleta.');
  const beardStyle=String(value.beardStyle) as Appearance['beardStyle'];
  const appearance=validateAppearance({...current,shape:value.shape,skin:value.skin,hairColor:value.hairColor,eyeColor:value.eyeColor,hair:value.hair,face:value.face,beardStyle,beard:beardStyle!=='sem barba'});
  return {appearance,confidence,observations};
}

export async function POST(request:Request){
  try{
    if(!isCloudConfigured())return Response.json({success:false,error:{message:'Conecte sua conta e o banco para usar o avatar.'}},{status:503});
    const {userId}=await auth();if(!userId)return Response.json({success:false,error:{message:'Entre na sua conta.'}},{status:401});
    const origin=request.headers.get('origin');
    if(!origin||new URL(origin).host!==request.headers.get('host'))return Response.json({success:false,error:{message:'Origem não autorizada.'}},{status:403});
    if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({success:false,error:{message:'Envie uma foto válida.'}},{status:415});
    if(Number(request.headers.get('content-length')||0)>4000000)return Response.json({success:false,error:{message:'A foto preparada ficou muito grande. Escolha outra imagem.'}},{status:413});
    let body:unknown;try{body=await request.json();}catch{return Response.json({success:false,error:{message:'A solicitação da foto é inválida.'}},{status:400});}
    if(!isRecord(body)||typeof body.image!=='string')return Response.json({success:false,error:{message:'Selecione uma foto.'}},{status:400});
    if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.image)||body.image.length>3800000)return Response.json({success:false,error:{message:'A foto não possui um formato aceito.'}},{status:400});
    const current=validateAppearance(body.current);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),40000);
    let response:Response;let raw:string;
    try{
      const model=process.env.OPENAI_VISION_MODEL||process.env.OPENAI_TEXT_MODEL||'gpt-5-mini';
      response=await fetch(OPENAI_API_URL+'/responses',{method:'POST',headers:{Authorization:'Bearer '+getOpenAIKey(),'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({
        model,store:false,max_output_tokens:900,
        reasoning:/^gpt-5(?:[.-]|$)/i.test(model)?{effort:'low'}:undefined,
        instructions:'Analise somente características visuais observáveis para criar um avatar anime 3D adulto e premium. Não identifique a pessoa, não infira saúde, etnia, idade exata, peso, percentual de gordura ou massa muscular. Escolha apenas valores permitidos pelo schema. Use cores hex aproximadas e observações curtas em português.',
        input:[{role:'user',content:[{type:'input_text',text:'Crie uma configuração visual fiel aos traços observáveis desta foto. Preserve as medidas corporais fornecidas separadamente pelo usuário.'},{type:'input_image',image_url:body.image}]}],
        text:{format:{type:'json_schema',name:'avatar_photo',strict:true,schema}}
      })});
      raw=await response.text();
    }catch(error){
      const timedOut=error instanceof Error&&error.name==='AbortError';
      throw new OpenAIRequestError(timedOut?'OPENAI_TIMEOUT':'OPENAI_UNAVAILABLE',timedOut?'A análise da foto demorou demais. Tente novamente.':'Não foi possível analisar a foto agora.',503,true,error instanceof Error?error.message:String(error));
    }finally{clearTimeout(timeout);}
    let payload:unknown=null;try{payload=parseJsonSafely(raw);}catch{}
    if(!response.ok){
      console.error('avatar_photo_provider_failed',{status:response.status,detail:raw.slice(0,300).replace(/sk-[a-zA-Z0-9_-]+/g,'[redacted]')});
      const message=response.status===429?'O limite de uso da IA foi atingido. Tente novamente depois.':'A IA não conseguiu analisar esta foto.';
      return Response.json({success:false,error:{message}},{status:response.status===429?429:502});
    }
    if(!isRecord(payload))throw new Error('Resposta sem JSON.');
    const result=validatePhotoResult(parseJsonSafely(extractOutputText(payload as Parameters<typeof extractOutputText>[0])),current);
    return Response.json({success:true,data:result},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(error instanceof OpenAIRequestError){
      console.error('avatar_photo_ai_failed',{code:error.code,detail:error.technicalMessage});
      return Response.json({success:false,error:{message:error.message}},{status:error.status});
    }
    console.error('avatar_photo_failed',error);
    return Response.json({success:false,error:{message:'Não foi possível criar a prévia pela foto. Tente novamente.'}},{status:500});
  }
}
