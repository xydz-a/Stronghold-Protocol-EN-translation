// (fork) 魂灵涡流 pickup (PRTS 关于能力: radius 0.25, cap 3, the vortex leaves the field) and what the charges buy: the
// 魂灵残迹's 巫术激流 beam along its row / column, the 法骸's 魂灵残片. Upstream 0.4.0 had no pickup (David's playtest of
// 2026-11-25: the remnant never absorbed a maelstrom nor fired).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from '../helpers/battleHarness.js';
import { getVersionData } from '../../server/data.js';
import * as enemiesMod from '../../server/sim/content/enemies.js';

const raw = getVersionData('act3autochess@V3_1');
const stay = (r, c) => ({ motion: 'WALK', start: [r, c], end: [r, 0], steps: [{ t: 'wait', s: 999 }] });
function field(units = []) {
  return makeBattle({ content: 'generic', extraContent: [enemiesMod], autoFinish: false, timeLimit: 120,
    defs: { enemies: raw.enemies, chess: { probe: chessRec({ id: 'probe', stats: { maxHp: 1e9, def: 0, res: 0 }, skill: null }) } },
    units });
}
const SOUL = 'enemy_1428_lrsoul';

test('a soul remnant absorbs maelstroms within 0.25 tiles (at most three) without a kill or a leak', () => {
  const h = field();
  const e = h.spawn('enemy_1429_lrwzrd', { pos: [10, 7], route: stay(10, 7) });
  const vs = [0, 0.1, 0.2, 0.15].map((d) => h.spawn(SOUL, { pos: [10, 7 + d], route: stay(10, 7 + d) }));
  const far = h.spawn(SOUL, { pos: [10, 8], route: stay(10, 8) });
  h.step(2);
  assert.equal(e.mem.soulCharges, 3);
  assert.equal(vs.filter((v) => v.alive).length, 1, 'the cap leaves the fourth on the field');
  assert.equal(far.alive, true, 'out of reach');
  assert.ok(vs.filter((v) => !v.alive).every((v) => v.removeReason === 'absorbed'));
  assert.equal(h.b.killed, 0);
  assert.equal(h.b.leaked?.length ?? 0, 0);
  assert.equal(h.b.errorCount, 0);
});

test('with charges, the remnant spends them all on a beam that hits every operator in the target\'s row', () => {
  const h = field([{ uid: 'a', chessId: 'probe', row: 10, col: 4 }, { uid: 'b', chessId: 'probe', row: 10, col: 2 },
    { uid: 'c', chessId: 'probe', row: 11, col: 4 }]);
  h.step();
  const e = h.spawn('enemy_1429_lrwzrd', { pos: [10, 7], route: stay(10, 7) });
  h.spawn(SOUL, { pos: [10, 7], route: stay(10, 7) });
  h.spawn(SOUL, { pos: [10, 7.1], route: stay(10, 7.1) });
  h.step(2);
  assert.equal(e.mem.soulCharges ?? 0, 0, 'all charges spent at the cast');
  const hpA = h.unit('a').hp, hpB = h.unit('b').hp, hpC = h.unit('c').hp;
  h.run(3.2);
  assert.ok(h.unit('a').hp < hpA && h.unit('b').hp < hpB, 'both operators on the row take the beam');
  assert.equal(h.unit('c').hp, hpC, 'the next row is outside the 0.65-wide beam');
  assert.ok(e.s.atk > e.base.atk, 'ATK ramps during the channel');
  assert.ok(e.s.atk <= e.base.atk * (1 + 2 * 0.25) + 1e-6, 'capped at +25% per charge spent');
  h.run(6);
  assert.equal(e.s.atk, e.base.atk, 'the ramp ends with the beam');
  assert.equal(h.b.errorCount, 0);
});

test('without a maelstrom the remnant never casts, and the husk summons no fragment', () => {
  const h = field([{ uid: 'a', chessId: 'probe', row: 10, col: 4 }]);
  h.step();
  const r = h.spawn('enemy_1429_lrwzrd', { pos: [10, 7], route: stay(10, 7) });
  const k = h.spawn('enemy_1431_lrmzrd', { pos: [12, 7], route: stay(12, 7) });
  h.run(20);
  assert.equal(r.findBuff('ab:channel'), null);
  assert.equal(k.mem.regFrags?.length ?? 0, 0);
  h.spawn(SOUL, { pos: [12, 7], route: stay(12, 7) });
  h.run(16);
  assert.equal(k.mem.regFrags?.length ?? 0, 1, 'one fragment per maelstrom picked up');
  assert.equal(k.mem.soulCharges ?? 0, 0);
  assert.equal(h.b.errorCount, 0);
});
