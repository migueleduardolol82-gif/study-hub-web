import { auth } from '@clerk/nextjs/server';
import { isCloudConfigured } from '@/lib/auth-config';
import { AvatarInputError, validateAppearance } from '@/lib/avatar';
import { analyzeAvatarPhoto, AvatarPhotoError, readPhotoBody, validatePhotoImage } from '@/lib/avatar-photo';
import { getOpenAIKey, OpenAIRequestError } from '@/lib/openai';
import { isRecord } from '@/lib/safe-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = {'Cache-Control':'private, no-store'};

export async function POST(request: Request) {
  try {
    if (!isCloudConfigured()) throw new AvatarPhotoError('Conecte sua conta e o banco para usar o avatar.', 503);
    const {userId} = await auth();
    if (!userId) throw new AvatarPhotoError('Entre na sua conta.', 401);
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).host !== request.headers.get('host')) throw new AvatarPhotoError('Origem não autorizada.', 403);
    if (!request.headers.get('content-type')?.includes('application/json')) throw new AvatarPhotoError('Envie uma foto válida.', 415);
    const body = await readPhotoBody(request);
    if (!isRecord(body)) throw new AvatarPhotoError('Selecione uma foto.', 400);
    validatePhotoImage(body.image);
    const current = validateAppearance(body.current);
    const result = await analyzeAvatarPhoto(body.image, current, {key:getOpenAIKey(),model:process.env.OPENAI_VISION_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini'});
    return Response.json({success:true,data:result}, {headers});
  } catch (error) {
    // Never log provider payloads, errors containing upstream text, photos or base64.
    const expected = error instanceof AvatarPhotoError || error instanceof OpenAIRequestError || error instanceof AvatarInputError;
    const status = error instanceof AvatarInputError ? 400 : error instanceof AvatarPhotoError || error instanceof OpenAIRequestError ? error.status : 500;
    return Response.json({success:false,error:{message:expected ? error.message : 'Não foi possível criar a prévia pela foto. Tente novamente.'}}, {status,headers});
  }
}
