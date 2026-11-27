// server/sim/content/enemies/regulation.js — 规程·序列Ⅰ special enemies (CRITIC / REBORN and the new draws).
//
// Kept off KITS: test/content/enemies_bosses.test.js requires every KITS key in the default enemies.json.
// enemies.js onSpawn falls back to REGULATION_KITS. This module does not import enemies.js.
//
// Official numbers are read from the enemy record. Points with no blackboard are marked [ASSUMED].

import { hypot, sin, cos } from '../../detmath.js';
import { canTargetAlly } from '../../targeting.js';
import {
  hurt, elem, areaAllies, auraAllies, remainingRoute, stayRoute, spawnChildren, nthOf, canCast, BOOM_RADIUS, auraBuff, watchDeaths,
  unbalancedNow,
} from './helpers.js';
import { skill, stealth, ep, refraction, reborn, deathBoom, blockWeight } from './archetypes.js';
import { rushKit } from './special.js';

const num = (v, d) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v)) return +v;
  return d;
};
const tv = (ab, key, d) => num(ab && ab.t ? ab.t[key] : undefined, d);
const sv = (map, key) => {
  const v = map && map[key];
  return typeof v === 'string' && v ? v : '';
};
const bb = (sk, key, d) => num(sk && sk.bb ? sk.bb[key] : undefined, d);

function spEvery(sk, fire, sil = false) {
  if (!sk || !(sk.sp > 0)) return null;
  return {
    sk, sil,
    tick(b, e, a, dt) {
      if (!canCast(e, sil, b)) return;
      a.acc = (a.acc ?? 0) + dt;
      if (a.acc + 1e-9 < sk.sp) return;
      a.acc = 0;
      fire(b, e, a);
    },
  };
}

function timed(sk, fire, extra = {}) {
  if (!sk || !fire) return null;
  if (sk.sp > 0 && !(sk.cd > 0)) return spEvery(sk, fire, !!extra.sil);
  if (sk.cd > 0) return skill(sk, fire, extra);
  return null;
}

function replaceLater(b, e, key, delay, n = 1) {
  if (!key || !(n > 0)) return;
  const pos = [e.y, e.x];
  const route = remainingRoute(e);
  const spawn = () => spawnChildren(b, e, key, n, { pos, route });
  if (!(delay > 0)) { spawn(); return; }
  // Keep an otherwise empty field alive until its replacement arrives; ordinary visual timers must not do so.
  b.after(delay, spawn, { holdsBattle: true });
}

function nearestAlly(b, src, from, range, seen) {
  let best = null;
  let bd = range;
  for (const u of areaAllies(b, src, from.x, from.y, range)) {
    if (!u || seen.has(u.id)) continue;
    const d = hypot(u.x - from.x, u.y - from.y);
    if (d > range + 1e-9) continue;
    if (!best || d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && u.id < best.id)) { best = u; bd = d; }
  }
  return best;
}

// --- CRITIC ----------------------------------------------------------------------------------------------

/** 战线推进者: the first attack after each block is ×sheltr ×(1+atk). PowerHit is not a cooldown. */
function kitChghmr(ab) {
  const sheltr = tv(ab, 'DmgUp.sheltr_atk_scale', 2.5);
  const atk = bb(ab.sk.PowerHit, 'atk', 0.8);
  return [{
    sil: true,
    blocked(c, b, e, a) { a.armed = true; },
    hitOut(c, b, e, a) {
      if (!a.armed || !c.dmg || !c.dmg.isAttack) return;
      a.armed = false;
      c.dmg.mul *= sheltr * (1 + atk);
    },
  }];
}

/** 管乐家: +atk per second while unblocked; the next attack spends the stacks and stuns.
 *  switchMode (沉郁 / 热情) has no field-wide variation signal — left unused. */
function kitLtnclr(ab) {
  const flat = tv(ab, 'atkboostCore.atk', 30);
  const cap = tv(ab, 'atkboostCore.max_stack_count', 30);
  const stun = tv(ab, 'atkboostCore.attack@stun_duration', 10);
  return [{
    tick(b, e, a, dt) {
      if (e.blockedBy) return;
      a.acc = (a.acc ?? 0) + dt;
      if (a.acc + 1e-9 < 1) return;
      a.acc -= 1;
      a.stacks = Math.min(cap, (a.stacks ?? 0) + 1);
      b.addBuff(e, { key: 'reg:boost', persist: true, refresh: 'replace', mods: { atkFlat: flat * a.stacks } });
    },
    dealt(c, b, e, a) {
      if (!(a.stacks > 0)) return;
      if (stun > 0 && c.target && c.target.alive) b.applyStatus(c.target, 'stun', { duration: stun, source: e });
      a.stacks = 0;
      b.removeBuff(e, 'reg:boost');
    },
  }];
}

/** “投石机” / “榴弹炮” 「可以抛出巨大雪球造成十字溅射伤害」「抛出雪球后只能进行近战攻击」: its first attack is a throw at its
 *  rawRangeRadius (2.5) — first_atk_scale × ATK on the target and on the units of the four tiles around it (十字) — then it
 *  only attacks its blocker [src: BWIKI “投石机” 「抛出的巨大雪球造成攻击力150%的十字溅射伤害」, 攻击范围半径 2.5]. (fork) Before:
 *  the record's range is 0, so the throw never happened (David's playtest of 2026-11-27). */
const CROSS4 = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
function kitWingnt(ab, e0) {
  const scale = tv(ab, 'FirstAttack.attack@first_atk_scale', 1.5);
  const reach = num(e0?.def?.raw?.stats?.rawRangeRadius, 0);
  return [{
    spawn(b, e) {
      if (reach > 0) { e.base.rangeRadius = reach; e.profile.melee = false; }
    },
    hitOut(c, b, e, a) {
      if (a.used || !c.dmg || !c.dmg.isAttack) return;
      a.used = true;
      c.dmg.mul *= scale;
      const t = c.target;
      if (t) {
        const r0 = Math.round(t.y), c0 = Math.round(t.x);
        for (const u of b.allies()) {
          if (!u.alive || u === t || u.isFlying) continue;
          const dr = Math.round(u.y) - r0, dc = Math.round(u.x) - c0;
          if (CROSS4.some(([pr, pc]) => pr === dr && pc === dc)) hurt(b, e, u, e.s.atk * scale, 'phys', { tags: ['snowball'] });
        }
        b.fx('blast', { x: t.x, y: t.y, r: 1, id: e.id, kind: 'snowball' });
      }
      e.profile.melee = true;
      e.base.rangeRadius = 0;
    },
  }];
}

