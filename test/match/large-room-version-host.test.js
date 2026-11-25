// (fork) A Grand Alliance of another official version (规程 since 2026-11-25) plays in that version's match host: the
// large-room options cross the boundary (wireOptions), and the match's idle seat comes back as an 'idle' message that
// drives the lobby's onIdle (entry.js → ipc.js → proxy.js deliver).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wireOptions, MatchProxy } from '../../server/match/host/proxy.js';
import { validHostMessage } from '../../server/match/host/ipc.js';

test('wireOptions carries largeRoom and One for All only when set; a normal payload is unchanged', () => {
  const base = { roomCode: 'ABCD', mode: 'coop', difficulty: 'HARD', seats: [], seed: 1, version: 'act3autochess@V3_1' };
  assert.deepEqual(wireOptions(base), base);
  const big = wireOptions({ ...base, largeRoom: true, oneForAll: true, onIdle() {}, botExecution: 'host', botBattles: 'host', hostId: 'p_0' });
  assert.equal(big.largeRoom, true);
  assert.equal(big.oneForAll, true);
  assert.equal(Object.hasOwn(big, 'onIdle'), false, 'no callback crosses');
  assert.equal(Object.hasOwn(wireOptions({ ...base, oneForAll: true }), 'oneForAll'), false, 'One for All rides with a large room only');
});

test('an idle message is a valid host frame and calls the lobby\'s onIdle', () => {
  assert.equal(validHostMessage({ type: 'idle', matchId: 'm1', playerId: 'p_3' }), true);
  assert.equal(validHostMessage({ type: 'idle', matchId: 'm1' }), false);
  assert.equal(validHostMessage({ type: 'idle', matchId: 'm1', playerId: 'p_3', extra: 1 }), false);
  const idle = [];
  const proxy = new MatchProxy({ host: { post() {} }, matchId: 'm1', opts: { roomCode: 'ABCD', onIdle: (id) => idle.push(id), send() {}, broadcast() {}, onEnd() {} } });
  proxy.deliver({ type: 'idle', matchId: 'm1', playerId: 'p_3' });
  proxy.deliver({ type: 'idle', matchId: 'other', playerId: 'p_4' });
  assert.deepEqual(idle, ['p_3']);
  // a normal match's proxy has no onIdle: the frame is ignored
  const plain = new MatchProxy({ host: { post() {} }, matchId: 'm2', opts: { roomCode: 'ABCD', send() {}, broadcast() {}, onEnd() {} } });
  assert.doesNotThrow(() => plain.deliver({ type: 'idle', matchId: 'm2', playerId: 'p_1' }));
});
