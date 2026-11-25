// (fork) An item row of the effects column (精打细算玩偶: server/match/builtinMeta.js gain_coin_when_round_start) carries
// its item id: its iconId is the trap's art (trap_1113_acarm113), so the tooltip found no record by it and stayed Chinese
// in English (David's playtest of 2026-11-25). ui/effectsList.js effectDesc reads `itemId`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
globalThis.fetch = async (url) => {
  const abs = path.join(ROOT, String(url).replace(/^\//, '').split('?')[0]);
  if (!existsSync(abs)) return { ok: false, status: 404, json: async () => null };
  const text = readFileSync(abs, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

const { data } = await import('../../public/js/data.js');
const { effectDesc } = await import('../../public/js/ui/effectsList.js');

test('the doll\'s effect row is described in the player\'s language through its item id', async () => {
  await data.loadAll('items', 'effects', 'bands', 'garrisons');
  const rec = data.lookupRaw('items', 'chess_item_2_05_e_a');
  assert.equal(rec.iconId, 'trap_1113_acarm113', 'the data this guards against: the icon is not the item');
  const row = { id: 'doll:7', iconKind: 'item', iconId: rec.iconId, itemId: rec.id, desc: rec.desc };
  assert.equal(await data.setLocale('en'), 'en');
  const en = data.lookup('items', 'chess_item_2_05_e_a').desc;
  assert.notEqual(en, rec.desc, 'the overlay has an English text');
  assert.equal(effectDesc(row), en);
  assert.equal(effectDesc({ ...row, itemId: undefined }), rec.desc, 'without it the row stays as sent (the bug)');
  await data.setLocale('zh');
});