/** 狂暴凶豕兽 「只能被阻挡数大于等于2的单位阻挡」「冲撞时逐渐加速，并对经过与阻挡自身的目标根据移动速度造成伤害」: the 加速冲撞 walk
 *  (special.js rushKit) on its Rush.mhboar_t[trigger] template — +33.3 % every 0.333 s, up to 35 layers, 晕眩 / 束缚 clear it
 *  — after Rush.mhboar_t_predelay; the first hit on its blocker adds 当前移动速度 × FirstAttack.atk_scale phys, each unit it
 *  walks over 当前移动速度 × Crash.atk_scale [src: BWIKI 狂暴凶豕兽 「移动时每0.333秒加速一次，每次提升33.3%移动速度，上限35次」
 *  「1：600至1:800额外物理伤害」]. (fork) Before: no kit (David's playtest of 2026-11-27). */
function kitMhboar(ab) {
  return [blockWeight(2), ...rushKit(ab, { trig: 'Rush.mhboar_t[trigger]', first: 'FirstAttack.atk_scale', predelay: 'Rush.mhboar_t_predelay.predelay', crash: 'Crash.atk_scale' })];
}

/** 赏金猎人“骑士” 「移动时逐渐加速，被阻挡后的首次攻击根据移速造成额外法术伤害」: rushKit on Rush.enemy_mmstck_t[trigger] (+50 % every
 *  0.5 s, up to 25), the first hit after a block adds 当前移动速度 × FirstAttack.atk_scale arts [src: BWIKI 赏金猎人“大骑士”
 *  「移动时每0.5秒加速一次…（眩晕、束缚会停止并清空移速叠加）」]. (fork) Before: no kit. */
function kitMmstck(ab) {
  return rushKit(ab, { trig: 'Rush.enemy_mmstck_t[trigger]', first: 'FirstAttack.atk_scale', type: 'arts' });
}

/** 神勇的帕拉杜利斯 「移动方向前方有我方单位时发起冲锋，击中我方单位时造成大量物理伤害」 (入戏 is not in this mode): while unblocked, its
 *  rush skill (cooldown 10, first at 5, silenceable) charges the nearest ground unit in its row or column — unblockable meanwhile —
 *  and on contact (hitbox 0.45) deals CollideChar.atk_scale_collide × ATK phys, then walks on [src: Arknights Terra Wiki
 *  Palladulis ability table]. The charge runs at PALLA_SPEED tiles/s and only along a straight line of passable ground
 *  [ASSUMED: no source gives the speed — 1.5 tiles/s, slower than the 凶豕兽's top speed (2.5) as the owner recalls it; a
 *  unit behind a wall or on high ground is not charged; user OK 2026-11-27]. (fork) Before: no kit. */
const PALLA_SPEED = 1.5;
const PALLA_HITBOX = 0.45;
function kitPalla(ab) {
  const sk = ab.sk.rush;
  const scale = tv(ab, 'CollideChar.atk_scale_collide', 2);
  const target = (b, e) => {
    const r0 = Math.round(e.y), c0 = Math.round(e.x);
    let best = null, bd = Infinity;
    for (const u of b.allies()) {
      if (!u.alive || !u.deployed || u.isFlying || !canTargetAlly(e, u, false)) continue;
      const ur = Math.round(u.y), uc = Math.round(u.x);
      if (ur !== r0 && uc !== c0) continue;
      const d = Math.abs(ur - r0) + Math.abs(uc - c0);
      if (d >= bd) continue;
      const sr = Math.sign(ur - r0), sc = Math.sign(uc - c0);
      let clear = true;
      for (let k = 1; k <= d; k++) if (!b.grid.groundPassable(r0 + sr * k, c0 + sc * k)) { clear = false; break; }
      if (clear) { best = u; bd = d; }
    }
    return best;
  };
  const end = (b, e, a) => {
    a.charge = null;
    b.removeBuff(e, 'reg:charge');
    if (e.route) e.route.pts = null;
  };
  return [
    sk && skill(sk, (b, e, a0) => {
      const t = target(b, e);
      if (!t) return;
      const a = e.mem.regPalla || (e.mem.regPalla = {});
      a.charge = t;
      b.addBuff(e, { key: 'reg:charge', persist: true, flags: { unblockable: true, noMove: true } });
      b.fx('phase', { x: e.x, y: e.y, id: e.id, kind: 'charge' });
      void a0;
    }, { sil: true, cond: (b, e) => !e.blockedBy && !(e.mem.regPalla && e.mem.regPalla.charge) && !!target(b, e) }),
    {
      tick(b, e, _a, dt) {
        const a = e.mem.regPalla;
        if (!a || !a.charge) return;
        const t = a.charge;
        if (!t.alive || !t.deployed || e.s.flags.stun || !e.alive) { end(b, e, a); return; }
        const dx = t.x - e.x, dy = t.y - e.y, d = hypot(dx, dy);
        if (d <= PALLA_HITBOX + 1e-9) {
          hurt(b, e, t, e.s.atk * scale, 'phys', { tags: ['charge'] });
          end(b, e, a);
          return;
        }
        const step = Math.min(d - PALLA_HITBOX, PALLA_SPEED * dt);
        e.x += (dx / d) * step;
        e.y += (dy / d) * step;
        e.moving = true;
      },
    },
  ].filter(Boolean);
}

/** 冰原卫法者: silenced death boom (cold and freeze); unbalanced self HP loss is not silenced. */
const KRGRG_DELAY = 1.2;   // PRTS 冰原卫法者 关于能力
const KRGRG_R = 1.65;

/**
 * (fork) 冰爆源石虫·α: the base slug's blast (special.js — phys boom.atk_scale, boom.freeze s of 寒冷, its range radius). The α had no
 * kit in upstream 0.4.0, so the 致命 one died quietly (David's playtest of 2026-11-25).
 */
function kitSnslime(ab, e) {
  return [deathBoom({ scale: tv(ab, 'boom.atk_scale', 0), r: (e.def.raw.stats && e.def.raw.stats.rawRangeRadius) || 1.25,
    status: { key: 'cold', dur: tv(ab, 'boom.freeze', 0) } })];
}

