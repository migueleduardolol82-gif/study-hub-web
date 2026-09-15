import { createHash } from "node:crypto";
import 'server-only';
import { getDatabase } from '@/lib/db';
import { avatarItems, AvatarInputError, ensureAvatarDefaults, newAvatar, purchase, setAvatarItemColor, validateAppearance, type AvatarAccount } from '@/lib/avatar';
import { syncAvatarEvidence } from '@/lib/avatar-evidence';
let initialized:Promise<void>|undefined;
async function database(){
 const sql=getDatabase();
 initialized??=(async()=>{
  await sql`CREATE TABLE IF NOT EXISTS nexo_avatar (user_id TEXT PRIMARY KEY, data JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 0)`;
  await sql`CREATE TABLE IF NOT EXISTS nexo_avatar_audit (id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL,revision INTEGER NOT NULL,action TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,revision))`;
 })().catch(e=>{initialized=undefined;throw e;});
 await initialized;return sql;
}
export async function readAvatar(userId:string){
 const sql=await database();
 await sql`INSERT INTO nexo_avatar(user_id,data) VALUES(${userId},${JSON.stringify(newAvatar(new Date().toISOString()))}::jsonb) ON CONFLICT DO NOTHING`;
 const [row]=await sql`SELECT data FROM nexo_avatar WHERE user_id=${userId}`;
 return ensureAvatarDefaults(row.data as AvatarAccount);
}
export async function mutateAvatar(userId:string,body:Record<string,unknown>,onlyExisting=false){
 const sql=await database();
 for(let attempt=0;attempt<3;attempt++) {
  const [row]=await sql`SELECT data,revision FROM nexo_avatar WHERE user_id=${userId}`;
  if(!row){if(onlyExisting)return null;throw new AvatarInputError('Abra o avatar antes de salvar.');}
  const account=ensureAvatarDefaults(row.data as AvatarAccount);const now=new Date().toISOString();
  if(body.action==='appearance') {
   const appearance=validateAppearance(body.appearance);
   if(JSON.stringify(account.appearance)===JSON.stringify(appearance)&&account.history.length)return account;
   account.appearance=appearance;account.history.push({at:now,appearance:{...appearance}});
  } else if(body.action==='buy') {if(typeof body.id!=='string')throw new AvatarInputError('Escolha um item.');purchase(account,body.id,now);}
  else if(body.action==='equip') {const item=avatarItems.find(i=>i.id===body.id);if(!item||!account.inventory.includes(item.id))throw new AvatarInputError('Item não disponível no inventário.');account.equipped[item.slot]=item.id;}
  else if(body.action==='unequip') {if(typeof body.slot!=='string'||!avatarItems.some(i=>i.slot===body.slot))throw new AvatarInputError('Slot inválido.');delete account.equipped[body.slot];}
  else if(body.action==='item-color') {if(typeof body.id!=='string'||typeof body.color!=='string')throw new AvatarInputError('Escolha uma cor para o item.');setAvatarItemColor(account,body.id,body.color);}
  else if(body.action==='sync') {
   const rows=await sql`SELECT state FROM nexo_user_state WHERE user_id=${userId}`;
   const state=rows[0]?.state;
   const fingerprint=createHash("sha256").update(JSON.stringify([state?.routine,state?.learningProgress,state?.skillTracks,state?.primaryArchetypeId,state?.secondaryArchetypeId,state?.tertiaryArchetypeId])).digest("hex");
   if(account.evidence?.fingerprint===fingerprint)return account;
   syncAvatarEvidence(account,state,now);
   if(account.evidence)account.evidence.fingerprint=fingerprint;
  } else throw new AvatarInputError('Ação desconhecida.');
  // Revision compare-and-swap: wallet, inventory, checkpoints and audit commit together.
  const updated=await sql`WITH changed AS (UPDATE nexo_avatar SET data=${JSON.stringify(account)}::jsonb,revision=revision+1 WHERE user_id=${userId} AND revision=${row.revision} RETURNING revision) INSERT INTO nexo_avatar_audit(user_id,revision,action) SELECT ${userId},revision,${String(body.action)} FROM changed RETURNING revision`;
  if(updated.length)return account;
 }
 throw new AvatarInputError('Outra alteração foi salva ao mesmo tempo. Atualize e tente novamente.');
}
