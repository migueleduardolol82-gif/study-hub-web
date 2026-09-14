import { auth } from '@clerk/nextjs/server';
import { isCloudConfigured } from '@/lib/auth-config';
import { AvatarInputError } from '@/lib/avatar';
import { mutateAvatar, readAvatar } from '@/lib/avatar-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request) {
 try {
  if(!isCloudConfigured()) return Response.json({success:false,error:{message:'Conecte sua conta e o banco para usar o avatar.'}},{status:503});
  const {userId}=await auth();if(!userId)return Response.json({success:false,error:{message:'Entre na sua conta.'}},{status:401});
  if(request.method==='POST'){
   const origin=request.headers.get('origin');
   if(!origin||new URL(origin).host!==request.headers.get('host'))return Response.json({success:false,error:{message:'Origem não autorizada.'}},{status:403});
   if(!request.headers.get('content-type')?.includes('application/json'))throw new AvatarInputError('Envie uma solicitação JSON.');
   if(Number(request.headers.get('content-length')||0)>12000)throw new AvatarInputError('Solicitação muito grande.');
   const raw=await request.text();if(raw.length>12000)throw new AvatarInputError('Solicitação muito grande.');
   let body:unknown;try{body=JSON.parse(raw);}catch{throw new AvatarInputError('Solicitação inválida.');}
   if(!body||typeof body!=='object'||Array.isArray(body))throw new AvatarInputError('Solicitação inválida.');
   return Response.json({success:true,data:await mutateAvatar(userId,body as Record<string,unknown>)},{headers:{'Cache-Control':'private, no-store'}});
  }
  return Response.json({success:true,data:await readAvatar(userId)},{headers:{'Cache-Control':'private, no-store'}});
 } catch(error) {
  if(error instanceof AvatarInputError)return Response.json({success:false,error:{message:error.message}},{status:400});
  console.error('avatar_request_failed',error);
  return Response.json({success:false,error:{message:'Não foi possível acessar o avatar. Tente novamente.'}},{status:500});
 }
}
export const GET=handle;export const POST=handle;
