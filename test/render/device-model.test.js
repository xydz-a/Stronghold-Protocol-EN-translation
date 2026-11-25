// (fork) 寻宝人's “模拟宝藏” keeps its model in battle (David's playtest of 2026-11-25: it became the generic box when the
// battle began). render/tiles.js deviceModelOf decides which battle devices are drawn with a model instead of a box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceModelOf } from '../../public/js/render/tiles.js';

const has = (id) => (id === 'enemy_9038_achest' || id === 'trap_1105_accrate' ? { skel: 'x' } : null);

test('the treasure chest device is drawn with its enemy model', () => {
  assert.equal(deviceModelOf({ kind: 'device', defId: 'enemy_9038_achest', spine: 'enemy_9038_achest' }, has), true);
});

test('stage devices and model-less ones keep their boxes', () => {
  assert.equal(deviceModelOf({ kind: 'device', defId: 'trap_1105_accrate', spine: 'trap_1105_accrate' }, has), false, 'a crate');
  assert.equal(deviceModelOf({ kind: 'device', defId: 'enemy_0000_none' }, has), false, 'no model on this install');
  assert.equal(deviceModelOf({ kind: 'device', defId: 'enemy_9038_achest' }, null), false, 'no asset lookup');
  assert.equal(deviceModelOf({ kind: 'token', defId: 'enemy_9038_achest' }, has), false, 'not a device');
});