/**
 * (fork) “喷射罐” / “喷爆罐”: PRTS 关于能力 「死亡后熄灭周围3x3范围内的紧急供暖器并对半径1.55范围内的我方单位造成攻击力100%的法术溅射伤害与
 * 10s寒冷（可被沉默）」 — Boom.atk_scale / Boom.freeze. No kit upstream. Silenced, it does not blast (that 「可被沉默」; the slugs' deathBoom
 * is silenceable the same way); the 紧急供暖器 part has no counterpart here.
 */
function kitWinbom(ab) {
  return [deathBoom({ scale: tv(ab, 'Boom.atk_scale', 1), type: 'arts', r: 1.55, status: { key: 'cold', dur: tv(ab, 'Boom.freeze', 10) } })];
}

function kitKrgrg(ab) {
  const scale = tv(ab, 'boom.atk_scale', 1);
  const cold = tv(ab, 'boom.cold', 0);
  const bleed = tv(ab, 'unbalanced_bleed.damage', 0);
  const iv = tv(ab, 'unbalanced_bleed.interval', 0.066);
  return [
    {
      sil: true,
      // (fork) PRTS 冰原卫法者 关于能力: 「爆炸半径1.65，延迟1.2秒，对我方单位和敌方单位造成攻击力130%法术溅射伤害并施加持续5秒寒冷」 —
      // only 寒冷 (boom.cold): a second cold within it becomes 冻结 by the ordinary rule (battle/status.js). Upstream 0.4.0
      // froze every operator in reach outright (boom.freeze on top) at once, around the knock-down spot, operators only.
      death(c, b, e) {
        if (c.reason !== 'killed') return;
        const x = e.x, y = e.y, atk = e.s.atk;
        b.after(KRGRG_DELAY, () => {
          b.fx('explode', { x, y, r: KRGRG_R, kind: 'deathBoom', id: e.id });
          const hit = [...areaAllies(b, e, x, y, KRGRG_R).filter((u) => !u.isFlying),
            ...b.enemiesInRadius(x, y, KRGRG_R).filter((o) => o !== e && o.alive && o.motion !== 'FLY')];
          for (const u of hit) {
            if (scale > 0) hurt(b, e, u, atk * scale, 'arts');
            if (cold > 0 && u.alive) b.applyStatus(u, 'cold', { duration: cold, source: e });
          }
        }, { holdsBattle: true });
      },
    },
    {
      tick(b, e, a, dt) {
        if (!(bleed > 0) || !(iv > 0) || !unbalancedNow(b, e)) return;
        a.acc = (a.acc ?? 0) + dt;
        for (let n = 0; n < 4 && a.acc + 1e-9 >= iv && e.alive; n++) {
          a.acc -= iv;
          b.dealHPLose(e, bleed);
        }
      },
    },
  ];
}

/** 寻路者信使: one headshot (handbook ammo cap; no ammo key), then melee. */
function kitMtrbty(ab) {
  const scale = tv(ab, 'shotbuff.attack@headshot_atk_scale', 1.5);
  const disarm = tv(ab, 'shotbuff.attack@headshot_disarmed_duration', 15);
  const sp = tv(ab, 'shotbuff.attack@headshot_sp', -1);
  const trap = tv(ab, 'shotbuff.attack@headshot_trapdamage', 5000);
  return [{
    hitOut(c, b, e, a) {
      if (a.spent || !c.dmg || !c.dmg.isAttack) return;
      a.spent = true;
      c.dmg.mul *= scale;
      e.profile.melee = true;
    },
    dealt(c, b, e, a) {
      if (a.paid || !c.target) return;
      a.paid = true;
      const u = c.target;
      if (disarm > 0 && u.alive) b.applyStatus(u, 'disarm', { duration: disarm, source: e });
      if (u.skill && sp !== 0) u.skill.sp = Math.max(0, (u.skill.sp ?? 0) + sp);
      if (trap > 0 && u.kind === 'device' && u.alive) hurt(b, e, u, trap, 'arts');
    },
  }];
}

/** 诡核集养者 / 异光体集养者 「生命值首次低于一半时，分裂自身」 — 应激性分裂: 「在自身半径0.3的范围内随机一个位置以自身当前路径召唤一个
 *  与自身生命值相同比例且无法触发技能的诡核集养者」 [src: BWIKI 异光体集养者 技能]: the first time its HP falls below
 *  0.hp_ratio, one copy (the skill's enemy_key) at a random point within the skill's offset_bound, on its remaining route,
 *  at its HP ratio; the copy never splits. Checked every 0.interval s. (fork) Before: no kit (David's playtest of
 *  2026-11-26). */
function kitDivi(ab) {
  const sk = ab.sk['0'];
  const key = sv(sk?.bs, 'enemy_key');
  const ratio = tv(ab, '0.hp_ratio', 0.5);
  const bound = bb(sk, 'offset_bound', tv(ab, '0.offset_bound', 0.3));
  return [{
    iv: tv(ab, '0.interval', 0.3),
    tick(b, e, a) {
      if (a.split || e.mem.regNoSplit || !key || !e.alive || !(e.hpRatio < ratio)) return;
      a.split = true;
      const ang = b.rng() * 2 * Math.PI, d = b.rng() * bound;
      const kids = spawnChildren(b, e, key, 1, { pos: [e.y + sin(ang) * d, e.x + cos(ang) * d], route: remainingRoute(e) });
      for (const k of kids) {
        k.mem.regNoSplit = true;
        k.hp = Math.max(1, k.s.maxHp * e.hpRatio);
      }
    },
  }];
}

// --- 直击: row / column shots at the first unit in line ------------------------------------------------------

const LINE_DIRS = Object.freeze([[0, 1], [0, -1], [1, 0], [-1, 0]]);
/** Seconds between the shots of one 直击 volley [ASSUMED: no source gives the spacing; 0.3 s is what 马特奥的近卫's two
 *  bombs already used here; user OK 2026-11-26]. */
const LINE_SPACING = 0.3;
const LINE_SPEED = 12;

/**
 * 直击 (速射轻弩手 / 速射劲弩手 / 马特奥的近卫 / 无畏掷弹兵): 「与自身处于同行列且无封阻物阻挡」 — along each of `dirs` from the
 * enemy's tile, the nearest unit it may target (its own tile first), at any distance (攻击范围半径 −1) until the field's
 * edge or a blocking obstacle (封阻物) [src: BWIKI 速射劲弩手 / 马特奥的近卫, 技能 and 攻击范围半径]. Returns
 * [{ u, d, dir }] nearest first.
 */
