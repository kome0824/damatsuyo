(function (OS) {
  'use strict';
  OS.makeBot = function (kind, rng) {
    rng = rng || Math.random;
    const st = { tx: 240, ty: 240, t: 0, dodgeT: 1 };
    if (kind === 'wander') return function (G, dt) {
      const p = G.w.p;
      st.t -= dt; st.dodgeT -= dt;
      if (st.t <= 0 || Math.hypot(st.tx - p.x, st.ty - p.y) < 20) { st.tx = 40 + rng() * (G.W - 80); st.ty = 40 + rng() * (G.H - 80); st.t = 1 + rng() * 1.5; }
      const a = Math.atan2(st.ty - p.y, st.tx - p.x);
      let dodge = false;
      if (st.dodgeT <= 0) { dodge = true; st.dodgeT = 1.5 + rng() * 2.5; }
      return { mx: Math.cos(a), my: Math.sin(a), dodge };
    };
    return function (G, dt) {
      const w = G.w, p = w.p, W = G.W, H = G.H;
      let fx = 0, fy = 0, danger = false;
      for (const e of w.en) {
        if (e.dead) continue;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        const reach = e.ai === 'boss' ? 150 : e.ai === 'dash' && e.st !== 'move' ? 190 : e.ai === 'bomber' && e.st === 'fuse' ? 95 : 110;
        if (d < reach) { const k = (reach - d) / reach; fx += dx / d * k * 2; fy += dy / d * k * 2; }
        if (e.ai === 'dash' && e.st !== 'move') {
          const cross = dx * e.ay - dy * e.ax, along = dx * e.ax + dy * e.ay;
          if (along > 0 && along < 260 && Math.abs(cross) < 30) { const s = cross >= 0 ? 1 : -1; fx += e.ay * s * 3; fy += -e.ax * s * 3; if (along < 70 && e.st === 'dash') danger = true; }
        }
        if (d < e.r + p.r + 8) danger = true;
      }
      for (const b of w.eb) {
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const along = (dx * b.vx + dy * b.vy) / sp;
        if (along < -10 || d > 140) continue;
        const cross = (dx * b.vy - dy * b.vx) / sp;
        if (Math.abs(cross) < p.r + b.r + 14) {
          const s = cross >= 0 ? 1 : -1, k = 1 - d / 140;
          fx += (b.vy / sp) * s * 2.5 * k; fy += (-b.vx / sp) * s * 2.5 * k;
          if (along < 34 && Math.abs(cross) < p.r + b.r + 2) danger = true;
        }
      }
      for (const g of w.gifts || []) {
        const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(g.vx, g.vy) || 1;
        const cross = (dx * g.vy - dy * g.vx) / sp, along = (dx * g.vx + dy * g.vy) / sp;
        if (along > -10 && d < 180 && Math.abs(cross) < p.r + g.r + 18) { const s = cross >= 0 ? 1 : -1; fx += (g.vy / sp) * s * 3; fy += (-g.vx / sp) * s * 3; if (along < 40) danger = true; }
        if (g.t < 0.6 && d < 110) { fx += dx / d * 2.5; fy += dy / d * 2.5; }
      }
      if (G.run.s.bounceHurts) for (const b of w.pb) {
        if (!b.bounced) continue;
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
        if (d < 70) { fx += dx / d * 1.5; fy += dy / d * 1.5; if (d < 24) danger = true; }
      }
      const m = 70;
      if (p.x < m) fx += (m - p.x) / m * 2; if (p.x > W - m) fx -= (p.x - (W - m)) / m * 2;
      if (p.y < m) fy += (m - p.y) / m * 2; if (p.y > H - m) fy -= (p.y - (H - m)) / m * 2;
      fx += (W / 2 - p.x) / W * 0.6; fy += (H / 2 - p.y) / H * 0.6;
      const L = Math.hypot(fx, fy);
      if (L < 0.15) { st.t += dt; fx = Math.cos(st.t * 0.8) * 0.5; fy = Math.sin(st.t * 0.8) * 0.5; }
      return { mx: fx, my: fy, dodge: danger };
    };
  };
  OS.simulateRun = function (cfg, kind, seed) {
    const rng = seed != null ? OS.seeded(seed) : Math.random;
    const G = OS.createGame(cfg, { rng });
    const bot = OS.makeBot(kind, rng);
    const dt = 1 / 60;
    G.newRun();
    let guard = 0;
    while (G.phase !== 'win' && G.phase !== 'lose' && guard++ < 400000) {
      if (G.phase === 'play') G.update(dt, bot(G, dt));
      else if (G.phase === 'roundEnd') { G.preparePick(); }
      else if (G.phase === 'overtimeAsk') { G.overtime(false); }
      else if (G.phase === 'pick') { G.accept(); }
      else if (G.phase === 'enemyPick') { const o = G.prepareEnemyPick(); G.chooseEnemy(Math.floor(rng() * o.length)); }
    }
    const r = G.run;
    return { round: r.round, win: G.phase === 'win', kills: r.kills, ups: r.ups.slice(), combos: r.combos.slice(), hp: r.hp, diedTo: r.diedTo, bossKills: r.bossKills };
  };
  OS.seeded = function (seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
})(globalThis.OS = globalThis.OS || {});
