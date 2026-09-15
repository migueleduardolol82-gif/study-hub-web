import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const count=21;

test('Roger male web model is complete, optimized and keeps its rigged parts',()=>{
  const parts=Array.from({length:count},(_,index)=>readFileSync(`public/avatar/roger-male/part-${String(index).padStart(2,'0')}.bin`));
  const glb=Buffer.concat(parts);
  assert.equal(glb.subarray(0,4).toString(),'glTF');
  assert.ok(glb.length<15_000_000,'web model should stay below the agreed performance ceiling');
  const jsonLength=glb.readUInt32LE(12);
  const document=JSON.parse(glb.subarray(20,20+jsonLength).toString()) as {nodes:{name?:string}[];materials:{name?:string}[]};
  const nodes=new Set(document.nodes.map(node=>node.name));
  const materials=new Set(document.materials.map(material=>material.name));
  for(const name of ['Roger_Rig','Roger_CC_Base_Body','Roger_CC_Base_Eye','Roger_Short_blowback','CC_Base_L_Upperarm','CC_Base_R_Thigh'])assert.ok(nodes.has(name),`missing ${name}`);
  for(const name of ['Roger_Std_Skin_Head','Roger_Std_Eye_L','Roger_Hair','Roger_Boxers'])assert.ok(materials.has(name),`missing ${name}`);
});

