import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { avatarHairStyles, facialControls, initialAppearance, newAvatar, resolveFacial, validateAppearance } from '../lib/avatar.ts';
import { createAvatarHead, createFaceGeometry, createHairGeometry, disposeAvatarObject } from '../lib/avatar-head.ts';
import { analyzeAvatarPhoto, AvatarPhotoError, readPhotoBody, validatePhotoImage, validatePhotoResult } from '../lib/avatar-photo.ts';

const fixture = () => ({suitability:'ok',skin:'#b8896a',hairColor:'#292323',eyeColor:'#647d91',hair:'moderno',face:'oval',beardStyle:'sem barba',hairLength:1.12,facial:resolveFacial(initialAppearance),observations:['Proporções aproximadas; ajuste a prévia.']});
const image = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(40)]).toString('base64');

test('legacy JSON saves remain unchanged and resolve neutral facial multipliers', () => {
  const account = newAvatar('2026-09-14');
  const saved = JSON.stringify(account);
  assert.deepEqual(validateAppearance(account.appearance), account.appearance);
  assert.ok(Object.values(resolveFacial(account.appearance)).every(n => n === 1));
  assert.equal(JSON.stringify(account), saved);
});

test('new proportions persist through validation and JSON without adding wallet fields', () => {
  const a = {...initialAppearance, facial:{jawWidth:1.12,eyeSpacing:0.9}, hairLength:1.3,realism:0.8};
  assert.deepEqual(validateAppearance(JSON.parse(JSON.stringify({...a,balance:123,facial:{...a.facial,unknown:500}}))), a);
  for (const bad of [NaN,Infinity,-1,'1',null]) assert.throws(() => validateAppearance({...a,facial:{noseWidth:bad}}));
  assert.throws(() => validateAppearance({...a,facial:[]}));
  assert.throws(() => validateAppearance({...a,hairLength:8}));
});

test('photo allowlist cannot overwrite body, gender presentation or chosen realism', () => {
  const current = {...initialAppearance,height:190,weight:100,shape:'neutro' as const,realism:0.8};
  const result = validatePhotoResult({...fixture(),shape:'feminino',fat:5,muscle:100,weight:35,realism:0,confidence:99},current);
  for (const key of ['shape','height','weight','fat','muscle','realism'] as const) assert.equal(result.appearance[key],current[key]);
  assert.equal('confidence' in result,false);
  const adjusted = validateAppearance({...result.appearance,facial:{...result.appearance.facial,noseWidth:1.2}});
  assert.equal(JSON.parse(JSON.stringify(adjusted)).facial.noseWidth,1.2);
});

test('photo rejects missing, multiple, obscured or unsuitable faces and malformed proportions', () => {
  for (const suitability of ['no_face','multiple_faces','unclear','unsuitable']) assert.throws(() => validatePhotoResult({...fixture(),suitability},initialAppearance), (e: unknown) => e instanceof AvatarPhotoError && e.status === 422);
  for (const result of [{...fixture(),facial:{}},{...fixture(),beardStyle:undefined},{...fixture(),facial:{...fixture().facial,noseWidth:9}},{...fixture(),observations:[]},null]) assert.throws(() => validatePhotoResult(result,initialAppearance));
});

test('photo format checks reject forged data URLs and oversize streaming bodies', async () => {
  validatePhotoImage(image);
  assert.throws(() => validatePhotoImage('data:image/png;base64,' + Buffer.alloc(100).toString('base64')));
  assert.throws(() => validatePhotoImage('data:image/jpeg;base64,not-an-image'));
  const body = new ReadableStream({start(c) {c.enqueue(new Uint8Array(4_000_001));c.close();}});
  const request = new Request('https://example.test',{method:'POST',body,duplex:'half'} as RequestInit);
  await assert.rejects(readPhotoBody(request),(e: unknown) => e instanceof AvatarPhotoError && e.status === 413);
});

test('mocked photo provider uses nonstored structured output, sends no body measurements', async () => {
  const fetcher: typeof fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.store,false); assert.equal(body.text.format.strict,true);
    const input = body.input[0].content[0].text;
    assert.equal(input.includes('weight'),false); assert.equal(input.includes('shape'),false);
    return Response.json({output_text:JSON.stringify(fixture())});
  };
  const result = await analyzeAvatarPhoto(image,initialAppearance,{key:'fixture-only',model:'gpt-5-mini',fetcher});
  assert.equal(result.appearance.hairLength,1.12);
});

test('provider failures, refusal, malformed JSON and timeout become safe errors', async () => {
  for (const status of [429,500]) await assert.rejects(analyzeAvatarPhoto(image,initialAppearance,{key:'fixture-only',model:'gpt-5-mini',fetcher:async()=>new Response('sensitive upstream payload',{status})}), (e: unknown)=>e instanceof AvatarPhotoError && !e.message.includes('sensitive'));
  for (const payload of [{output:[{content:[{type:'refusal',refusal:'no'}]}]},{output_text:'not JSON'}]) await assert.rejects(analyzeAvatarPhoto(image,initialAppearance,{key:'fixture-only',model:'gpt-5-mini',fetcher:async()=>Response.json(payload)}));
  const timeoutFetcher: typeof fetch = async (_url, options) => new Promise((_resolve,reject) => options?.signal?.addEventListener('abort',()=>reject(new Error('sensitive error'))));
  await assert.rejects(analyzeAvatarPhoto(image,initialAppearance,{key:'fixture-only',model:'gpt-5-mini',fetcher:timeoutFetcher,timeoutMs:5}), (e: unknown)=>e instanceof AvatarPhotoError && e.status===503 && e.message.includes('demorou'));
});

test('all facial extremes and hair styles produce finite bounded geometry with lower mobile cost', () => {
  for (const bound of [2,3] as const) {
    const a = {...initialAppearance,facial:Object.fromEntries(facialControls.map(c=>[c[0],c[bound]]))};
    const face = createFaceGeometry(a); face.computeBoundingBox();
    assert.ok(Array.from(face.getAttribute('position').array).every(Number.isFinite));
    assert.ok((face.boundingBox?.max.y ?? 1) < 0.4); face.dispose();
  }
  for (const hair of avatarHairStyles) {
    const high = createHairGeometry({...initialAppearance,hair,hairLength:1.5});
    const low = createHairGeometry({...initialAppearance,hair,hairLength:1.5},true);
    assert.ok(high.getAttribute('position').count < 8000);
    assert.ok(low.getAttribute('position').count < high.getAttribute('position').count);
    assert.ok(Array.from(high.getAttribute('position').array).every(Number.isFinite)); high.dispose();low.dispose();
  }
});

test('head detail and equipped band share one pivot; reduced motion stops it; all GPU resources dispose', () => {
  const head = createAvatarHead({...initialAppearance,beard:true,beardStyle:'barba marcada'},'#799eaf');
  const meshes: THREE.Mesh[] = []; head.group.traverse(o => {if(o instanceof THREE.Mesh) meshes.push(o);});
  assert.ok(meshes.length < 45);
  assert.ok(meshes.every(mesh => mesh.parent === head.group));
  head.update(2,false); assert.notEqual(head.group.rotation.z,0); head.update(3,true); assert.equal(head.group.rotation.z,0);
  let disposed=0;
  meshes.forEach(mesh => mesh.geometry.addEventListener('dispose',()=>disposed++));
  disposeAvatarObject(head.group); assert.equal(disposed,meshes.length);
});