function lineTargets(b, e, dirs = LINE_DIRS) {
  const R = b.rect;
  const at = new Map();
  for (const u of b.allies()) {
    if (!u.alive || !u.deployed || !canTargetAlly(e, u, true)) continue;
    const key = Math.round(u.y) * 100 + Math.round(u.x);
    const cur = at.get(key);
    if (!cur || u.id < cur.id) at.set(key, u);
  }
  const r0 = Math.round(e.y), c0 = Math.round(e.x);
  const out = [];
  for (const dir of dirs) {
    for (let k = dir === dirs[0] ? 0 : 1; k < 64; k++) { // loop-cap: a field is under 64 tiles across (own tile: once)
      const r = r0 + dir[0] * k, c = c0 + dir[1] * k;
      if (R && (r < R.r0 || r > R.r1 || c < R.c0 || c > R.c1)) break;
      const u = at.get(r * 100 + c);
      if (u) { out.push({ u, d: k, dir }); break; }
      if (k > 0 && b.grid.isBlocked(r, c)) break;
    }
  }
  out.sort((p, q) => p.d - q.d || p.u.id - q.u.id);
  return out;
}

/** One shot of a volley: a projectile to the first unit along `dir`, `hit(target)` on arrival. */
function lineShot(b, e, dir, hit) {
  const t = lineTargets(b, e, [dir])[0]?.u;
  if (!t) return;
  b.fx('shot', { x: e.x, y: e.y, from: e.id, to: t.id, kind: 'crossBolt', dur: hypot(t.x - e.x, t.y - e.y) / LINE_SPEED });
  b.addProjectile({ from: e, target: t, speed: LINE_SPEED, visual: 'enemy', source: e, onHit: (c) => { if (c.target && c.target.alive) hit(c.target); } });
}

/** A volley of `n` shots down the nearest line, LINE_SPACING apart; stun / silence / death stop the rest. */
function lineVolley(b, e, n, hit) {
  const first = lineTargets(b, e)[0];
  if (!first) return;
  const go = () => { if (e.alive && !e.s.flags.stun && !e.s.flags.silence) lineShot(b, e, first.dir, hit); };
  lineShot(b, e, first.dir, hit);
  for (let i = 1; i < n; i++) b.after(LINE_SPACING * i, go, { owner: e });
}

/** 速射轻弩手 / 速射劲弩手 「与我方处于同一直线上时进行直击：向目标方向发射3支弩箭」: each 弩箭 100% ATK phys on the first unit
 *  in line [src: BWIKI 速射劲弩手 速射直击]. (fork) Before: no kit, so with its 0 range it never attacked (David's playtest
 *  of 2026-11-26). */
const GUNSHO_ARROWS = 3;
function kitGunsho(ab) {
  const sk = ab.sk.CrossAttack;
  return [sk && skill(sk, (b, e) => {
    lineVolley(b, e, GUNSHO_ARROWS, (t) => hurt(b, e, t, e.s.atk * bb(sk, 'atk_scale', 1), 'phys'));
  }, { sil: true, cond: (b, e) => lineTargets(b, e).length > 0 })];
}

/** 马特奥的近卫: 直击 「向目标方向发射2枚爆破弹」 — each blasts projectile_range around the first unit in line, ATK ×
 *  atk_scale phys [src: BWIKI 马特奥的近卫 爆破弹 「对首位目标周围半径1.1范围内的单位造成…物理伤害」]; unblocked damage
 *  resistance. (fork) Before: projectile_range was read as the reach, so it shot only at units within 1.1 tiles. */
function kitBdguad(ab) {
  const sk = ab.sk.CrossBomb;
  const dr = tv(ab, 'DmgResist.damage_resistance', 0.4);
  return [
    sk && skill(sk, (b, e) => {
      const r = bb(sk, 'projectile_range', 1.1);
      const times = Math.max(1, Math.min(4, bb(sk, 'times', 2)));
      const scale = bb(sk, 'atk_scale', 0.5);
      lineVolley(b, e, times, (t) => {
        for (const u of areaAllies(b, e, t.x, t.y, r)) hurt(b, e, u, e.s.atk * scale, 'phys');
        b.fx('blast', { x: t.x, y: t.y, r, id: e.id });
      });
    }, { sil: true, cond: (b, e) => lineTargets(b, e).length > 0 }),
    {
      hitIn(c, b, e) {
        if (e.blockedBy) return;
        const ty = c.dmg && c.dmg.type;
        if (ty !== 'phys' && ty !== 'arts') return;
        c.dmg.mul *= Math.max(0, 1 - dr);
      },
    },
  ].filter(Boolean);
}

/** 无畏掷弹兵 「未被阻挡状态下首次受到伤害时，向上下左右各发出一枚爆破弹，之后移动速度提升且重量下降」: once, at the first damage
 *  it takes while unblocked, one Bomb down each of the four lines; each explodes on the first unit it meets, ATK × atk_scale
 *  (200%) phys within projectile_range (1.1) — a line with nobody in it hits nothing; then it moves faster and its weight
 *  drops by Light.mass_level (−2) [src: handbook line; David 2026-11-26]. Move speed ×(1 + Light.move_speed): the text
 *  says it rises, so the 0.7 is the raise (a ×0.7 would slow it). */
function kitBoomer(ab) {
  const sk = ab.sk.Bomb;
  const moveUp = tv(ab, 'Light.move_speed', 0);
  const mass = tv(ab, 'Light.mass_level', 0);
  return [{
    sil: true,
    taken(c, b, e, a) {
      if (a.thrown || e.blockedBy || !e.alive || !(c.amount > 0)) return;
      a.thrown = true;
      const r = bb(sk, 'projectile_range', 1.1);
      const scale = bb(sk, 'atk_scale', 2);
      for (const { dir } of lineTargets(b, e)) {
        lineShot(b, e, dir, (t) => {
          for (const u of areaAllies(b, e, t.x, t.y, r)) hurt(b, e, u, e.s.atk * scale, 'phys');
          b.fx('blast', { x: t.x, y: t.y, r, id: e.id });
        });
      }
      b.addBuff(e, { key: 'reg:light', persist: true, visible: true, mods: { moveMul: 1 + moveUp, massFlat: mass } });
    },
  }];
}

