import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const folder=path.resolve(process.argv[2]??'../wardrobe-production');
const readGLB=buffer=>{
 if(buffer.readUInt32LE(0)!==0x46546c67||buffer.readUInt32LE(4)!==2||buffer.readUInt32LE(8)!==buffer.length)throw Error('Invalid GLB header');
 return JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
};
const base=Buffer.concat(Array.from({length:21},(_,i)=>fs.readFileSync(`public/avatar/roger-male/part-${String(i).padStart(2,'0')}.bin`)));
const reference=JSON.parse(fs.readFileSync(path.join(folder,'reference-inspection.json')));
if(crypto.createHash('sha256').update(base).digest('hex')!==reference.sha256)throw Error('AvatarBase changed: wardrobe reference is stale');
const canonical=readGLB(base),names=new Set(canonical.skins[0].joints.map(i=>canonical.nodes[i].name));
const poses=JSON.parse(fs.readFileSync(path.join(folder,'pose-review.json')));
const report={avatarBaseUnchanged:true,checks:[],catalogueApproved:false,remaining:['Visual seams/UV review','Phone GPU performance and LOD budget','Manual final approval of corrective shapes']};
for(const piece of ['fitted-tee','regular-tee','jogger']){
 const buffer=fs.readFileSync(path.join(folder,`${piece}.glb`)),gltf=readGLB(buffer);
 const primitives=gltf.meshes.flatMap(mesh=>mesh.primitives);
 if(gltf.skins.some(skin=>skin.joints.some(i=>!names.has(gltf.nodes[i].name))))throw Error(`${piece}: foreign bone`);
 if(primitives.some(p=>['WEIGHTS_0','JOINTS_0','TEXCOORD_0','NORMAL'].some(key=>p.attributes[key]===undefined)))throw Error(`${piece}: missing skin or shading attributes`);
 if(!gltf.materials.some(material=>material.normalTexture))throw Error(`${piece}: missing normal texture`);
 const collisions=Object.entries(poses).filter(([,p])=>p[piece].inside_vertices>0).map(([pose,p])=>({pose,...p[piece]}));
 report.checks.push({piece,bytes:buffer.length,joints:gltf.skins[0].joints.length,materials:gltf.materials.map(m=>m.name),poseChecks:Object.keys(poses).length,collisions});
}
fs.writeFileSync(path.join(folder,'release-review.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.checks.some(check=>check.collisions.length))process.exitCode=1;
