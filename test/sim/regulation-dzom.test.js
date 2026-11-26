// (fork) 规程 大君之触 / 大君之赐 (and the elite 仁慈之触 / 慷慨之赐) had no kit: no 90% damage resistance and no blocker
// bonus (David's playtest of 2026-11-26). Talent: dmg_res.damage_resistance 0.9; buff_to_blocker.block_cnt 1,
// max_valid_stack_cnt 6 ("阻挡该敌人的单位阻挡数上限提升").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from '../helpers/battleHarness.js';
import { getVersionData } from '../../server/data.js';
import * as enemiesMod from '../../server/sim/content/enemies.js';

const raw = getVersionData('act3autochess@V3_1');
const KEYS = ['enemy_1220_dzoms', 'enemy_1220_dzoms_2', 'enemy_1221_dzomg', 'enemy_1221_dzomg_2'];
const stay = (r, c) => ({ motion: 'WALK', start: [r, c], end: [r, 0], steps: [{ t: 'wait', s: 999 }] });
function setup() {
  const h = makeBattle({ content: 'generic', extraContent: [enemiesMod], autoFinish: false, timeLimit: 120,
    defs: { enemies: raw.enemies, chess: { probe: chessRec({ id: 'probe', stats: { maxHp: 1e9, def: 0, res: 0, blockCnt: 1 }, skill: null }) } },
    units: [{ uid: 'a', chessId: 'probe', row: 10, col: 6 }] });
  h.step();
  return { h, u: h.unit('a') };
}

for (const key of KEYS) {
  test(`${raw.enemies[key].name}: phys and arts taken ×(1 − 0.9), true damage untouched`, () => {
    const t = raw.enemies[key].talents.bb;
    assert.equal(t['dmg_res.damage_resistance'], 0.9);
    const { h, u } = setup();
    const e = h.spawn(key, { pos: [10, 8], route: stay(10, 8) });
    h.step();
    const { def, res } = raw.enemies[key].stats;
    const took = (type) => { const hp = e.hp; h.b.dealDamage(u, e, { amount: 1000, type }); return hp - e.hp; };
    assert.ok(Math.abs(took('phys') - (1000 - def) * 0.1) < 1e-6);
    assert.ok(Math.abs(took('arts') - 1000 * (1 - res / 100) * 0.1) < 1e-6);
    assert.ok(Math.abs(took('true') - 1000) < 1e-6);
    assert.equal(h.b.errorCount, 0);
  });
}

test('the unit blocking them gains +1 block per one blocked, capped at 6, and loses it when none is left', () => {
  const { h, u } = setup();
  const base = u.s.blockCnt;
  const list = [];
  for (let i = 0; i < 8; i++) {
    const e = h.spawn(KEYS[i % 4], { pos: [10, 8], route: stay(10, 8) });
    e.blockedBy = u;
    list.push(e);
    h.step();
    assert.equal(u.s.blockCnt, base + Math.min(6, i + 1), `after ${i + 1}`);
  }
  for (const e of list) { e.blockedBy = null; h.b.kill(e, null); }
  h.run(0.5);
  assert.equal(u.s.blockCnt, base);
  assert.equal(h.b.errorCount, 0);
});