/** 魂灵法骸: the cooldown stands in for one orbiting fragment (no stage-prop pickup). [ASSUMED] */
// (fork) 魂灵涡流 pickup, shared by 聚焦 / 棱镜魂灵残迹 and 注能 / 粹影魂灵法骸 — PRTS 关于能力: 「魂灵涡流进入自身半径0.25范围内时，若
// 自身充能未达到上限（3层）且未处于消失状态，则获得1层充能，并令此魂灵涡流立刻退场（不可对空）」. The vortex leaves the field: no kill, no
// bounty, no leak (Battle.withdrawEnemy). Upstream 0.4.0 had no pickup: the remnant never fired, the husk summoned for free.
const SOUL_KEY = 'enemy_1428_lrsoul';
const SOUL_PICK_R = 0.25;
const SOUL_CAP = 3;
function soulCharges(e) { return e.mem.soulCharges ?? 0; }
function soulPickup() {
  return {
    tick(b, e) {
      if (!e.alive || e.hidden || soulCharges(e) >= SOUL_CAP) return;
      for (const v of b.aliveEnemies()) {
        if (v === e || v.motion === 'FLY' || !(v.defId === SOUL_KEY || v.defId?.startsWith(`${SOUL_KEY}_`))) continue;
        if (hypot(v.x - e.x, v.y - e.y) > SOUL_PICK_R + 1e-9) continue;
        if (!b.withdrawEnemy(v, 'absorbed')) continue;
        e.mem.soulCharges = soulCharges(e) + 1;
        b.fx('summon', { x: e.x, y: e.y, id: e.id, key: SOUL_KEY, n: 1, kind: 'soulAbsorb' });
        if (soulCharges(e) >= SOUL_CAP) return;
      }
    },
  };
}

/**
 * 聚焦 / 棱镜魂灵残迹: 巫术激流 (PRTS skill table): 「持有充能，且自身所在行/列存在我方单位时可触发」「发射前消耗所有充能，向目标所在正方向
 * 持续发射激光（最多持续7.8s）」「激光每秒对宽度0.65的区域内所有我方单位造成自身攻击力40%的法术伤害」「技能期间，自身攻击力每秒+40%，最多
 * 提升至+(消耗充能数×25)%」 — atk_scale / atk_step / atk_ladder of its Laser skill (棱镜: 50% / +200% / 40% per charge). The beam
 * runs to the field's edge [ASSUMED: PRTS gives no length; matches the official events' behaviour, user OK 2026-11-25]; it stands still through the channel as the 死亡之眼 channel does, and a
 * stun / silence ends it [ASSUMED].
 */
const LASER_DUR = 7.8;
const LASER_HALF_W = 0.65 / 2;
function laserLine(b, e) {
  const row = Math.round(e.y), col = Math.round(e.x);
  const pick = (list) => list.find((u) => u.tileR === row) || list.find((u) => u.tileC === col) || null;
  const t = pick(byDistance(e, areaAllies(b, e, e.x, e.y, 99)));
  if (!t) return null;
  return t.tileR === row ? { axis: 'x', dir: Math.sign(t.x - e.x) || 1, at: row, t } : { axis: 'y', dir: Math.sign(t.y - e.y) || 1, at: col, t };
}
function byDistance(e, list) {
  return list.slice().sort((p, q) => (hypot(p.x - e.x, p.y - e.y) - hypot(q.x - e.x, q.y - e.y)) || (p.id < q.id ? -1 : 1));
}
function inLaser(e, L, u) {
  if (L.axis === 'x') return Math.abs(u.y - L.at) <= LASER_HALF_W + 1e-9 && (u.x - e.x) * L.dir >= -0.5;
  return Math.abs(u.x - L.at) <= LASER_HALF_W + 1e-9 && (u.y - e.y) * L.dir >= -0.5;
}
function kitLrwzrd(ab) {
  const sk = ab.sk.Laser;
  const scale = bb(sk, 'atk_scale', 0.4);
  const step = bb(sk, 'atk_step', 0.4);
  const ladder = bb(sk, 'atk_ladder', 0.25);
  return [
    soulPickup(),
    timed(sk, (b, e, a) => {
      const L = laserLine(b, e);
      const n = soulCharges(e);
      if (!L || !(n > 0)) return;
      e.mem.soulCharges = 0;
      const cap = n * ladder;
      b.addBuff(e, { key: 'ab:channel', duration: LASER_DUR, flags: { disarm: true } });
      let k = 0;
      const stop = () => {
        h.cancel(); b.removeBuff(e, 'ab:channel'); b.removeBuff(e, 'reg:laserAtk');
        if (a && a.cd != null) a.left = Math.max(a.left ?? 0, a.cd);
      };
      const h = b.every(1, () => {
        if (!e.alive) { h.cancel(); return; }
        if (e.s.flags.stun || e.s.flags.silence) { stop(); return; }
        k++;
        b.addBuff(e, { key: 'reg:laserAtk', duration: LASER_DUR, refresh: 'replace', mods: { atkPct: Math.min(cap, step * k) } });
        const hit = areaAllies(b, e, e.x, e.y, 99).filter((u) => inLaser(e, L, u));
        const far = byDistance(e, hit).pop() || L.t;
        b.fx('beam', { x: e.x, y: e.y, from: e.id, to: far.id, kind: 'soulLaser', dur: 1 });
        for (const u of hit) hurt(b, e, u, e.s.atk * scale, 'arts');
        if (k + 1 > LASER_DUR) stop();
      }, { owner: e });
    }, { sil: true, cond: (b, e) => soulCharges(e) > 0 && !!laserLine(b, e) }),
  ];
}

/** 注能 / 粹影魂灵法骸: each 魂灵残片 costs one 魂灵涡流 (PRTS 「保有魂灵涡流时，消耗魂灵涡流召唤一个…最多持有3个魂灵残片」). */
function kitLrmzrd(ab) {
  const sk = ab.sk.summonFireball;
  const scale = bb(sk, 'atk_scale', 1);
  const maxN = bb(sk, 'max_projectile_count', 3);
  return [
    soulPickup(),
    {
      tick(b, e, a, dt) {
        const list = e.mem.regFrags;
        if (!list || !list.length) return;
        const next = [];
        for (let i = 0; i < list.length; i++) {
          const f = list[i];
          f.ang += 2 * dt;
          const x = e.x + cos(f.ang) * 1;
          const y = e.y + sin(f.ang) * 1;
          let spent = false;
          for (const u of areaAllies(b, e, x, y, 0.4)) {
            hurt(b, e, u, e.s.atk * f.scale, 'arts');
            spent = true;
            break;
          }
          if (!spent) next.push(f);
        }
        e.mem.regFrags = next;
      },
    },
    timed(sk, (b, e) => {
      const list = e.mem.regFrags || (e.mem.regFrags = []);
      if (list.length >= maxN || !(soulCharges(e) > 0)) return;
      e.mem.soulCharges = soulCharges(e) - 1;
      list.push({ ang: list.length * 2.094, scale });
    }, { cond: (b, e) => soulCharges(e) > 0 && (e.mem.regFrags?.length ?? 0) < maxN }),
  ];
}

