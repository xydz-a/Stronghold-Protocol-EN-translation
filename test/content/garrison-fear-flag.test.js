// (fork) 规程's 妮芙 (chess_char_6_10_a/b, garrison_99_a/b): an enemy in her range that becomes 恐惧 (check_ab_flag 33) adds
// 【迅捷】 stacks, up to the per-battle cap. Upstream 0.4.0 mapped every flag but 16 to 冻结, so it never fired (the user's
// report of 2026-11-24).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getData, getVersionData, setData } from '../../server/data.js';
import { DataSource } from '../../server/sim/simdata.js';
import { setGameData } from '../../server/sim/content/support/index.js';
import { makeBattle, enemyRec } from '../helpers/battleHarness.js';

const current = getData();
const bond = (layers = 0) => ({ active: true, tier: 1, layers, count: 3 });

for (const [chessId, per, cap] of [['chess_char_6_10_a', 4, 20], ['chess_char_6_10_b', 8, 40]]) {
  test(`规程 妮芙 ${chessId}: each enemy in range that becomes 恐惧 gives +${per} 【迅捷】 (up to ${cap}); 冻结 does not`, () => {
    const data = getVersionData('act3autochess@V3_1');
    setData(data);
    setGameData(data);
    try {
      const h = makeBattle({
        data: new DataSource({ ...data, enemies: { ...data.enemies, enemy_test: enemyRec({ hp: 1e8, speed: 0 }) } }),
        units: [{ chessId, row: 10, col: 4 }],
        enemies: [{ key: 'enemy_test', pos: [10, 5] }, { key: 'enemy_test', pos: [10, 6] }, { key: 'enemy_test', pos: [3, 15] }],
        bonds: { swiftShip: bond(0) }, autoFinish: false, timeLimit: 400,
      });
      h.step(1);
      const gains = () => h.result().perPlayer.p1.layerGains.swiftShip ?? 0;
      const [near, near2, far] = [...h.enemies()].sort((a, b) => a.y - b.y || a.x - b.x).reverse().sort((a, b) => Math.abs(a.y - 10) - Math.abs(b.y - 10));
      h.b.applyStatus(near, 'freeze', { duration: 1 });
      assert.equal(gains(), 0, '冻结 is another flag');
      h.b.applyStatus(far, 'fear', { duration: 1 });
      assert.equal(gains(), 0, 'out of range');
      h.b.applyStatus(near, 'fear', { duration: 1 });
      assert.equal(gains(), per, 'one enemy becomes 恐惧');
      h.b.applyStatus(near, 'fear', { duration: 2 });
      assert.equal(gains(), per, 'a refreshed 恐惧 is no new entry');
      for (let i = 0; i < 10; i++) { h.b.removeStatus(near2, 'fear'); h.b.applyStatus(near2, 'fear', { duration: 1 }); }
      assert.equal(gains(), cap, 'the per-battle cap');
    } finally { setData(current); setGameData(current); }
  });
}
