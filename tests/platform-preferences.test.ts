import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPlatformPreferences,moveWidget,normalizePlatformPreferences} from '../lib/platform-preferences.ts';

test('preferências antigas recebem tema e widgets sem alterar o objeto original',()=>{
  const legacy={palette:'apagada',customAccent:'red',widgets:['today','today','desconhecido']};
  const before=JSON.stringify(legacy),value=normalizePlatformPreferences(legacy);
  assert.deepEqual(value,{...defaultPlatformPreferences,widgets:['today']});
  assert.equal(JSON.stringify(legacy),before);
  assert.notEqual(normalizePlatformPreferences(null).widgets,defaultPlatformPreferences.widgets);
});

test('widgets são reordenados dentro dos limites sem mutação',()=>{
  const widgets=[...defaultPlatformPreferences.widgets];
  assert.deepEqual(moveWidget(widgets,'today',-1),['today','continue','evolution','shortcuts']);
  assert.equal(moveWidget(widgets,'continue',-1),widgets);
  assert.equal(moveWidget(widgets,'shortcuts',1),widgets);
  assert.deepEqual(widgets,defaultPlatformPreferences.widgets);
});

test('personalização global normaliza densidade, cantos e efeitos',()=>{
  assert.deepEqual(normalizePlatformPreferences({palette:'ice',customAccent:'#112233',customText:'#abcdef',customSurface:'invalid',widgets:['focus'],density:'compact',radius:'sharp',effects:'minimal',mode:'light'}),{...defaultPlatformPreferences,palette:'ice',customAccent:'#112233',customText:'#abcdef',widgets:['focus'],density:'compact',radius:'sharp',effects:'minimal',mode:'light'});
  assert.deepEqual(normalizePlatformPreferences({density:'gigante',radius:'círculo',effects:'ruído'}),defaultPlatformPreferences);
});
test('fonte e escala são restauradas sem afetar preferências antigas',()=>{assert.equal(normalizePlatformPreferences({font:'editorial',typeScale:'large'}).font,'editorial');assert.equal(normalizePlatformPreferences({font:'unknown',typeScale:'huge'}).typeScale,'normal');});
