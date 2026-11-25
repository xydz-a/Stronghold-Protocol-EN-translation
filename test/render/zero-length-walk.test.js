// (fork) A walk loop of zero length holds the setup pose — 后兽 (enemy_2123_dyjsww, Move_Loop 0 s) showed no part at all
// whenever it walked (David's playtest of 2026-11-25). The actor plays its idle instead. Headless fake PIXI.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakePixi } from './fakepixi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = JSON.parse(readFileSync(path.join(ROOT, 'data/assets.json'), 'utf8'));

let fake, SpineActor;
before(async () => {
  fake = installFakePixi();
  ({ SpineActor } = await import('../../public/js/render/spine.js'));
});
after(() => fake.restore());

const actor = (id) => {
  const entry = assets.enemies[id].spine;
  return new SpineActor({ animations: Object.keys(entry.animations).map((name) => ({ name })) }, entry);
};

test('后兽 walks on its idle: its Move_Loop has no length', () => {
  assert.equal(assets.enemies.enemy_2123_dyjsww.spine.animations.Move_Loop, 0, 'the data this guards against');
  const a = actor('enemy_2123_dyjsww');
  a.setBase('move');
  assert.equal(a.current, 'Idle_A');
});

test('an ordinary walker keeps its Move clip', () => {
  const a = actor('enemy_1019_jshoot');
  a.setBase('move');
  assert.equal(a.current, 'Move');
});
