import {readFile} from 'node:fs/promises';
import path from 'node:path';
export const runtime='nodejs';
export async function GET(request:Request){
 if(process.env.NODE_ENV!=='development')return new Response(null,{status:404});
 const piece=new URL(request.url).searchParams.get('piece');
 if(!piece||!['fitted-tee','regular-tee','jogger'].includes(piece))return new Response(null,{status:404});
 try{
  const bytes=await readFile(path.resolve(process.cwd(),'../wardrobe-production',`${piece}.glb`));
  return new Response(bytes,{headers:{'Content-Type':'model/gltf-binary','Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:404});}
}
