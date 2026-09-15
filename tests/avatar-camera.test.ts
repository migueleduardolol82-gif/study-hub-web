import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {frameAvatar, measureAvatar} from '../lib/avatar-camera.ts';

function fixture(scale = 1, rigged = true) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.6, 2, .3));
  body.position.y = 1;
  group.add(body);
  if(rigged){const head=new THREE.Bone();head.name='CC_Base_Head';head.position.y=1.7;group.add(head);}
  group.scale.setScalar(scale);
  return measureAvatar(group);
}

test('face framing uses the head landmark and remains proportional across heights', () => {
  const base=fixture();
  const full=frameAvatar(base,'corpo',1,27);
  const face=frameAvatar(base,'rosto',1,27);
  assert.ok(face.target.y>full.target.y);
  assert.ok(face.position.distanceTo(face.target)<full.position.distanceTo(full.target));
  const tall=frameAvatar(fixture(1.3),'rosto',1,27);
  assert.ok(Math.abs(tall.position.z/face.position.z-1.3)<1e-6);
});

test('missing head falls back to bounds; all presets fit a narrow viewport', () => {
  for(const preset of ['corpo','meio','rosto','equipamentos','calcados'] as const){
    const wide=frameAvatar(fixture(1,false),preset,1,27);
    const narrow=frameAvatar(fixture(1,false),preset,.4,27);
    assert.ok(Number.isFinite(narrow.position.z));
    assert.ok(narrow.position.z>=wide.position.z);
  }
});

test('zoom is bounded and shoes focus below half body', () => {
  const base=fixture();
  assert.deepEqual(frameAvatar(base,'rosto',1,27,100),frameAvatar(base,'rosto',1,27,1.8));
  assert.deepEqual(frameAvatar(base,'rosto',1,27,-100),frameAvatar(base,'rosto',1,27,.65));
  assert.ok(frameAvatar(base,'calcados',1,27).target.y<frameAvatar(base,'meio',1,27).target.y);
});