/** 假想敌：丛生: the first damage to each target is doubled, then that target cannot be healed. */
function kitAccrit(ab) {
  const scale = tv(ab, 'CriticalHit.damage_scale', 2);
  const dur = tv(ab, 'CriticalHit.duration', 5);
  return [{
    spawn(b, e, a) { a.seen = {}; },
    hitOut(c, b, e, a) {
      const t = c.target;
      if (!t || !c.dmg || a.seen[t.id]) return;
      a.seen[t.id] = true;
      c.dmg.mul *= scale;
      if (dur > 0) b.addBuff(t, { key: 'reg:crit', duration: dur, flags: { healFree: true, noHeal: true } });
    },
  }];
}

// --- REBORN (death replacement — not the reborn() archetype, except 1104_3) ----------------------------

/** Child soldiers / mechanics: their unsilenceable deathrattle uses the pinned key and delay. */
function kitDeathrattle(ab) {
  const key = sv(ab.tS, 'deathrattle.enemy_key');
  const delay = tv(ab, 'deathrattle.delay', 1);
  return [{ death(c, b, e) { if (c.reason === 'killed') replaceLater(b, e, key, delay); } }];
}

/** Bombardiers use Attack's child key and delay for their death replacement (PRTS talent). */
function kitDthrowDeath(ab) {
  const key = sv(ab.tS, 'Attack.enemy_key');
  const delay = tv(ab, 'Attack.delay', 1);
  // 「远程攻击，攻击时射出会延时爆炸的弹药，造成范围物理伤害」: its normal attack lands a shell instead of hitting; the shell
  // explodes attack@projectile_delay_time s later, its attack's damage (phys) to every unit within
  // attack@projectile_radius of where it landed [src: BWIKI 萨卡兹子裔毁击者 「攻击在延迟4s后对目标半径1.1范围内所有我方单位造成物理
  // 伤害」]. (fork) Before: an ordinary ranged hit (David's playtest of 2026-11-26).
  const fuse = tv(ab, 'Attack.attack@projectile_delay_time', 0);
  const radius = tv(ab, 'Attack.attack@projectile_radius', 1.1);
  return [{
    death(c, b, e) { if (c.reason === 'killed') replaceLater(b, e, key, delay); },
    hitOut(c, b, e) {
      if (!(fuse > 0) || !c.dmg || !c.dmg.isAttack || c.dmg.cancel || !c.target) return;
      const amount = c.dmg.amount * (Number.isFinite(c.dmg.mul) ? c.dmg.mul : 1);
      const x = c.target.x, y = c.target.y;
      c.dmg.cancel = true;
      b.fx('zone', { x, y, radius, dur: fuse, id: e.id, skill: 'dthrow:shell' });
      b.after(fuse, () => {
        for (const u of areaAllies(b, e, x, y, radius)) hurt(b, e, u, amount, 'phys', { isSkill: false, tags: ['dthrow:shell'] });
        b.fx('blast', { x, y, r: radius, id: e.id });
      });
    },
  }];
}

/** Bone defender: reuse the stationary Blood Amber path already used by the bone torturer. */
function kitSpnshdDeath(ab) {
  const key = sv(ab.tS, 'Summon.enemy_key');
  const count = tv(ab, 'Summon.cnt', 0);
  return [{
    death(c, b, e) {
      if (c.reason !== 'killed' || !key || !(count > 0)) return;
      spawnChildren(b, e, key, count, { route: stayRoute(e), countInTotal: false, mods: null });
    },
  }];
}

function auraOf(b, e, ab) {
  const key = sv(ab.tS, 'deathrattle.enemy_key');
  const step = tv(ab, 'aura.atk', 0);
  const cap = tv(ab, 'aura.max_valid_stack_cnt', 6);
  if (!key || !(step > 0)) return;
  let n = 0;
  for (const o of b.aliveEnemies()) if (o.defId === key) n++;
  n = Math.min(cap, n);
  if (n > 0) b.addBuff(e, { key: 'reg:lord', duration: 0.35, refresh: 'replace', mods: { atkPct: step * n } });
  else b.removeBuff(e, 'reg:lord');
}

function kitDklord(ab) {
  const key = sv(ab.tS, 'deathrattle.enemy_key');
  const delay = tv(ab, 'deathrattle.delay', 1);
  return [{
    tick(b, e) { auraOf(b, e, ab); },
    death(c, b, e) { if (c.reason === 'killed') replaceLater(b, e, key, delay, 1); },
  }];
}

/** 责罚者: spCost 3 reads as the 4th attack (nthOf). Splash stun. Attack.enemy_key replaces it on death (PRTS: no delay). */
function kitDfat(ab) {
  const sk = ab.sk.StunAttack;
  const n = nthOf(sk);
  const dur = bb(sk, 'stun', 4);
  const key = sv(ab.tS, 'Attack.enemy_key');
  return [
    {
      sil: true,
      attack(c, b, e, a) {
        a.n = (a.n ?? 0) + 1;
        if (a.n % n) return;
        if (!(dur > 0)) return;
        for (const u of areaAllies(b, e, e.x, e.y, BOOM_RADIUS)) b.applyStatus(u, 'stun', { duration: dur, source: e });
      },
    },
    { death(c, b, e) { if (c.reason === 'killed') replaceLater(b, e, key, 0, 1); } },
  ];
}

function kitDkmage(ab) {
  const ratio = tv(ab, 'epdamage.attack@ep_damage_ratio', 0);
  const jumps = Math.max(0, tv(ab, 'epdamage.attack@max_target', 4) - 1);
  const scale = tv(ab, 'epdamage.attack@chain.atk_scale', 0.85);
  const range = tv(ab, 'epdamage.attack@projectile_range', 1.6);
  const key = sv(ab.tS, 'deathrattle.enemy_key');
  const delay = tv(ab, 'deathrattle.delay', 1);
  return [
    ratio > 0 ? ep('apoptosis', ratio) : null,
    {
      dealt(c, b, e) {
        if (!(jumps > 0) || !c.target) return;
        let from = c.target;
        const seen = new Set([from.id]);
        let mul = scale;
        for (let i = 0; i < jumps && i < 8; i++) {
          const nxt = nearestAlly(b, e, from, range, seen);
          if (!nxt) break;
          seen.add(nxt.id);
          hurt(b, e, nxt, e.s.atk * mul, 'arts');
          if (ratio > 0) elem(b, e, nxt, 'apoptosis', e.s.atk * ratio * mul);
          mul *= scale;
          from = nxt;
        }
      },
    },
    { death(c, b, e) { if (c.reason === 'killed') replaceLater(b, e, key, delay, 1); } },
  ];
}

