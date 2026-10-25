(function (OS) {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;
  OS.createGame = function (cfg, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const emit = opts.emit || function () {};
    const rnd = (a, b) => a + rng() * (b - a);
    const pickOne = a => a[Math.floor(rng() * a.length)];
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const line = (arr, up) => pickOne(arr).replace('{up}', up || '').replace('{rival}', OS.RIVAL_NAME);
    const W = cfg.arena, H = cfg.arena;
    const adj = n => !!cfg.adj[n];
    const G = { cfg, phase: 'idle', run: null, w: null, pick: null, enemyOpts: null, W, H, line };
    function baseStats() {
      const P = cfg.player;
      return {
        fireInt: P.fireInt, dmg: P.dmg, bulletSpeed: P.bulletSpeed, bulletLife: P.bulletLife, bulletR: P.bulletR,
        shots: 1, spreadAng: 0, bounce: 0, bounceHurts: false, bounceSelfR: 0, pierce: 0, aim: true, backShot: false,
        speed: P.speed, accel: P.accel, bodyR: P.bodyR, dodgeCd: P.dodgeCd,
        dodgeBlastR: 0, dodgeBlastDmg: 0, lunge: 0, ramDmg: 0, lungeInv: 0, lungeIdle: false,
        vampChance: 0, vampCd: 0, drain: 0, magnetR: 0, magnetPull: 0, touchKill: false,
        mineEvery: 0, mineDmg: 0, mineR: 0,
        orbitN: 0, orbitDist: 36, orbitSize: 7, orbitDmg: 0, orbitOff: 0,
        homing: 0, jitter: 0, sideShot: false,
        thornsN: 0, thornsDmg: 0, hurtInvMul: 1,
        slowR: 0, slowK: 1, dodgeSpeedMul: 1,
        burstR: 0, burstDmg: 0, burstSelf: false, burstSelfR: 0,
        targetFar: false,
        freeze: 0, freezeK: 1,
        shieldR: 0, shieldCos: 0, blockThorns: 0,
        splitN: 0, splitDmg: 0,
        boltEvery: 0, boltN: 0, boltDmg: 0, boltStun: 0,
        critChance: 0, critHeal: false
      };
    }
    const q = (normal, key) => (adj(4) && cfg.quirkHeavy[key] != null ? cfg.quirkHeavy[key] : normal);
    const EXTRA_MAX = 5;
    function computeStats(run) {
      const s = baseStats();
      for (const k of Object.keys(OS.UPGRADES)) if (run.ups.includes(k)) OS.UPGRADES[k].mod(s, q, cfg);
      for (const c of OS.COMBOS) if (run.combos.includes(c.id)) c.mod(s, q, cfg);
      for (const k in run.extras || {}) for (let i = 0; i < Math.min(run.extras[k], EXTRA_MAX); i++) OS.EXTRAS[k].mod(s);
      s.dodgeCd = Math.max(s.dodgeCd, 0.4);
      const ms = Math.pow(1.1, Math.min(run.milestones || 0, 5));     s.speed *= ms; s.fireInt /= ms;
      return s;
    }
    G.has = k => !!G.run && G.run.ups.includes(k);
    G.combo = id => !!G.run && G.run.combos.includes(id);
    G.newRun = function () {
      const E = cfg.enemies;
      G.run = {
        round: 0, rounds: cfg.rounds, hp: cfg.player.hp, maxHp: cfg.player.hp, ups: [], combos: [], veto: cfg.veto.count, kills: 0,
        nextLenMul: 1, nextLenAdd: 0, takenBuffs: [], log: [], lastHabit: null, lastWhy: '', bossKills: 0, diedTo: '',
        extras: {}, extraN: 0, milestones: 0, vetoUsed: 0, hurtN: 0,
        vetoGauge: 0, vetoNeed: cfg.vetoGauge ? cfg.vetoGauge.first : 0, vetoGained: 0,
        mod: { eSpd: 1, eNum: 1, eBul: 1, eHp: 1, shootRate: 1, tele: 1, split: false, w: Object.assign({}, E.weights) }
      };
      G.run.s = computeStats(G.run);
      const B = cfg.boss;
      if (B.random) { const pool = shuffle(B.pool.slice()); G.run.bossKinds = {}; B.rounds.forEach((r, i) => { G.run.bossKinds[r] = pool[i % pool.length]; }); }
      startRound();
    };
    function startRound() {
      const run = G.run;
      run.round++;
      const E = cfg.endless;
      if (run.endless && E && E.rampFrom && run.round > E.rampFrom) {
        run.mod.eHp *= E.rampHp; run.rampHpMul = (run.rampHpMul || 1) * E.rampHp;
        run.rampNum = Math.min(E.rampNumMax || 3, (run.rampNum || 1) * (E.rampNum || 1)); run.mod.eNum *= (run.rampNum / (run.rampNumPrev || 1)); run.rampNumPrev = run.rampNum;
      }
      if (run.endless && cfg.boss.mephy && run.round === cfg.boss.mephy.at) run.eHpAtMephy = run.mod.eHp;
      const len = isMephyRound(run.round) ? Infinity : roundLength(run.round) * run.nextLenMul + run.nextLenAdd;
      run.nextLenMul = 1; run.nextLenAdd = 0;
      const s = run.s;
      G.w = {
        t: 0, len, en: [], pb: [], eb: [], warn: [], bombs: [], mines: [], mineT: 0.3, orbA: 0, orbOffT: 0, boltT: 1.0, spawn: cfg.firstSpawn, end: -1, over: false, overT: 0,
        hb: { dodges: 0, dist: 0, dn: 0, move: 0, tt: 0 }, drain: s.drain, vampCd: 0,
        bossT: isBossRound(run.round) ? 1.5 : -1, boss: null, bossGone: false, gifts: [],
        p: { x: W / 2, y: H * 0.62, vx: 0, vy: 0, fx: 0, fy: -1, r: s.bodyR, dodge: 0, dodgeCd: 0, inv: 0, fire: 0.3, dvx: 0, dvy: 0, lungeT: 0 }
      };
      G.phase = 'play';
      const open = (cfg.openingWave || [])[run.round - 1] || 0;
      for (let i = 0; i < open; i++) spawnEnemy();
      emit('round', { round: run.round, boss: G.w.bossT >= 0, mephy: isMephyRound(run.round) });
    }
    function isBossRound(r) {
      if (!adj(3)) return false;
      if (cfg.boss.rounds.includes(r)) return true;
      const E = cfg.endless;
      return !!(G.run && G.run.endless && E && r > cfg.rounds && r % E.bossEvery === 0);
    }
    function isMephyRound(r) { const M = cfg.boss.mephy; return !!(M && G.run && G.run.endless && r >= M.at && r % M.at === 0 && isBossRound(r)); }
    const mephyNth = r => Math.floor(r / cfg.boss.mephy.at);
    const mephyHon = r => (cfg.tier || 0) >= 6 || mephyNth(r) >= 2;
    G.isMephyRound = isMephyRound; G.mephyNth = mephyNth; G.mephyHon = mephyHon;
    function roundLength(r) {
      const L = cfg.shortStart && cfg.startLens ? cfg.startLens[r - 1] : null;
      return L != null ? L : cfg.roundLen;
    }
    G.roundLength = roundLength;
    const healCapped = () => { const r = G.run, E = cfg.endless; return !!(r.endless && E && E.rampFrom && r.round > E.rampFrom && (G.w.heals || 0) >= 2); };
    function spawnInterval(r) {
      const o = adj(2) ? cfg.spawnNew : cfg.spawnOld;
      return Math.max(o.min, o.base * Math.pow(o.mul, r - 1));
    }
    function enemyHp(type, r) {
      if (adj(2)) return cfg.enemyHpNew[type] * Math.pow(cfg.spawnNew.hpGrowth, r - 1);
      const e = cfg.enemies[type];
      return e.hp + r * e.hpRound;
    }
    function edgePos() {
      const side = Math.floor(rng() * 4);
      if (side === 0) return [rnd(20, W - 20), -10];
      if (side === 1) return [W + 10, rnd(20, H - 20)];
      if (side === 2) return [rnd(20, W - 20), H + 10];
      return [-10, rnd(20, H - 20)];
    }
    function mkEnemy(type, x, y, hp) {
      const d = OS.ENEMIES[type];
      return { type, ai: d.ai, x, y, r: d.r, hp, max: hp, t: 0, tt: rnd(1, 2), st: 'move', ax: 0, ay: 0, flash: 0, ct: 0, oc: 0, frozen: 0, face: 0, dead: false, spin: 0 };
    }
    function spawnEnemy() {
      const r = G.run.round, m = G.run.mod;
      const types = Object.keys(m.w).filter(k => OS.ENEMIES[k].from <= r);
      let total = 0; for (const k of types) total += m.w[k];
      let roll = rng() * total, type = types[0];
      for (const k of types) { roll -= m.w[k]; if (roll <= 0) { type = k; break; } }
      const [x, y] = edgePos();
      G.w.warn.push({ type, x, y, t: cfg.spawnWarn, max: cfg.spawnWarn, hp: Math.max(1, Math.round(enemyHp(type, r) * m.eHp)) });
    }
    function spawnBoss() {
      const B = cfg.boss, r = G.run.round;
      const last = B.rounds[B.rounds.length - 1], E = cfg.endless;
      const baseHp = B.hp[r] != null ? B.hp[r] : B.hp[last] * Math.pow(E ? E.bossHpGrow : 1.5, (r - last) / (E ? E.bossEvery : 5));
      const mephy = isMephyRound(r), M = cfg.boss.mephy;
      const eHp = mephy ? G.run.mod.eHp : G.run.mod.eHp / (G.run.rampHpMul || 1);
      let hp = baseHp * eHp * (mephy ? ((cfg.tier || 0) >= 6 ? M.hpMul6 : M.hpMul) : 1);
      if (mephy && mephyNth(r) >= 2) {
        const base50 = B.hp[last] * Math.pow(E ? E.bossHpGrow : 1.5, (M.at - last) / (E ? E.bossEvery : 5));
        hp = base50 * (G.run.eHpAtMephy || G.run.mod.eHp) * M.hpMul6 * Math.pow(M.againMul || 1.5, mephyNth(r) - 1);
      }
      const e = mkEnemy('boss', W / 2, -30, hp);
      let kind = B.kinds && B.kinds[r];
      if (kind == null && G.run.bossKinds && G.run.bossKinds[r] != null) kind = G.run.bossKinds[r];
      if (kind == null && G.run.endless && r > cfg.rounds) { const pool = B.pool.filter(k => k !== G.run.lastBoss); kind = pickOne(pool); }
      if (mephy) kind = 'mephy';
      e.kind = kind || ''; G.run.lastBoss = e.kind; e.name = OS.BOSS_NAMES[e.kind] || OS.BOSS_NAMES[''];
      e.r = B.r; e.ring = B.ringEvery * 0.6; e.aimed = B.aimedEvery; e.spiral = 0; e.ang = 0; e.wx = W / 2; e.wy = H * 0.3;
      G.w.en.push(e); G.w.boss = e;
      const hon = mephy && mephyHon(r);
      emit('boss', { line: line(mephy ? (hon ? OS.LINES.mephyIn6 : OS.LINES.mephyIn) : OS.LINES.boss), kind: e.kind, name: e.name, mephy, hon });
    }
    function hurt(src) {
      const w = G.w, p = w.p, run = G.run;
      if (G.devInv) return;
      if (p.inv > 0 || w.over || w.end >= 0) return;
      run.hp--; run.hurtN++;
      p.inv = (adj(6) ? cfg.hurtInvShort : cfg.player.hurtInv) * run.s.hurtInvMul;
      emit('hurt', { x: p.x, y: p.y, src });
      const s = run.s;
      if (s.thornsN) {
        for (let i = 0; i < s.thornsN; i++) {
          const a = i * TAU / s.thornsN + rng() * 0.2;
          w.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 4, dmg: s.thornsDmg, life: 0.8, bounce: 0, pierce: 1, hit: [], bounced: false, thorn: true });
        }
        emit('thorns', { x: p.x, y: p.y });
      }
      if (run.hp <= 0) { w.over = true; w.overT = 0.9; run.diedTo = src; emit('dead', { x: p.x, y: p.y }); }
    }
    function gainGauge(n) {
      const VG = cfg.vetoGauge, run = G.run;
      if (!VG || !VG.on) return;
      if (run.endless && run.round > run.rounds) return;
      run.vetoGauge += n;
      while (run.vetoGauge >= run.vetoNeed) {
        if (run.veto >= VG.max) { run.vetoGauge = run.vetoNeed; return; }
        run.vetoGauge -= run.vetoNeed; run.veto++; run.vetoGained++;
        run.vetoNeed = Math.round(run.vetoNeed * VG.growth);
        emit('vetoGain', { veto: run.veto, line: line(OS.LINES.vetoGain) });
      }
    }
    function damageEnemy(e, d) {
      if (e.dead) return;
      e.hp -= d; e.flash = 0.1;
      const run = G.run, w = G.w, s = run.s;
      if (e.hp > 0) { emit('hit', { x: e.x, y: e.y, boss: e.ai === 'boss' }); return; }
      e.dead = true;
      if (e.ai === 'boss') {
        run.kills += cfg.boss.killScore; run.bossKills++; gainGauge(cfg.boss.killScore);
        const hp0 = run.hp; run.hp = Math.max(run.hp, Math.min(run.maxHp, run.hp + cfg.boss.healOnKill));
        const VG = cfg.vetoGauge, cap = VG ? VG.max : 3, v0 = run.veto;
        run.veto = Math.min(cap, run.veto + (cfg.boss.vetoOnKill || 0));
        w.eb = []; w.gifts = []; w.boss = null; w.bossKilled = true;
        const mephy = e.kind === 'mephy', hon = mephy && mephyHon(run.round);
        if (mephy) { run.mephyDown = true; run.mephyDownRound = run.round; if ((cfg.tier || 0) >= 6) run.mephyDown6 = true; }
        emit('bossDown', { x: e.x, y: e.y, kind: e.kind, name: e.name, mephy, hon, tier6: mephy && (cfg.tier || 0) >= 6, line: line(mephy ? (hon ? OS.LINES.mephyDown6 : OS.LINES.mephyDown) : OS.LINES.bossDown), heal: run.hp - hp0, veto: run.veto - v0 });
      } else {
        run.kills++; gainGauge(1);
        emit('kill', { x: e.x, y: e.y, type: e.type, sucked: !!e.sucked });
      }
      if (e.type === 'chase' && run.mod.split) {
        for (let i = 0; i < 2; i++) {
          const m = mkEnemy('mini', e.x + (i ? 8 : -8), e.y, Math.max(0.5, e.max * 0.4));
          m.spdMul = 1.2; w.en.push(m);
        }
      }
      if (s.vampChance && w.vampCd <= 0 && rng() < s.vampChance && run.hp < run.maxHp && !healCapped()) { run.hp++; w.vampCd = s.vampCd; w.heals = (w.heals || 0) + 1; emit('heal', { x: w.p.x, y: w.p.y }); }
    }
    function farthest(p) {
      let b = null, bd = -1;
      for (const e of G.w.en) { if (e.dead || e.x < 0 || e.x > W || e.y < 0 || e.y > H) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > bd) { bd = d; b = e; } }
      return b;
    }
    function nearest(p) {
      let b = null, bd = 1e9;
      for (const e of G.w.en) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; b = e; } }
      return [b, bd];
    }
    G.nearest = nearest;
    G.dodgeCdNow = () => G.run.s.dodgeCd;
    const AI = {
      chase(e, dt, a, d, es) {
        const sp = cfg.enemies.chase.speed * es * (e.spdMul || 1);
        e.x += Math.cos(a) * sp * dt; e.y += Math.sin(a) * sp * dt;
      },
      shoot(e, dt, a, d, es, m) {
        const E = cfg.enemies.shoot;
        const want = d > 190 ? 1 : d < 140 ? -1 : 0;
        e.x += Math.cos(a) * E.speed * es * want * dt; e.y += Math.sin(a) * E.speed * es * want * dt;
        if (e.x < 12 || e.x > W - 12 || e.y < 12 || e.y > H - 12) { e.x += Math.cos(a) * 40 * dt; e.y += Math.sin(a) * 40 * dt; }
        if (e.tt <= 0) {
          e.tt = rnd(E.fireMin, E.fireMax) / es / m.shootRate;
          const sp = E.bulletSpeed * m.eBul;
          G.w.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, src: OS.ENEMIES.shoot.name + 'の弾' });
          e.flash = 0.08;
        }
      },
      dash(e, dt, a, d, es, m) {
        const E = cfg.enemies.dash;
        if (e.st === 'move') {
          e.x += Math.cos(a) * E.speed * es * dt; e.y += Math.sin(a) * E.speed * es * dt;
          if (e.tt <= 0 && d < 260) { e.st = 'tele'; e.tt = E.tele * m.tele; e.ax = Math.cos(a); e.ay = Math.sin(a); }
        } else if (e.st === 'tele') { if (e.tt <= 0) { e.st = 'dash'; e.tt = E.dashTime; } }
        else if (e.st === 'dash') {
          e.x += e.ax * E.dashSpeed * es * dt; e.y += e.ay * E.dashSpeed * es * dt;
          if (e.tt <= 0) { e.st = 'move'; e.tt = rnd(1.4, 2.2); }
        }
      },
      bomber(e, dt, a, d, es) {
        const E = cfg.enemies.bomber, w = G.w, p = w.p;
        if (e.st === 'move') {
          e.x += Math.cos(a) * E.speed * es * dt; e.y += Math.sin(a) * E.speed * es * dt;
          if (d < E.trigger) { e.st = 'fuse'; e.tt = E.fuse; e.fuseMax = E.fuse; }
        } else if (e.st === 'fuse' && e.tt <= 0) {
          e.dead = true; e.exploded = true;
          emit('bomb', { x: e.x, y: e.y, r: E.radius });
          if (Math.hypot(p.x - e.x, p.y - e.y) < E.radius + p.r) hurt(OS.ENEMIES.bomber.name + 'の爆発');
        }
      },
      guard(e, dt, a, d, es) {
        const E = cfg.enemies.guard;
        let diff = Math.atan2(Math.sin(a - e.face), Math.cos(a - e.face));
        e.face += clamp(diff, -1.3 * dt, 1.3 * dt);
        e.x += Math.cos(a) * E.speed * es * dt; e.y += Math.sin(a) * E.speed * es * dt;
      },
      boss(e, dt, a, d, es, m) {
        const B = cfg.boss, w = G.w, p = w.p;
        if (e.y < 60 && e.t < 3) { e.y += 50 * dt; return; }
        if (e.kind === 'summon') { summonBoss(e, dt, a, es, m); return; }
        if (e.kind === 'charge') { chargeBoss(e, dt, a, es, m); return; }
        if (e.kind === 'spiral') { spiralBoss(e, dt, a, es, m); return; }
        if (e.kind === 'bomb') { bombBoss(e, dt, a, es, m); return; }
        if (e.kind === 'mephy') { mephyBoss(e, dt, a, es, m); return; }
        if (Math.hypot(e.wx - e.x, e.wy - e.y) < 20 || e.t % 4 < dt) {
          const ang = rnd(0, TAU), rr = rnd(80, 150);
          e.wx = clamp(p.x + Math.cos(ang) * rr, 50, W - 50); e.wy = clamp(p.y + Math.sin(ang) * rr, 50, H - 50);
        }
        const wa = Math.atan2(e.wy - e.y, e.wx - e.x);
        e.x += Math.cos(wa) * B.speed * es * dt; e.y += Math.sin(wa) * B.speed * es * dt;
        e.x = clamp(e.x, e.r, W - e.r); e.y = clamp(e.y, e.r, H - e.r);
        const bs = m.eBul;
        e.ring -= dt; e.aimed -= dt;
        if (e.ring <= 0) {
          e.ring = B.ringEvery; e.ang += 0.37;
          for (let i = 0; i < B.ringCount; i++) {
            const aa = e.ang + i * TAU / B.ringCount;
            w.eb.push({ x: e.x, y: e.y, vx: Math.cos(aa) * B.ringSpeed * bs, vy: Math.sin(aa) * B.ringSpeed * bs, r: 6, src: bsrc() });
          }
          e.flash = 0.1;
        }
        if (e.aimed <= 0) {
          e.aimed = B.aimedEvery;
          for (let i = -1; i <= 1; i++) {
            const aa = a + i * 0.22;
            w.eb.push({ x: e.x, y: e.y, vx: Math.cos(aa) * B.aimedSpeed * bs, vy: Math.sin(aa) * B.aimedSpeed * bs, r: 5, src: bsrc() });
          }
        }
        if (G.run.round >= B.spiralFrom) {
          e.spiral -= dt;
          if (e.spiral <= 0) {
            e.spiral = B.spiralEvery; e.spin += 0.5;
            for (const off of [0, Math.PI]) {
              const aa = e.spin + off;
              w.eb.push({ x: e.x, y: e.y, vx: Math.cos(aa) * B.spiralSpeed * bs, vy: Math.sin(aa) * B.spiralSpeed * bs, r: 4.5, src: bsrc() });
            }
          }
        }
      }
    };
    const bsrc = () => (G.w.boss ? G.w.boss.name : OS.ENEMIES.boss.name) + 'の弾';
    const ringAt = (x, y, n, sp, off, bs, src) => { for (let i = 0; i < n; i++) { const aa = off + i * TAU / n; G.w.eb.push({ x, y, vx: Math.cos(aa) * sp * bs, vy: Math.sin(aa) * sp * bs, r: 5.5, src: src || bsrc() }); } };
    function mephyBoss(e, dt, a, es, m) {
      const B = cfg.boss, S = B.mephy, w = G.w, p = w.p, hon = mephyHon(G.run.round);
      if (!e.rage && (e.hp < e.max * (hon ? S.rageHp6 : S.rageHp) || e.t > S.rageAt)) { e.rage = true; emit('mephyRage', { line: line(OS.LINES.mephyRage) }); }
      const k = e.rage ? S.rageMul : 1, bs = m.eBul * (e.rage ? 1.15 : 1);
      const tx = W / 2 + Math.sin(e.t * 0.45) * W * 0.32, ty = H * 0.22 + Math.sin(e.t * 0.9) * 28;
      const wa = Math.atan2(ty - e.y, tx - e.x), dd = Math.hypot(tx - e.x, ty - e.y), sp = Math.min(dd / Math.max(dt, 1e-3), 80 * es);
      e.x += Math.cos(wa) * sp * dt; e.y += Math.sin(wa) * sp * dt;
      e.gift = (e.gift == null ? 1.2 : e.gift) - dt; e.throwT = (e.throwT || 0) - dt;
      if (e.gift <= 0) {
        e.gift = S.gift * k; e.throwT = 0.4;
        const n = hon && e.hp < e.max * 0.5 ? 2 : 1;
        for (let i = 0; i < n; i++) { const aa = a + (n > 1 ? (i - 0.5) * 0.55 : 0); w.gifts.push({ x: e.x, y: e.y, vx: Math.cos(aa) * S.giftSpeed * bs, vy: Math.sin(aa) * S.giftSpeed * bs, t: S.giftFuse, max: S.giftFuse, r: 12, rot: 0 }); }
        emit('lob', { x: e.x, y: e.y });
      }
      if (hon) {
        const hk = e.hp / e.max;
        e.sk = e.sk || 0;
        const step = hk < 0.25 ? 3 : hk < 0.5 ? 2 : hk < 0.75 ? 1 : 0;
        if (step > e.sk) { e.sk = step; emit('mephySkill', { step, line: OS.LINES.mephySkill[step - 1] }); }
        e.ring = (e.ring == null ? 2 : e.ring) - dt;
        if (e.ring <= 0) { e.ring = B.ringEvery * 1.6 * k; ringAt(e.x, e.y, B.ringCount, B.ringSpeed, rnd(0, TAU), bs); e.flash = 0.08; }
        if (hk < 0.75) {
          const Sp = B.spiral; e.shot = (e.shot || 0) - dt;
          if (e.shot <= 0) { e.shot = Sp.every * 2.4 * k; e.spin = (e.spin || 0) + Sp.turn; for (let i = 0; i < 3; i++) { const aa = e.spin + i * TAU / 3; w.eb.push({ x: e.x, y: e.y, vx: Math.cos(aa) * Sp.speed * bs, vy: Math.sin(aa) * Sp.speed * bs, r: 5, src: bsrc() }); } }
        }
        if (hk < 0.5) {
          const Ss = B.summon; e.call = (e.call == null ? 1.5 : e.call) - dt;
          if (e.call <= 0) {
            e.call = Ss.callEvery * 1.4 * k;
            for (let i = 0; i < Ss.callN; i++) { const ang = rnd(0, TAU), hp = Math.max(1, Math.round(enemyHp('chase', G.run.round) * m.eHp)); w.en.push(mkEnemy('chase', e.x + Math.cos(ang) * 40, e.y + Math.sin(ang) * 40, hp)); }
            emit('call', { x: e.x, y: e.y });
          }
        }
        if (hk < 0.25) {
          const Sc = B.charge;
          if (e.tele > 0) {
            e.tele -= dt;
            if (e.tele <= 0) { w.gifts.push({ x: e.x, y: e.y, vx: e.dx * Sc.speed * 0.75 * bs, vy: e.dy * Sc.speed * 0.75 * bs, t: 9, max: 9, r: 15, rot: 0, dash: true }); emit('lob', { x: e.x, y: e.y }); }
          } else {
            e.cd = (e.cd == null ? 1.2 : e.cd) - dt;
            if (e.cd <= 0) { e.cd = Sc.every * 1.6 * k; e.tele = e.teleMax = Sc.tele; e.dx = Math.cos(a); e.dy = Math.sin(a); }
          }
        }
        if (hk < 0.25) {
          const Sb = B.bomb; e.lob = (e.lob == null ? 1 : e.lob) - dt;
          if (e.lob <= 0) { e.lob = Sb.every * 1.7 * k; for (let i = 0; i < 2; i++) { const ang = rnd(0, TAU), rr = i ? rnd(Sb.spread * 0.5, Sb.spread) : 0; w.bombs.push({ x: clamp(p.x + Math.cos(ang) * rr, 20, W - 20), y: clamp(p.y + Math.sin(ang) * rr, 20, H - 20), t: Sb.fuse + i * 0.15, max: Sb.fuse + i * 0.15 }); } }
        }
      } else {
        e.aimed = (e.aimed == null ? 2 : e.aimed) - dt;
        if (e.aimed <= 0) { e.aimed = B.aimedEvery * 1.6 * k; for (let i = -1; i <= 1; i++) { const aa = a + i * 0.22; w.eb.push({ x: e.x, y: e.y, vx: Math.cos(aa) * B.aimedSpeed * bs, vy: Math.sin(aa) * B.aimedSpeed * bs, r: 5, src: bsrc() }); } }
      }
      for (const g of w.gifts) {
        g.x += g.vx * dt; g.y += g.vy * dt; g.t -= dt; g.rot += dt * (g.dash ? 14 : 5);
        const hitP = Math.hypot(p.x - g.x, p.y - g.y) < p.r + g.r;
        if (hitP) hurt('メフィーのプレゼント');
        if (hitP || g.t <= 0 || g.x < 0 || g.x > W || g.y < 0 || g.y > H) {
          g.dead = true;
          const Sc = cfg.boss.charge;
          ringAt(clamp(g.x, 10, W - 10), clamp(g.y, 10, H - 10), g.dash ? Sc.ringN : S.giftN, g.dash ? Sc.ringSpeed : S.giftBullet, rnd(0, TAU), e.rage ? 1.15 : 1, 'メフィーのプレゼント');
          emit(g.dash ? 'slam' : 'giftPop', { x: g.x, y: g.y });
        }
      }
      w.gifts = w.gifts.filter(g => !g.dead);
    }
    function chargeBoss(e, dt, a, es, m) {
      const S = cfg.boss.charge, w = G.w;
      if (e.dashT > 0) {
        e.dashT -= dt;
        e.x += e.dx * S.speed * dt; e.y += e.dy * S.speed * dt;
        const hit = e.x < e.r || e.x > W - e.r || e.y < e.r || e.y > H - e.r;
        e.x = clamp(e.x, e.r, W - e.r); e.y = clamp(e.y, e.r, H - e.r);
        if (hit || e.dashT <= 0) { e.dashT = 0; e.cd = S.every; ringAt(e.x, e.y, S.ringN, S.ringSpeed, rnd(0, TAU), m.eBul); e.flash = 0.12; emit('slam', { x: e.x, y: e.y }); }
        return;
      }
      if (e.tele > 0) { e.tele -= dt; if (e.tele <= 0) e.dashT = S.time; return; }
      e.cd = (e.cd == null ? 1.6 : e.cd) - dt;
      e.x += Math.cos(a) * 26 * es * dt; e.y += Math.sin(a) * 26 * es * dt;
      e.x = clamp(e.x, e.r, W - e.r); e.y = clamp(e.y, e.r, H - e.r);
      if (e.cd <= 0) { e.tele = e.teleMax = S.tele; e.dx = Math.cos(a); e.dy = Math.sin(a); }
    }
    function spiralBoss(e, dt, a, es, m) {
      const S = cfg.boss.spiral, w = G.w;
      const tx = W / 2 + Math.cos(e.t * 0.4) * 60, ty = H * 0.4 + Math.sin(e.t * 0.5) * 40;
      const wa = Math.atan2(ty - e.y, tx - e.x);
      e.x += Math.cos(wa) * S.moveSpeed * es * dt; e.y += Math.sin(wa) * S.moveSpeed * es * dt;
      e.dir = e.dir || 1; e.flipT = (e.flipT == null ? S.flip : e.flipT) - dt;
      if (e.flipT <= 0) { e.flipT = S.flip; e.dir = -e.dir; e.pause = 0.6; }
      if (e.pause > 0) { e.pause -= dt; return; }
      e.shot = (e.shot || 0) - dt;
      if (e.shot <= 0) {
        e.shot = S.every; e.spin = (e.spin || 0) + S.turn * e.dir;
        for (let i = 0; i < S.arms; i++) { const aa = e.spin + i * TAU / S.arms; w.eb.push({ x: e.x, y: e.y, vx: Math.cos(aa) * S.speed * m.eBul, vy: Math.sin(aa) * S.speed * m.eBul, r: 5, src: bsrc() }); }
      }
    }
    function bombBoss(e, dt, a, es, m) {
      const S = cfg.boss.bomb, w = G.w, p = w.p;
      if (Math.hypot(e.wx - e.x, e.wy - e.y) < 20 || e.t % 4 < dt) { e.wx = rnd(60, W - 60); e.wy = rnd(50, H * 0.45); }
      const wa = Math.atan2(e.wy - e.y, e.wx - e.x);
      e.x += Math.cos(wa) * 34 * es * dt; e.y += Math.sin(wa) * 34 * es * dt;
      e.x = clamp(e.x, e.r, W - e.r); e.y = clamp(e.y, e.r, H - e.r);
      e.lob = (e.lob == null ? 1.2 : e.lob) - dt;
      if (e.lob <= 0) {
        e.lob = S.every;
        for (let i = 0; i < S.n; i++) {
          const ang = rnd(0, TAU), rr = i === 0 ? 0 : rnd(S.spread * 0.5, S.spread);
          w.bombs.push({ x: clamp(p.x + Math.cos(ang) * rr, 20, W - 20), y: clamp(p.y + Math.sin(ang) * rr, 20, H - 20), t: S.fuse + i * 0.15, max: S.fuse + i * 0.15 });
        }
        e.flash = 0.08; emit('lob', { x: e.x, y: e.y });
      }
    }
    function summonBoss(e, dt, a, es, m) {
      const S = cfg.boss.summon, w = G.w, p = w.p, bs = m.eBul;
      e.orb = (e.orb || 0) + dt * 0.5;
      const tx = clamp(p.x + Math.cos(e.orb) * 150, 50, W - 50), ty = clamp(p.y + Math.sin(e.orb) * 150, 50, H - 50);
      const wa = Math.atan2(ty - e.y, tx - e.x);
      e.x += Math.cos(wa) * S.speed * es * dt; e.y += Math.sin(wa) * S.speed * es * dt;
      e.x = clamp(e.x, e.r, W - e.r); e.y = clamp(e.y, e.r, H - e.r);
      e.fan = (e.fan == null ? S.fanEvery : e.fan) - dt; e.call = (e.call == null ? 2 : e.call) - dt;
      if (e.fan <= 0) {
        e.fan = S.fanEvery;
        for (let i = 0; i < S.fanN; i++) {
          const aa = a + (i - (S.fanN - 1) / 2) * 0.2;
          w.eb.push({ x: e.x, y: e.y, vx: Math.cos(aa) * S.fanSpeed * bs, vy: Math.sin(aa) * S.fanSpeed * bs, r: 5, src: bsrc() });
        }
        e.flash = 0.08;
      }
      if (e.call <= 0) {
        e.call = S.callEvery;
        for (let i = 0; i < S.callN; i++) {
          const ang = rnd(0, TAU), hp = Math.max(1, Math.round(enemyHp('chase', G.run.round) * m.eHp));
          w.en.push(mkEnemy('chase', e.x + Math.cos(ang) * 40, e.y + Math.sin(ang) * 40, hp));
        }
        emit('call', { x: e.x, y: e.y });
      }
    }
    G.update = function (dt, inp) {
      const w = G.w, run = G.run, s = run.s, p = w.p, m = run.mod;
      w.t += dt;
      if (w.over) { w.overT -= dt; if (w.overT <= 0) { G.phase = 'lose'; emit('end', { win: false }); } return; }
      if (w.end >= 0) {
        w.end -= dt;
        if (w.end < 0) {
          if (run.round >= run.rounds && !run.endless) { G.phase = 'win'; emit('end', { win: true }); }
          else {
            if (run.endless && run.round > run.rounds && run.round % 5 === 0) { run.milestones++; run.s = computeStats(run); const h0 = run.hp; run.hp = Math.min(run.maxHp, run.hp + 1); emit('milestone', { round: run.round, up: run.milestones <= 5, heal: run.hp - h0, line: line(OS.LINES.milestone) }); }
            G.phase = 'roundEnd';
          }
        }
        return;
      }
      const bossDead = w.hadBoss && !w.boss && !w.bossGone;
      const OT = cfg.endless && cfg.endless.overtime;
      if (OT && w.t >= w.len && w.boss && !w.boss.dead && run.endless && run.round > run.rounds && !w.otAsked) {
        w.t = w.len; w.otAsked = true; G.phase = 'overtimeAsk'; emit('overtimeAsk', { hp: w.boss.hp / w.boss.max, sec: OT });
        return;
      }
      if (w.t >= w.len || bossDead) {
        w.end = 0.9;
        emit('roundClear', { enemies: w.en.filter(e => !e.dead), bossLeft: !!w.boss, byBoss: !!w.bossKilled });
        w.en = []; w.eb = []; w.warn = []; w.bombs = []; w.gifts = []; w.boss = null; w.bossGone = true;
        return;
      }
      let mx = inp.mx || 0, my = inp.my || 0, ml = Math.hypot(mx, my);
      w.moving = ml > 0.15;
      if (ml > 1) { mx /= ml; my /= ml; ml = 1; }
      p.stunT = (p.stunT || 0) - dt;
      if (p.stunT > 0) { mx = 0; my = 0; ml = 0; }
      if (ml > 0.2) { p.fx = mx / ml; p.fy = my / ml; w.hb.move += dt; }
      w.hb.tt += dt;
      p.dodgeCd -= dt; p.inv -= dt; p.lungeT -= dt; w.vampCd -= dt; w.dodgeT = (w.dodgeT || 0) - dt;
      if (inp.dodge && p.dodgeCd <= 0 && !(p.stunT > 0)) {
        const P = cfg.player;
        p.dvx = ml > 0.2 ? mx / ml : p.fx; p.dvy = ml > 0.2 ? my / ml : p.fy;
        p.dodge = P.dodgeDur; p.inv = Math.max(p.inv, P.dodgeInv); p.dodgeCd = s.dodgeCd; w.hb.dodges++; w.dodgeT = P.dodgeInv;
        emit('dodge', { x: p.x, y: p.y });
        if (s.orbitN && s.orbitOff) w.orbOffT = s.orbitOff;
        if (s.dodgeBlastR) {
          emit('blast', { x: p.x, y: p.y, r: s.dodgeBlastR });
          for (const e of w.en) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < s.dodgeBlastR + e.r) damageEnemy(e, s.dodgeBlastDmg);
        }
      }
      if (p.dodge > 0) {
        const DS = cfg.player.dodgeSpeed * s.dodgeSpeedMul;
        p.dodge -= dt; p.x += p.dvx * DS * dt; p.y += p.dvy * DS * dt;
        p.vx = p.dvx * s.speed * 0.6; p.vy = p.dvy * s.speed * 0.6;
      } else {
        const k = Math.min(1, s.accel * dt);
        p.vx += (mx * s.speed - p.vx) * k; p.vy += (my * s.speed - p.vy) * k;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.x < p.r || p.x > W - p.r) p.vx *= -0.3;
      if (p.y < p.r || p.y > H - p.r) p.vy *= -0.3;
      p.x = clamp(p.x, p.r, W - p.r); p.y = clamp(p.y, p.r, H - p.r);
      if (s.mineEvery && ml > 0.2) {
        w.mineT -= dt;
        if (w.mineT <= 0) { w.mineT = s.mineEvery; w.mines.push({ x: p.x, y: p.y, t: 0 }); if (w.mines.length > 14) w.mines.shift(); }
      }
      for (const mn of w.mines) {
        mn.t += dt;
        if (mn.t < 0.3 || mn.boom) continue;
        for (const e of w.en) if (!e.dead && Math.hypot(e.x - mn.x, e.y - mn.y) < e.r + 8) { mn.boom = true; break; }
        if (mn.boom) {
          for (const e of w.en) if (!e.dead && Math.hypot(e.x - mn.x, e.y - mn.y) < s.mineR + e.r) damageEnemy(e, s.mineDmg);
          emit('mine', { x: mn.x, y: mn.y, r: s.mineR });
        }
      }
      w.mines = w.mines.filter(mn => !mn.boom && mn.t < 7);
      if (s.orbitN) {
        w.orbA += dt * 3.2; w.orbOffT -= dt;
        if (w.orbOffT <= 0) for (let i = 0; i < s.orbitN; i++) {
          const a = w.orbA + i * TAU / s.orbitN, ox = p.x + Math.cos(a) * s.orbitDist, oy = p.y + Math.sin(a) * s.orbitDist;
          for (const e of w.en) if (!e.dead && e.oc <= 0 && Math.hypot(e.x - ox, e.y - oy) < e.r + s.orbitSize) { e.oc = 0.3; damageEnemy(e, s.orbitDmg); }
        }
      }
      if (s.boltEvery) {
        w.boltT -= dt;
        if (w.boltT <= 0 && w.en.length) {
          w.boltT = s.boltEvery;
          const pts = [{ x: p.x, y: p.y }], used = new Set(); let from = p;
          for (let i = 0; i < s.boltN; i++) {
            let best = null, bd = (i ? 130 : 230) ** 2;
            for (const e of w.en) { if (e.dead || used.has(e)) continue; const dd = (e.x - from.x) ** 2 + (e.y - from.y) ** 2; if (dd < bd) { bd = dd; best = e; } }
            if (!best) break;
            used.add(best); pts.push({ x: best.x, y: best.y }); damageEnemy(best, s.boltDmg); from = best;
          }
          if (pts.length > 1) { emit('bolt', { pts }); if (s.boltStun) p.stunT = s.boltStun; }
        }
      }
      if (s.drain > 0) {
        w.drain -= dt;
        if (w.drain <= 0) { w.drain = s.drain; if (run.hp > 1) { run.hp--; emit('drain', { x: p.x, y: p.y }); } }
      }
      p.fire -= dt;
      const [tg, td] = nearest(p);
      if (tg) { w.hb.dist += td; w.hb.dn++; }
      if (p.fire <= 0 && tg) {
        p.fire = s.fireInt;
        const aimAt = s.targetFar ? (farthest(p) || tg) : tg;
        let a = s.aim ? Math.atan2(aimAt.y - p.y, aimAt.x - p.x) : Math.atan2(p.fy, p.fx);
        if (s.jitter) a += (rng() * 2 - 1) * s.jitter;
        const dirs = s.backShot ? (s.sideShot ? [a, a + Math.PI, a + Math.PI / 2, a - Math.PI / 2] : [a, a + Math.PI]) : [a];
        for (const d of dirs) for (let i = 0; i < s.shots; i++) {
          const aa = d + (i - (s.shots - 1) / 2) * s.spreadAng;
          w.pb.push({ x: p.x + Math.cos(aa) * (p.r + 2), y: p.y + Math.sin(aa) * (p.r + 2), vx: Math.cos(aa) * s.bulletSpeed, vy: Math.sin(aa) * s.bulletSpeed,
            r: s.bulletR, dmg: s.dmg, life: s.bulletLife, bounce: s.bounce, pierce: s.pierce, hit: [], bounced: false });
        }
        const tooClose = Math.hypot(aimAt.x - p.x, aimAt.y - p.y) < 60 && !s.ramDmg;
        if (s.lunge && !tooClose && !(s.lungeIdle && w.moving)) { p.vx += Math.cos(a) * s.lunge; p.vy += Math.sin(a) * s.lunge; if (s.ramDmg) p.lungeT = 0.2; if (s.lungeInv) p.inv = Math.max(p.inv, s.lungeInv); }
        emit('shot');
      }
      if (w.bossT >= 0) { w.bossT -= dt; if (w.bossT < 0) { spawnBoss(); w.hadBoss = true; } }
      for (const s2 of w.warn) { s2.t -= dt; if (s2.t <= 0) w.en.push(mkEnemy(s2.type, s2.x, s2.y, s2.hp)); }
      for (const bm of w.bombs) { bm.t -= dt; if (bm.t <= 0) { ringAt(bm.x, bm.y, cfg.boss.bomb.ringN, cfg.boss.bomb.ringSpeed, rnd(0, TAU), m.eBul); emit('bossBomb', { x: bm.x, y: bm.y }); } }
      w.bombs = w.bombs.filter(bm => bm.t > 0);
      w.warn = w.warn.filter(s2 => s2.t > 0);
      w.spawn -= dt;
      for (let n = 0; w.spawn <= 0 && n < 8; n++) {
        spawnEnemy();
        w.spawn += spawnInterval(run.round) / m.eNum / (w.boss ? (w.boss.kind === 'mephy' ? cfg.boss.mephy.spawnMul : cfg.boss.spawnMul) : 1);
      }
      if (w.spawn <= 0) w.spawn = 0;
      const es = m.eSpd;
      for (const e of w.en) {
        if (e.dead) continue;
        e.t += dt; e.tt -= dt; e.flash -= dt; e.ct -= dt; e.oc -= dt; e.frozen -= dt;
        const a = Math.atan2(p.y - e.y, p.x - e.x), d = Math.hypot(p.x - e.x, p.y - e.y);
        e.slowed = s.slowR && d < s.slowR;
        AI[e.ai](e, dt, a, d, (e.slowed ? es * s.slowK : es) * (e.frozen > 0 ? s.freezeK : 1), m);
        if (s.magnetR && d < s.magnetR && e.ai !== 'boss') { const pull = s.magnetPull * dt; e.x += Math.cos(a) * pull; e.y += Math.sin(a) * pull; }
        if (d < e.r + p.r - 2) {
          const src = (e.ai === 'boss' ? e.name || OS.ENEMIES.boss.name : OS.ENEMIES[e.type].name) + 'の体当たり';
          if (p.lungeT > 0 && s.ramDmg) { if (e.ct <= 0) { e.ct = 0.2; damageEnemy(e, s.ramDmg); } }
          else if (s.touchKill && e.ai !== 'boss') { e.sucked = true; damageEnemy(e, 999); if (!e.dead) { e.sucked = false; hurt(src); } }
          else hurt(src);
        }
      }
      const en = w.en;
      for (let i = 0; i < en.length; i++) for (let j = i + 1; j < en.length; j++) {
        const a = en[i], b = en[j]; if (a.dead || b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, mm = a.r + b.r;
        if (Math.abs(dx) > mm || Math.abs(dy) > mm) continue;
        const d = Math.hypot(dx, dy) || 1;
        if (d < mm) {
          const k = (mm - d) / 2 / d;
          const wa = a.ai === 'boss' ? 0 : b.ai === 'boss' ? 2 : 1, wb = 2 - wa;
          a.x -= dx * k * wa; a.y -= dy * k * wa; b.x += dx * k * wb; b.y += dy * k * wb;
        }
      }
      for (const b of w.pb) {
        if (s.homing && !b.thorn) {
          let tgt = null, bd = 1e9;
          for (const e of en) { if (e.dead || b.hit.includes(e)) continue; const dd = (e.x - b.x) ** 2 + (e.y - b.y) ** 2; if (dd < bd) { bd = dd; tgt = e; } }
          if (tgt) {
            const sp = Math.hypot(b.vx, b.vy), cur = Math.atan2(b.vy, b.vx);
            let diff = Math.atan2(tgt.y - b.y, tgt.x - b.x) - cur; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            const na = cur + clamp(diff, -s.homing * dt, s.homing * dt);
            b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
          }
        }
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.x < b.r || b.x > W - b.r || b.y < b.r || b.y > H - b.r) {
          if (b.bounce > 0) {
            b.bounce--; b.bounced = true;
            if (b.x < b.r || b.x > W - b.r) b.vx *= -1;
            if (b.y < b.r || b.y > H - b.r) b.vy *= -1;
            b.x = clamp(b.x, b.r, W - b.r); b.y = clamp(b.y, b.r, H - b.r); b.life = Math.max(b.life, 0.6);
            b.hurts = s.bounceHurts;
          } else b.life = 0;
        }
        for (const e of en) {
          if (e.dead || b.life <= 0 || b.hit.includes(e)) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            b.hit.push(e);
            if (e.ai === 'guard' && !b.thorn) {
              const sp = Math.hypot(b.vx, b.vy) || 1;
              if ((-b.vx * Math.cos(e.face) - b.vy * Math.sin(e.face)) / sp > cfg.enemies.guard.blockCos) { b.life = 0; emit('block', { x: b.x, y: b.y }); continue; }
            }
            let dmg = b.dmg, crit = false;
            if (s.critChance && rng() < s.critChance) { crit = true; dmg = e.ai === 'boss' ? b.dmg * 5 : e.hp + 1; emit('crit', { x: e.x, y: e.y, line: line(OS.LINES.crit) }); }
            if (s.freeze) e.frozen = s.freeze;
            damageEnemy(e, dmg);
            if (crit && s.critHeal && e.dead && run.hp < run.maxHp && w.vampCd <= 0 && !healCapped()) { run.hp++; w.vampCd = 3; w.heals = (w.heals || 0) + 1; emit('heal', { x: p.x, y: p.y }); }
            if (s.splitN && !b.child) {
              const ba = Math.atan2(b.vy, b.vx);
              for (let i = 0; i < s.splitN; i++) {
                const aa = ba + (i - (s.splitN - 1) / 2) * (1.6 / Math.max(1, s.splitN - 1));
                w.pb.push({ x: b.x, y: b.y, vx: Math.cos(aa) * 300, vy: Math.sin(aa) * 300, r: 3, dmg: s.splitDmg, life: 0.32, bounce: 0, pierce: 0, hit: [e], bounced: false, child: true });
              }
            }
            if (s.burstR && !b.thorn) {
              for (const o of en) if (o !== e && !o.dead && Math.hypot(o.x - b.x, o.y - b.y) < s.burstR + o.r) damageEnemy(o, s.burstDmg);
              emit('burst', { x: b.x, y: b.y, r: s.burstR });
              if (s.burstSelf && Math.hypot(p.x - b.x, p.y - b.y) < s.burstSelfR + p.r) hurt('自分の爆裂弾');
            }
            if (b.pierce > 0) b.pierce--; else b.life = 0;
          }
        }
        if (b.life > 0 && b.hurts && p.inv <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r + s.bounceSelfR) { b.life = 0; hurt('跳ね返った自分の弾'); }
      }
      w.pb = w.pb.filter(b => b.life > 0);
      w.en = en.filter(e => !e.dead && e.x > -60 && e.x < W + 60 && e.y > -60 && e.y < H + 60);
      for (const b of w.eb) {
        const k = s.slowR && Math.hypot(p.x - b.x, p.y - b.y) < s.slowR ? s.slowK : 1;
        b.x += b.vx * dt * k; b.y += b.vy * dt * k;
        if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) b.dead = true;
        else if (s.shieldR && blocked(b)) {
          b.dead = true; emit('block', { x: b.x, y: b.y });
          for (let i = 0; i < s.blockThorns; i++) {
            const aa = i * TAU / s.blockThorns + rng();
            w.pb.push({ x: p.x, y: p.y, vx: Math.cos(aa) * 300, vy: Math.sin(aa) * 300, r: 4, dmg: 3, life: 0.6, bounce: 0, pierce: 1, hit: [], bounced: false, thorn: true });
          }
        }
        else if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r - 2) {
          b.dead = true;
          if (p.dodge > 0 || (p.inv > 0 && w.dodgeT > 0)) emit('graze', { x: p.x, y: p.y });
          else hurt(b.src);
        }
      }
      w.eb = w.eb.filter(b => !b.dead);
      function blocked(b) {
        const dx = b.x - p.x, dy = b.y - p.y, dd = Math.hypot(dx, dy);
        return dd > 0 && dd < p.r + s.shieldR && (dx * p.fx + dy * p.fy) / dd > s.shieldCos;
      }
    };
    function habitsOf(hb) {
      const Hc = cfg.habit, out = [];
      const per = hb.tt > 0 ? 30 / hb.tt : 1;
      if (hb.dodges * per >= Hc.dodgePer30) out.push('dodge');
      const ad = hb.dn ? hb.dist / hb.dn : 150;
      if (ad > Hc.far) out.push('far'); else if (ad < Hc.close) out.push('close');
      const mr = hb.tt ? hb.move / hb.tt : 0.5;
      if (mr < Hc.still) out.push('still'); else if (mr > Hc.moving) out.push('moving');
      return { list: out, ad: Math.round(ad), mr: Math.round(mr * 100), dodges: hb.dodges };
    }
    const unfoundOf = run => OS.COMBOS.filter(c => (cfg.unfound || []).includes(c.id) && !run.combos.includes(c.id) && run.ups.includes(c.a) !== run.ups.includes(c.b));
    function rivalChoose(cands, habits, exclude) {
      const R = cfg.rival, run = G.run;
      const noise = adj(5) && run.round >= R.lateFrom ? R.lateNoise : R.noise;
      let best = null, bs = -Infinity, why = '';
      for (const k of cands) {
        if (k === exclude) continue;
        let sc = rng() * noise, mm = '';
        if (R.read !== false) for (const h of OS.UPGRADES[k].hits) if (habits.includes(h)) { sc += 1; if (!mm) mm = h; }
        if (R.unfoundBonus && unfoundOf(run).some(c => c.a === k || c.b === k)) sc += R.unfoundBonus;
        if (R.avoidCombo && OS.COMBOS.some(c => !run.combos.includes(c.id) && ((c.a === k && run.ups.includes(c.b)) || (c.b === k && run.ups.includes(c.a))))) sc -= 10;
        if (sc > bs) { bs = sc; best = k; why = mm; }
      }
      return { key: best, why };
    }
    function pickLine(k, why) {
      const up = OS.UPGRADES[k].name;
      if (!G.run.log.length) return line(OS.LINES.first, up);
      const base = why ? line(OS.LINES.habit[why], up) : line(OS.LINES.none, up);
      const late = adj(5) && G.run.round >= cfg.rival.lateFrom ? line(OS.LINES.late) : '';
      return late ? late + base : base;
    }
    G.preparePick = function () {
      const run = G.run;
      const locked = cfg.locked || [];
      let pool = shuffle(Object.keys(OS.UPGRADES).filter(k => !run.ups.includes(k) && !locked.includes(k)));
      const want = shuffle(unfoundOf(run).map(c => run.ups.includes(c.a) ? c.b : c.a).filter(k => pool.includes(k)));
      if (want.length && rng() < (cfg.rival.unfoundChance || 0)) pool = [want[0], ...pool.filter(k => k !== want[0])];
      const cands = shuffle(pool.slice(0, 3));
      const hab = habitsOf(G.w.hb); run.lastHabit = hab;
      run.habitN = run.habitN || {}; for (const h of hab.list) run.habitN[h] = (run.habitN[h] || 0) + 1;
      if (!cands.length) {
        run.extraPhase = true;
        const xs = shuffle(Object.keys(OS.EXTRAS).filter(k => (run.extras[k] || 0) < EXTRA_MAX && !(OS.EXTRAS[k].hpBonus && run.maxHp >= 10))).slice(0, 3);
        if (!xs.length) { G.pick = { cands: [], choice: null, hab }; G.phase = 'pick'; return G.pick; }
        const k = pickOne(xs);
        G.pick = { cands: xs, choice: k, why: '', hab, extra: true, line: line(OS.LINES.extra, OS.EXTRAS[k].name), vetoed: false };
        run.lastWhy = G.pick.line; G.phase = 'pick'; return G.pick;
      }
      const ch = rivalChoose(cands, hab.list, null);
      G.pick = { cands, choice: ch.key, why: ch.why, hab, line: pickLine(ch.key, ch.why), vetoed: false };
      run.lastWhy = G.pick.line;
      G.phase = 'pick';
      return G.pick;
    };
    G.veto = function () {
      const run = G.run, pk = G.pick;
      if (G.phase !== 'pick' || run.veto <= 0 || pk.vetoed || pk.extra || pk.cands.length < 2) return null;
      run.veto--; run.vetoUsed++; pk.vetoed = true; run.mod.eSpd *= cfg.veto.enemySpeed;
      const ch = rivalChoose(pk.cands, pk.hab.list, pk.choice);
      pk.refused = pk.choice; pk.choice = ch.key; pk.why = ch.why;
      pk.line = line(OS.LINES.veto, OS.UPGRADES[ch.key].name);
      return pk;
    };
    G.accept = function () {
      const run = G.run, pk = G.pick;
      if (G.phase !== 'pick') return [];
      let newC = [];
      if (pk.extra) {
        const k = pk.choice, X = OS.EXTRAS[k];
        run.extras[k] = (run.extras[k] || 0) + 1; run.extraN++;
        if (X.hpBonus) { run.maxHp += X.hpBonus; run.hp += X.hpBonus; }
        run.s = computeStats(run);
      } else if (pk.choice) {
        const k = pk.choice, U = OS.UPGRADES[k];
        run.ups.push(k);
        if (U.hpBonus) { run.maxHp += U.hpBonus; run.hp += U.hpBonus; }
        newC = OS.COMBOS.filter(c => !run.combos.includes(c.id) && run.ups.includes(c.a) && run.ups.includes(c.b));
        for (const c of newC) run.combos.push(c.id);
        run.s = computeStats(run);
        run.log.push({ round: run.round, up: k, why: pk.why, refused: pk.refused || null, combos: newC.map(c => c.id) });
      }
      G.phase = 'enemyPick';
      return newC;
    };
    function buffPool(nextRound) {
      const run = G.run;
      return OS.ENEMY_BUFFS.filter(b => (b.from || 1) <= nextRound && !(b.once && run.takenBuffs.includes(b.id)) && (!b.ok || b.ok(run.mod, run, nextRound)));
    }
    G.prepareEnemyPick = function () {
      const run = G.run;
      let opts;
      if (adj(1)) {
        const pool = buffPool(run.round + 1).slice(), endless = run.endless && run.round >= run.rounds;
        opts = [];
        while (opts.length < 3 && pool.length) {
          const wt = pool.map(b => endless && b.endlessW != null ? b.endlessW : 1), sum = wt.reduce((a, x) => a + x, 0);
          let r = rng() * sum, k = 0; while (k < pool.length - 1 && (r -= wt[k]) > 0) k++;
          opts.push(pool.splice(k, 1)[0]);
        }
        opts = shuffle(opts);
        if (run.round % cfg.enemyPick.healEvery === 0) opts[opts.length - 1] = OS.HEAL_OPTION;
      } else opts = shuffle(OS.DEBUFFS.slice()).slice(0, 3);
      G.enemyOpts = opts;
      G.enemyLine = line(adj(1) ? OS.LINES.enemyPick : OS.LINES.debuffPick);
      return opts;
    };
    G.chooseEnemy = function (i) {
      const run = G.run, o = G.enemyOpts && G.enemyOpts[i];
      if (G.phase !== 'enemyPick' || !o) return null;
      let extra = null;
      if (o.id === 'heal' && adj(1)) {
        run.hp = Math.min(run.maxHp, run.hp + cfg.enemyPick.healHp);
        extra = pickOne(buffPool(run.round + 1).filter(b => b.id !== 'long'));
        extra.apply(run.mod, run); run.takenBuffs.push(extra.id);
      } else { o.apply(run.mod, run); run.takenBuffs.push(o.id); }
      const last = run.log[run.log.length - 1];
      if (last && last.round === run.round) { last.enemy = o.id; if (extra) last.extra = extra.id; }
      startRound();
      return extra;
    };
    G.overtime = function (yes) {
      if (G.phase !== 'overtimeAsk') return;
      if (yes) { G.w.len += cfg.endless.overtime; G.w.overtime = true; }
      G.phase = 'play';
    };
    G.vetoEnemy = function () {
      const run = G.run;
      if (G.phase !== 'enemyPick' || !run.extraPhase || run.veto <= 0) return false;
      run.veto--; run.vetoUsed++;
      startRound();
      return true;
    };
    G.continueEndless = function () {
      if (G.phase !== 'win') return false;
      G.run.endless = true; G.phase = 'roundEnd';
      return true;
    };
    G.skipRound = function () { if (G.phase === 'play' && G.w && !G.w.over && G.w.end < 0) G.w.t = G.w.len; };
    G.habitsOf = habitsOf;
    G.computeStats = computeStats;
    return G;
  };
})(globalThis.OS = globalThis.OS || {});
