// (fork) 规程 cold blasts on death (David's playtest of 2026-11-25: the 致命 slug α and the canisters chilled nobody; the
// 冰原卫法者 froze outright). PRTS: 冰原卫法者 「爆炸半径1.65，延迟1.2秒…施加持续5秒寒冷」, “喷射罐” 「半径1.55…10s寒冷」.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from '../helpers/battleHarness.js';
import { getVersionData } from '../../server/data.js';
import * as enemiesMod from '../../server/sim/content/enemies.js';

const raw = getVersionData('act3autochess@V3_1');
const stay = (r, c) => ({ motion: 'WALK', start: [r, c], end: [r, 0], steps: [{ t: 'wait', s: 999 }] });
function setup(key) {
  const h = makeBattle({ content: 'generic', extraContent: [enemiesMod], autoFinish: false, timeLimit: 120,
    defs: { enemies: raw.enemies, chess: { probe: chessRec({ id: 'probe', stats: { maxHp: 1e9, def: 0, res: 0 }, skill: null }) } },
    units: [{ uid: 'a', chessId: 'probe', row: 10, col: 6 }] });
  h.step();
  const e = h.spawn(key, { pos: [10, 7], route: stay(10, 7) });
  h.step();
  return { h, e, u: h.unit('a') };
}

for (const key of ['enemy_1067_snslime_2', 'enemy_1385_winbom', 'enemy_1385_winbom_2']) {
  test(`${raw.enemies[key].name}: its knock-down chills the operators around it`, () => {
    const { h, e, u } = setup(key);
    h.b.kill(e, null);
    h.step();
    assert.ok(u.findBuff('cold'), 'cold');
    assert.equal(u.findBuff('freeze'), null, 'a single cold, not a freeze');
    assert.equal(h.b.errorCount, 0);
  });
}

test('冰原卫法者: a delayed 1.2 s blast of cold only; a second one freezes', () => {
  const { h, e, u } = setup('enemy_1191_krgrg');
  h.b.kill(e, null);
  h.run(1.1);
  assert.equal(u.findBuff('cold'), null, 'not before the delay');
  h.run(0.2);
  assert.ok(u.findBuff('cold'));
  assert.equal(u.findBuff('freeze'), null);
  const e2 = h.spawn('enemy_1191_krgrg', { pos: [10, 7], route: stay(10, 7) });
  h.step();
  h.b.kill(e2, null);
  h.run(1.3);
  assert.ok(u.findBuff('freeze'), 'cold on cold freezes');
  assert.equal(h.b.errorCount, 0);
});

test('silence stops the canister blast', () => {
  const { h, e, u } = setup('enemy_1385_winbom');
  h.b.applyStatus(e, 'silence', { duration: 5, force: true });
  h.b.kill(e, null);
  h.step();
  assert.equal(u.findBuff('cold'), null);
});