/** 饲育者: weighted death spawn. move_speed 2 is a move multiplier [ASSUMED]. */
function kitDsfull(ab) {
  const p1 = tv(ab, '0.prob1', 0.2);
  const p2 = tv(ab, '0.prob2', 0.5);
  const mul = tv(ab, '0.move_speed', 2);
  const cnt = tv(ab, '0.cnt', 1);
  return [{
    death(c, b, e) {
      if (c.reason !== 'killed') return;
      const r = b.rng();
      let key = sv(ab.tS, '0.enemy_3');
      if (r < p1) key = sv(ab.tS, '0.enemy_1');
      else if (r < p1 + p2) key = sv(ab.tS, '0.enemy_2');
      if (!key) return;
      const pos = [e.y, e.x];
      const route = remainingRoute(e);
      const kids = spawnChildren(b, e, key, cnt, { pos, route });
      for (let i = 0; i < kids.length; i++) {
        b.addBuff(kids[i], { key: 'reg:fast', persist: true, mods: { moveMul: mul } });
      }
    },
  }];
}

/** “左手”泰特斯: reborn() plus a silenced ATK cut on the highest-ATK ally. */
function kitLfkght(ab) {
  const sk = ab.sk.AtkDesWeaken;
  return [
    reborn({ dur: tv(ab, 'reborn.duration', 5) }),
    timed(sk, (b) => {
      let best = null;
      for (const u of b.allies()) {
        if (!u.alive) continue;
        if (!best || u.s.atk > best.s.atk || (u.s.atk === best.s.atk && u.id < best.id)) best = u;
      }
      if (!best) return;
      b.addBuff(best, { key: 'reg:weaken', duration: bb(sk, 'duration', 25), mods: { atkPct: bb(sk, 'atk', -0.5) } });
    }, { sil: true }),
  ];
}

/**
 * (fork) 变异沙地兽 / 变异岩蛛 (and their α): 「死亡时分裂两个 / 三个<畸变赘生物>」 (α: <畸变恶性瘤>) — the talent's deathrattle
 * (enemy_key, cnt, delay 0.2) on a knock-down, as 变异巨岩蛛's below [src: their talents' deathrattle.* blackboards].
 * Upstream 0.4.0 gave only the giant spider a kit, so these two split into nothing (David's report of 2026-11-25).
 */
function kitDeathSplit(ab) {
  const key = sv(ab.tS, 'deathrattle.enemy_key');
  const cnt = tv(ab, 'deathrattle.cnt', 1);
  const delay = tv(ab, 'deathrattle.delay', 0.2);
  return [{ sil: true, death(c, b, e) { if (c.reason === 'killed') replaceLater(b, e, key, delay, cnt); } }];
}

function kitHarchn(ab) {
  const key = sv(ab.tS, 'deathrattle.enemy_key');
  const cnt = tv(ab, 'deathrattle.cnt', 4);
  const delay = tv(ab, 'deathrattle.delay', 0.2);
  const sk = ab.sk.SummonToken;
  return [
    {
      sil: true,
      death(c, b, e) { if (c.reason === 'killed') replaceLater(b, e, key, delay, cnt); },
    },
    timed(sk, (b, e) => {
      const k = sv(sk.bs, 'enemy_key') || key;
      const n = bb(sk, 'cnt', 1);
      const pos = [e.y, e.x];
      const route = remainingRoute(e);
      spawnChildren(b, e, k, n, { pos, route });
    }, { sil: true }),
  ];
}

/** 寄生者: a nearby enemy's knock-down summons 大君之赐. Not its own death.
 *  被击倒 is reason 'killed' (a leak is not a knock-down). The summoned gift's own
 *  knock-down does not count: each parasite in range would replace one dead gift
 *  with another, and two of them grow without bound [ASSUMED]. */
function kitAcpara(ab) {
  const key = sv(ab.tS, 'Aura.enemy_key');
  const radius = tv(ab, 'Aura.range_radius', 1.5);
  return [{
    sil: true,
    spawn(b, e) { watchDeaths(b, e); },
    otherDeath(c, b, e) {
      const v = c.unit;
      if (c.reason !== 'killed' || !v || v === e || v.side !== 'enemy' || !key) return;
      if (v.defId === key) return;
      if (hypot(v.x - e.x, v.y - e.y) > radius + 1e-9) return;
      spawnChildren(b, e, key, 1, { pos: [v.y, v.x], route: remainingRoute(e) });
    },
  }];
}

/** 大君之触 / 大君之赐 and their elite forms (寄生者's and the heir's spawns): 「难以击倒」 — phys and arts taken
 *  ×(1 − dmg_res.damage_resistance), always (the talent has no condition) — and 「阻挡该敌人的单位阻挡数上限提升」: the
 *  unit blocking it gains buff_to_blocker.block_cnt block per such enemy it blocks, up to max_valid_stack_cnt stacks
 *  (one shared buff on the blocker, counted afresh each tick; the stack count is over every enemy with this talent
 *  that it blocks). Neither line is flagged SILENCE. */
const DZOM_BLOCK = 'reg:dzomBlock';
function kitDzom(ab) {
  const dr = Math.max(0, Math.min(1, tv(ab, 'dmg_res.damage_resistance', 0)));
  const per = tv(ab, 'buff_to_blocker.block_cnt', 0);
  const cap = Math.max(0, Math.floor(tv(ab, 'buff_to_blocker.max_valid_stack_cnt', 0)));
  const list = [];
  if (dr > 0) {
    list.push({
      hitIn(c) {
        const ty = c.dmg && c.dmg.type;
        if (ty !== 'phys' && ty !== 'arts') return;
        c.dmg.mul *= 1 - dr;
      },
    });
  }
  if (per !== 0 && cap > 0) {
    list.push({
      tick(b, e) {
        const u = e.blockedBy;
        if (!u || !u.alive || u.side !== 'ally') return;
        let n = 0;
        for (const x of b.enemies) {
          if (x.alive && x.blockedBy === u && x.mem?.ab?.t && num(x.mem.ab.t['buff_to_blocker.block_cnt']) !== 0) n++;
        }
        auraBuff(b, u, DZOM_BLOCK, 0, { blockCnt: per * Math.min(cap, n) }, null, true);
      },
    });
  }
  return list;
}

// --- the other new draws --------------------------------------------------------------------------------

/** 假想敌：影役: stealth, and block count −1 on allies in range (one shared buff, so it does not stack). */
function kitAcblk(ab) {
  const radius = tv(ab, 'Aura.range_radius', 1.8);
  const block = tv(ab, 'Aura.block_cnt', -1);
  return [
    stealth(),
    {
      tick(b, e) {
        for (const u of auraAllies(b, e, e.x, e.y, radius)) {
          if (u.kind !== 'op') continue;
          auraBuff(b, u, 'reg:blockdown', 0.25, { blockCnt: block }, null, true);
        }
      },
    },
  ];
}

/** 假想敌：镜眼: refraction, and a silenced ASPD cut on the source of arts damage. */
function kitAcrefm(ab) {
  const res = tv(ab, 'refracting.magic_resistance', 70);
  const aspd = tv(ab, 'refracting.attack_speed', -50);
  const dur = tv(ab, 'refracting.duration', 3);
  return [
    refraction(res),
    {
      sil: true,
      taken(c, b) {
        if (!c.dmg || c.dmg.type !== 'arts' || !c.source || !c.source.alive) return;
        if (!(dur > 0)) return;
        b.addBuff(c.source, { key: 'reg:refslow', duration: dur, refresh: 'replace', mods: { aspd } });
      },
    },
  ];
}

/** 假想敌：镜波: refraction, and on death the lowest-RES enemy nearby gains RES. */
function kitAcrefd(ab) {
  const res = tv(ab, 'refracting.magic_resistance', 70);
  const radius = tv(ab, 'refracting.range_radius', 1.2);
  const bonus = tv(ab, 'refracting.acrefd[magic-resistance].magic_resistance', 10);
  return [
    refraction(res),
    {
      sil: true,
      death(c, b, e) {
        if (c.reason !== 'killed' || !(bonus > 0)) return;
        let best = null;
        for (const o of b.enemiesInRadius(e.x, e.y, radius)) {
          if (!o.alive || o === e) continue;
          if (!best || o.s.res < best.s.res || (o.s.res === best.s.res && o.id < best.id)) best = o;
        }
        if (best) b.addBuff(best, { key: 'reg:res', persist: true, mods: { resFlat: bonus } });
      },
    },
  ];
}

/** “模拟宝藏”: a hostage when the enemy record itself is spawned. It does not attack (applyWay NONE)
 *  and does not move. The command deploys an ally device instead (content/bands/commands.js): enemy
 *  contact and the survival coin live there, so this kit is not the payoff. */
function kitAchest() {
  return [{
    spawn(b, e) {
      e.profile.noAttack = true;
      b.addBuff(e, { key: 'reg:hostage', persist: true, flags: { noMove: true } });
    },
  }];
}

const same = (kit) => kit;

export const REGULATION_KITS = Object.freeze({
  enemy_1406_chghmr: kitChghmr,
  enemy_1375_ltnclr: kitLtnclr,
  enemy_1375_ltnclr_2: same(kitLtnclr),
  enemy_1388_wingnt: kitWingnt,
  enemy_1309_mhboar_2: kitMhboar,
  enemy_1413_mmstck: kitMmstck,
  enemy_10163_mnctur_2: kitPalla,
  enemy_1388_wingnt_2: same(kitWingnt),
  enemy_1067_snslime_2: kitSnslime,
  enemy_1385_winbom: kitWinbom,
  enemy_1385_winbom_2: same(kitWinbom),
  enemy_1191_krgrg: kitKrgrg,
  enemy_1191_krgrg_2: same(kitKrgrg),
  enemy_1219_mtrbty: kitMtrbty,
  enemy_1409_bdguad_2: kitBdguad,
  enemy_1403_gunsho: kitGunsho,
  enemy_1403_gunsho_2: same(kitGunsho),
  enemy_1405_boomer_2: kitBoomer,
  enemy_1429_lrwzrd: kitLrwzrd,
  enemy_1429_lrwzrd_2: same(kitLrwzrd),
  enemy_1431_lrmzrd: kitLrmzrd,
  enemy_1431_lrmzrd_2: same(kitLrmzrd),
  enemy_9040_accrit: kitAccrit,
  enemy_1220_dzoms: kitDzom,
  enemy_1220_dzoms_2: same(kitDzom),
  enemy_1221_dzomg: kitDzom,
  enemy_1221_dzomg_2: same(kitDzom),
  enemy_1222_dpvt: kitDeathrattle,
  enemy_1222_dpvt_2: same(kitDeathrattle),
  enemy_1223_dmech: kitDeathrattle,
  enemy_1223_dmech_2: same(kitDeathrattle),
  enemy_1361_dthrow: kitDthrowDeath,
  enemy_1361_dthrow_2: same(kitDthrowDeath),
  enemy_1363_spnshd_2: kitSpnshdDeath,
  enemy_1226_dklord: kitDklord,
  enemy_1226_dklord_2: same(kitDklord),
  enemy_1362_dfat: kitDfat,
  enemy_1362_dfat_2: same(kitDfat),
  enemy_1225_dkmage: kitDkmage,
  enemy_1225_dkmage_2: same(kitDkmage),
  enemy_1437_dsfull: kitDsfull,
  enemy_1436_dsdivi: kitDivi,
  enemy_1436_dsdivi_2: same(kitDivi),
  enemy_1437_dsfull_2: same(kitDsfull),
  enemy_1104_lfkght_3: kitLfkght,
  enemy_1131_sbeast: kitDeathSplit,
  enemy_1131_sbeast_2: same(kitDeathSplit),
  enemy_1132_sarchn: kitDeathSplit,
  enemy_1132_sarchn_2: same(kitDeathSplit),
  enemy_1133_harchn: kitHarchn,
  enemy_1133_harchn_2: same(kitHarchn),
  enemy_9030_acpara: kitAcpara,
  enemy_9034_acblk: kitAcblk,
  enemy_9039_acrefm: kitAcrefm,
  enemy_9031_acrefd: kitAcrefd,
  enemy_9038_achest: kitAchest,
});
