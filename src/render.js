(function (OS) {
  'use strict';
  const W = 480, H = 480, TAU = Math.PI * 2;
  const C = {
    floor: '#1b1e2c', floorEdge: '#12141d', dot: '#272b3c', out: '#0e1018',
    fg: '#ece8dc', muted: '#a09dae', accent: '#f2c14e', rival: '#d4537e', rivalDark: '#4b1528',
    danger: '#e8654f', ok: '#5dcaa5', lilac: '#afa9ec'
  };
  const FONT = s => `${s}px DotGothic16,"Zen Kaku Gothic New",sans-serif`;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  OS.RENDER_COLORS = C;
  OS.makeRenderer = function (cv) {
    const ctx = cv.getContext('2d');
    let S = 1;
    let cdW = null, cdWas = 0, readyAt = -1e9;
    function resize() {
      const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      if (r.width < 2) return;
      cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); S = cv.width / W;
    }
    try { new ResizeObserver(resize).observe(cv); } catch (e) { addEventListener('resize', resize); }
    resize();
    function shadow(c, x, y, r) { c.fillStyle = 'rgba(5,6,10,.38)'; c.beginPath(); c.ellipse(x, y + r * 0.75, r * 0.95, r * 0.38, 0, 0, TAU); c.fill(); }
    function eyes(c, x, y, ax, ay, sz) {
      const ox = (ax || 0) * 1.4, oy = (ay || 0) * 1.4;
      c.fillStyle = C.out; c.beginPath(); c.arc(x - 3 + ox, y - 1 + oy, sz, 0, TAU); c.arc(x + 3 + ox, y - 1 + oy, sz, 0, TAU); c.fill();
    }
    const A = () => OS.ART || { img: {}, white: {}, blue: {}, bg: {} };
    function spr(c, name, x, y, h, o) {
      o = o || {};
      const art = A(), im = art.img[name]; if (!im) return false;
      const w = im.naturalWidth * h / im.naturalHeight, ay = o.ay == null ? 0.55 : o.ay;
      c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot);
      c.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
      if (o.alpha != null) c.globalAlpha *= o.alpha;
      c.drawImage(im, -w / 2, -h * ay, w, h);
      if (o.flash > 0 && art.white[name]) { c.globalAlpha = Math.min(1, o.flash * 10) * 0.8; c.drawImage(art.white[name], -w / 2, -h * ay, w, h); }
      if (o.frozen && art.blue[name]) { c.globalAlpha = 0.45; c.drawImage(art.blue[name], -w / 2, -h * ay, w, h); }
      c.restore(); return true;
    }
    const frame = (base, t, fps, phase) => base + (Math.floor(t * fps + (phase || 0)) % 2 === 0 ? '1' : '2');
    function floor(c) {
      const bg = A().bg.floor;
      if (bg) {
        c.drawImage(bg, 0, 0, W, H);
        c.fillStyle = `rgba(9,10,18,${0.5 - Math.sin(performance.now() / 1400) * 0.06})`; c.fillRect(0, 0, W, H);
        const v = c.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
        c.fillStyle = v; c.fillRect(0, 0, W, H);
        return;
      }
      const g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.75);
      g.addColorStop(0, C.floor); g.addColorStop(1, C.floorEdge);
      c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
      c.fillStyle = C.dot; for (let x = 16; x < W; x += 32) for (let y = 16; y < H; y += 32) c.fillRect(x - 1, y - 1, 2, 2);
    }
    function drawEnemy(c, e, t, px, py) {
      const def = OS.ENEMIES[e.type], fl = e.flash > 0, col = def.color;
      const grow = (e.t != null && e.t < 0.18 ? 0.4 + e.t / 0.18 * 0.6 : 1) * (e.flash > 0 ? 1.18 : 1);
      if (e.ai === 'boss') { drawBoss(c, e, t); return; }
      if (drawEnemyArt(c, e, t, px, py, grow)) return;
      shadow(c, e.x, e.y, e.r);
      c.save(); c.translate(e.x, e.y); c.scale(grow, grow); c.translate(-e.x, -e.y);
      c.lineWidth = 2.5; c.strokeStyle = C.out;
      const lx = px != null ? Math.sign(px - e.x) * Math.min(1, Math.abs(px - e.x) / 40) : 0;
      const ly = py != null ? Math.sign(py - e.y) * Math.min(1, Math.abs(py - e.y) / 40) : 0;
      if (e.ai === 'chase') {
        const sq = 1 + Math.sin(t * 10 + e.x) * 0.06;
        c.beginPath(); c.ellipse(e.x, e.y, e.r * sq, e.r / sq, 0, 0, TAU); c.fillStyle = fl ? '#fff' : col; c.fill(); c.stroke();
        eyes(c, e.x, e.y, lx, ly, e.r > 9 ? 1.8 : 1.3);
      } else if (e.ai === 'shoot') {
        c.beginPath(); for (let i = 0; i < 4; i++) { const a = t * 2 + i * Math.PI / 2; c.lineTo(e.x + Math.cos(a) * e.r * 1.25, e.y + Math.sin(a) * e.r * 1.25); } c.closePath(); c.fillStyle = fl ? '#fff' : col; c.fill(); c.stroke();
        if (e.tt != null && e.tt < 0.35) { c.strokeStyle = 'rgba(212,83,126,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y, e.r + 4 + (0.35 - e.tt) * 14, 0, TAU); c.stroke(); }
        eyes(c, e.x, e.y, lx, ly, 1.8);
      } else if (e.ai === 'dash') {
        if (e.st === 'tele') {
          c.save(); c.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 18)); c.strokeStyle = col; c.lineWidth = e.r * 1.6; c.lineCap = 'round';
          c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + e.ax * 150, e.y + e.ay * 150); c.stroke(); c.restore();
          c.lineWidth = 2.5; c.strokeStyle = C.out;
        }
        const a = e.st === 'move' ? Math.atan2((py || e.y) - e.y, (px || e.x) - e.x) : Math.atan2(e.ay, e.ax) || 0;
        c.beginPath(); c.moveTo(e.x + Math.cos(a) * e.r * 1.45, e.y + Math.sin(a) * e.r * 1.45); c.lineTo(e.x + Math.cos(a + 2.4) * e.r, e.y + Math.sin(a + 2.4) * e.r); c.lineTo(e.x + Math.cos(a - 2.4) * e.r, e.y + Math.sin(a - 2.4) * e.r); c.closePath();
        c.fillStyle = fl || (e.st === 'tele' && Math.floor(t * 16) % 2 === 0) ? '#fff' : col; c.fill(); c.stroke();
        eyes(c, e.x - Math.cos(a) * 2, e.y - Math.sin(a) * 2, Math.cos(a), Math.sin(a), 1.7);
      } else if (e.ai === 'bomber') {
        if (e.st === 'fuse') {
          const R = OS.CONFIG_DEFAULT.enemies.bomber.radius, k = 1 - Math.max(0, e.tt) / (e.fuseMax || 1);
          c.save(); c.globalAlpha = 0.12 + k * 0.25; c.fillStyle = C.danger; c.beginPath(); c.arc(e.x, e.y, R, 0, TAU); c.fill();
          c.globalAlpha = 0.8; c.strokeStyle = C.danger; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y, R * k, 0, TAU); c.stroke(); c.restore();
          c.lineWidth = 2.5; c.strokeStyle = C.out;
        }
        c.beginPath(); c.arc(e.x, e.y, e.r, 0, TAU); c.fillStyle = fl || (e.st === 'fuse' && Math.floor(t * 12) % 2 === 0) ? '#fff' : col; c.fill(); c.stroke();
        c.strokeStyle = C.out; c.lineWidth = 2; c.beginPath(); c.moveTo(e.x + 4, e.y - e.r + 1); c.quadraticCurveTo(e.x + 9, e.y - e.r - 6, e.x + 5, e.y - e.r - 9); c.stroke();
        c.fillStyle = C.accent; c.beginPath(); c.arc(e.x + 5, e.y - e.r - 9, 2.5, 0, TAU); c.fill();
        eyes(c, e.x, e.y + 1, lx, ly, 1.7);
      } else if (e.ai === 'guard') {
        c.beginPath(); c.rect(e.x - e.r * 0.85, e.y - e.r * 0.85, e.r * 1.7, e.r * 1.7); c.fillStyle = fl ? '#fff' : col; c.fill(); c.stroke();
        eyes(c, e.x, e.y, Math.cos(e.face), Math.sin(e.face), 1.9);
        c.strokeStyle = '#e9e1c4'; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.arc(e.x, e.y, e.r + 5, e.face - 1.0, e.face + 1.0); c.stroke();
        c.strokeStyle = C.out; c.lineWidth = 1.5; c.beginPath(); c.arc(e.x, e.y, e.r + 8, e.face - 1.0, e.face + 1.0); c.stroke();
      }
      if (e.frozen > 0) { c.strokeStyle = 'rgba(160,210,255,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y, e.r + 2, 0, TAU); c.stroke(); }
      c.restore();
    }
    function drawEnemyArt(c, e, t, px, py, grow) {
      const ph = (e.x * 0.013 + e.y * 0.007), hop = Math.abs(Math.sin(t * 9 + ph * 6)) * 2.2;
      const o = { flash: e.flash, frozen: e.frozen > 0, sx: grow, sy: grow };
      if (e.ai === 'chase') {
        if (!A().img.chase1) return false;
        shadow(c, e.x, e.y, e.r);
        const sq = 1 + Math.sin(t * 12 + ph * 9) * 0.07;
        o.sx = grow * sq; o.sy = grow / sq; o.flip = px != null && px > e.x;
        return spr(c, frame('chase', t, 5, ph), e.x, e.y - hop * 0.5, e.r * 2.5, o);
      }
      if (e.ai === 'shoot') {
        if (!A().img.shoot1) return false;
        shadow(c, e.x, e.y + 3, e.r);
        if (e.tt != null && e.tt < 0.35) { c.strokeStyle = 'rgba(212,83,126,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y, e.r + 4 + (0.35 - e.tt) * 14, 0, TAU); c.stroke(); }
        o.flip = px != null && px > e.x;
        return spr(c, frame('shoot', t, 3, ph), e.x, e.y - 2 - Math.sin(t * 3 + ph) * 2, e.r * 3.1, o);
      }
      if (e.ai === 'dash') {
        if (!A().img.dash1) return false;
        if (e.st === 'tele') {
          c.save(); c.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 18)); c.strokeStyle = OS.ENEMIES[e.type].color; c.lineWidth = e.r * 1.6; c.lineCap = 'round';
          c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + e.ax * 150, e.y + e.ay * 150); c.stroke(); c.restore();
        }
        shadow(c, e.x, e.y, e.r);
        const dx = e.st === 'move' ? (px || e.x) - e.x : e.ax;
        o.flip = dx > 0; o.flash = Math.max(e.flash, e.st === 'tele' && Math.floor(t * 16) % 2 === 0 ? 0.05 : 0);
        o.rot = e.st === 'dash' ? (dx > 0 ? 1 : -1) * 0.25 : 0;
        return spr(c, frame('dash', t, e.st === 'dash' ? 14 : 6, ph), e.x, e.y - hop * 0.4, e.r * 2.7, o);
      }
      if (e.ai === 'bomber') {
        if (!A().img.bomber1) return false;
        let x = e.x, k = 0;
        if (e.st === 'fuse') {
          const R = OS.CONFIG_DEFAULT.enemies.bomber.radius; k = 1 - Math.max(0, e.tt) / (e.fuseMax || 1);
          c.save(); c.globalAlpha = 0.12 + k * 0.25; c.fillStyle = C.danger; c.beginPath(); c.arc(e.x, e.y, R, 0, TAU); c.fill();
          c.globalAlpha = 0.8; c.strokeStyle = C.danger; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y, R * k, 0, TAU); c.stroke(); c.restore();
          x += Math.sin(t * 70) * 1.6 * k;
          o.flash = Math.max(e.flash, Math.floor(t * (8 + k * 16)) % 2 === 0 ? 0.04 : 0);
        }
        shadow(c, e.x, e.y + 2, e.r);
        o.sx = grow * (1 + k * 0.22); o.sy = grow * (1 + k * 0.22);
        return spr(c, frame('bomber', t, 5, ph), x, e.y - hop * 0.6, e.r * 3.1, o);
      }
      if (e.ai === 'guard') {
        if (!A().img.guard1) return false;
        shadow(c, e.x, e.y + 2, e.r);
        c.strokeStyle = 'rgba(233,225,196,.55)'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.arc(e.x, e.y, e.r + 7, e.face - 1.0, e.face + 1.0); c.stroke();
        o.flip = Math.cos(e.face) > 0;
        return spr(c, frame('guard', t, 3, ph), e.x, e.y - hop * 0.3, e.r * 2.7, o);
      }
      return false;
    }
    const BOSS_ART = { '': 'boss', summon: 'summon', charge: 'rush', spiral: 'orb', bomb: 'mortar', mephy: 'mephy' };
    function drawBossArt(c, e, t) {
      const summon = e.kind === 'summon', art = A(), pre = BOSS_ART[e.kind] || 'boss';
      if (!art.img[pre + '1']) return false;
      const r = e.r, bob = Math.sin(t * 2.2) * 3;
      shadow(c, e.x, e.y + 10, r * 1.1);
      if (!summon && e.ring != null && e.ring < 0.5) {
        const k = 1 - e.ring / 0.5;
        c.save(); c.globalAlpha = 0.25 + k * 0.5; c.strokeStyle = C.rival; c.lineWidth = 3 + k * 4;
        c.beginPath(); c.arc(e.x, e.y, r + 14 + k * 10, 0, TAU); c.stroke(); c.restore();
      }
      if ((e.kind === 'charge' || e.kind === 'mephy') && e.tele > 0) {
        const k = 1 - e.tele / (e.teleMax || 1), len = 900;
        c.save(); c.globalAlpha = 0.18 + k * 0.35; c.strokeStyle = C.danger; c.lineWidth = r * 1.6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + e.dx * len, e.y + e.dy * len); c.stroke(); c.restore();
      }
      let name;
      if (summon) name = e.call != null && e.call < 0.7 ? 'summon3' : frame('summon', t, 2);
      else if (e.kind === 'charge') name = e.tele > 0 || e.dashT > 0 ? 'rush3' : frame('rush', t, 2);
      else if (e.kind === 'spiral') name = e.pause > 0 ? 'orb3' : frame('orb', t, 1.6);
      else if (e.kind === 'bomb') name = e.lob != null && e.lob < 0.4 ? 'mortar3' : frame('mortar', t, 1.6);
      else if (e.kind === 'mephy') { if (e.rage) { c.save(); c.globalAlpha = 0.25 + 0.2 * Math.sin(t * 10); c.fillStyle = C.danger; c.beginPath(); c.arc(e.x, e.y, r * 1.6, 0, TAU); c.fill(); c.restore(); } name = e.throwT > 0 ? 'mephy2' : 'mephy1'; }
      else name = e.ring != null && e.ring < 0.6 ? 'boss3' : frame('boss', t, 1.6);
      return spr(c, name, e.x, e.y + bob, r * 3.3, { flash: e.flash, frozen: e.frozen > 0 });
    }
    function bossHp(c, e) {
      if (!e.max || e.y < -10) return;
      const w = 92, h = 8, x = e.x - w / 2, y = Math.min(H - 12, e.y + e.r * 1.5 + 8), k = Math.max(0, e.hp / e.max);
      c.save(); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 2, y - 2, w + 4, h + 4);
      c.fillStyle = e.kind === 'summon' ? C.lilac : C.rival; c.fillRect(x, y, w * k, h); c.restore();
    }
    function drawBoss(c, e, t) {
      if (drawBossArt(c, e, t)) return;
      const fl = e.flash > 0, r = e.r * (1 + Math.sin(t * 3) * 0.03);
      shadow(c, e.x, e.y + 4, r);
      if (e.ring != null && e.ring < 0.5) {
        const k = 1 - e.ring / 0.5;
        c.save(); c.globalAlpha = 0.25 + k * 0.5; c.strokeStyle = C.rival; c.lineWidth = 3 + k * 4;
        c.beginPath(); c.arc(e.x, e.y, r + 8 + k * 10, 0, TAU); c.stroke(); c.restore();
      }
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3 + t * 0.3; c.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r); } c.closePath();
      const bodyCol = e.kind === 'summon' ? '#2c2a5a' : C.rivalDark, edgeCol = e.kind === 'summon' ? C.lilac : C.rival;
      c.fillStyle = fl ? '#fff' : bodyCol; c.fill(); c.lineWidth = 4; c.strokeStyle = edgeCol; c.stroke();
      c.beginPath(); c.moveTo(e.x - r * 0.62, e.y - r * 0.62); c.lineTo(e.x - r * 0.35, e.y - r * 1.15); c.lineTo(e.x - r * 0.18, e.y - r * 0.7); c.moveTo(e.x + r * 0.62, e.y - r * 0.62); c.lineTo(e.x + r * 0.35, e.y - r * 1.15); c.lineTo(e.x + r * 0.18, e.y - r * 0.7); c.fillStyle = C.rival; c.fill();
      c.fillStyle = C.fg; c.beginPath(); c.ellipse(e.x - r * 0.3, e.y - r * 0.05, r * 0.2, r * 0.11, -0.2, 0, TAU); c.ellipse(e.x + r * 0.3, e.y - r * 0.05, r * 0.2, r * 0.11, 0.2, 0, TAU); c.fill();
      c.fillStyle = C.out; c.beginPath(); c.arc(e.x - r * 0.28, e.y - r * 0.03, r * 0.07, 0, TAU); c.arc(e.x + r * 0.32, e.y - r * 0.03, r * 0.07, 0, TAU); c.fill();
      c.strokeStyle = C.fg; c.lineWidth = 2.5; c.beginPath(); c.moveTo(e.x - r * 0.3, e.y + r * 0.35); c.quadraticCurveTo(e.x, e.y + r * 0.55, e.x + r * 0.32, e.y + r * 0.3); c.stroke();
    }
    function drawWarn(c, s2, t) {
      const def = OS.ENEMIES[s2.type], x = clamp(s2.x, 10, W - 10), y = clamp(s2.y, 10, H - 10);
      const k = 1 - s2.t / s2.max, a = Math.atan2(H / 2 - y, W / 2 - x);
      c.save(); c.globalAlpha = (0.35 + 0.65 * k) * (Math.floor(t * 14) % 2 ? 1 : 0.6);
      c.translate(x, y); c.rotate(a); c.fillStyle = def.color; c.strokeStyle = C.out; c.lineWidth = 2;
      c.beginPath(); c.moveTo(9, 0); c.lineTo(-3, -7); c.lineTo(-3, 7); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    function drawPlayer(c, p, s, t, trail, w) {
      if (s.slowR) {
        c.save(); c.globalAlpha = 0.09; c.fillStyle = '#7fb3e8'; c.beginPath(); c.arc(p.x, p.y, s.slowR, 0, TAU); c.fill();
        c.globalAlpha = 0.35; c.strokeStyle = '#7fb3e8'; c.lineWidth = 1.5; c.setLineDash([2, 6]); c.lineDashOffset = -t * 10; c.beginPath(); c.arc(p.x, p.y, s.slowR, 0, TAU); c.stroke(); c.restore();
      }
      for (const tr of trail) { c.save(); c.globalAlpha = tr.l * 2; c.fillStyle = C.accent; c.beginPath(); c.arc(tr.x, tr.y, p.r * 0.9, 0, TAU); c.fill(); c.restore(); }
      if (s.magnetR) { c.save(); c.globalAlpha = 0.07 + Math.sin(t * 4) * 0.02; c.fillStyle = C.lilac; c.beginPath(); c.arc(p.x, p.y, s.magnetR, 0, TAU); c.fill(); c.restore(); }
      if (s.dodgeBlastR && p.dodgeCd <= 0) { c.save(); c.globalAlpha = 0.18; c.strokeStyle = C.accent; c.setLineDash([3, 5]); c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, s.dodgeBlastR, 0, TAU); c.stroke(); c.restore(); }
      if (s.shieldR) {
        const fa = Math.atan2(p.fy, p.fx), wdt = Math.acos(s.shieldCos);
        c.save(); c.strokeStyle = 'rgba(233,225,196,.85)'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.arc(p.x, p.y, p.r + s.shieldR * 0.55, fa - wdt, fa + wdt); c.stroke(); c.restore();
      }
      if (s.orbitN && w.orbOffT <= 0) {
        c.save(); c.globalAlpha = w.eb.length > 40 ? 0.35 : w.eb.length > 20 ? 0.55 : 0.85;
        for (let i = 0; i < s.orbitN; i++) {
          const a = w.orbA + i * TAU / s.orbitN, ox = p.x + Math.cos(a) * s.orbitDist, oy = p.y + Math.sin(a) * s.orbitDist;
          c.fillStyle = 'rgba(93,202,165,.25)'; c.beginPath(); c.arc(ox, oy, s.orbitSize + 3, 0, TAU); c.fill();
          c.beginPath(); c.arc(ox, oy, s.orbitSize, 0, TAU); c.fillStyle = C.ok; c.fill(); c.lineWidth = 2; c.strokeStyle = C.out; c.stroke();
        }
        c.restore();
      }
      shadow(c, p.x, p.y, p.r);
      const blink = p.inv > 0.3 && p.dodge <= 0 && Math.floor(t * 20) % 2 === 0;
      const moving = Math.hypot(p.vx, p.vy) > 25;
      p._walk = (p._walk || 0) + (moving ? 1 : 0);
      if (A().img.hero1) {
        const gl = c.createRadialGradient(p.x, p.y + 4, 2, p.x, p.y + 4, p.r * 2.4);
        gl.addColorStop(0, 'rgba(242,193,78,.32)'); gl.addColorStop(1, 'rgba(242,193,78,0)');
        c.fillStyle = gl; c.beginPath(); c.arc(p.x, p.y + 4, p.r * 2.4, 0, TAU); c.fill();
      }
      if (!blink && A().img.hero1) {
        const hop = moving ? Math.abs(Math.sin(t * 13)) * 2.6 : Math.sin(t * 3) * 0.8;
        const st = p.dodge > 0 ? 0.22 : moving ? 0.04 : 0;
        spr(c, moving ? frame('hero', t, 7) : 'hero1', p.x, p.y - hop, p.r * 3.3,
          { flip: p.fx > 0.2, sx: 1 - st, sy: 1 + st, flash: p.lungeT > 0 ? 0.06 : 0 });
        const a = Math.atan2(p.fy, p.fx), d = p.r + 10;
        c.beginPath(); c.moveTo(p.x + Math.cos(a) * (d + 5), p.y + Math.sin(a) * (d + 5)); c.lineTo(p.x + Math.cos(a + 0.35) * d, p.y + Math.sin(a + 0.35) * d); c.lineTo(p.x + Math.cos(a - 0.35) * d, p.y + Math.sin(a - 0.35) * d); c.closePath();
        c.fillStyle = C.accent; c.fill(); c.lineWidth = 1.5; c.strokeStyle = C.out; c.stroke();
      } else if (!blink) {
        const sp = Math.hypot(p.vx, p.vy), st = Math.min(0.18, sp / 1400), ang = Math.atan2(p.vy, p.vx);
        c.save(); c.translate(p.x, p.y); c.rotate(ang); c.scale(1 + st, 1 - st); c.rotate(-ang);
        c.beginPath(); c.arc(0, 0, p.r, 0, TAU); c.fillStyle = p.lungeT > 0 ? C.accent : C.fg; c.fill(); c.lineWidth = 3; c.strokeStyle = C.out; c.stroke();
        c.restore();
        const a = Math.atan2(p.fy, p.fx);
        c.beginPath(); c.moveTo(p.x + Math.cos(a) * (p.r + 7), p.y + Math.sin(a) * (p.r + 7)); c.lineTo(p.x + Math.cos(a + 0.5) * (p.r + 1), p.y + Math.sin(a + 0.5) * (p.r + 1)); c.lineTo(p.x + Math.cos(a - 0.5) * (p.r + 1), p.y + Math.sin(a - 0.5) * (p.r + 1)); c.closePath(); c.fillStyle = C.accent; c.fill();
        c.fillStyle = C.out; c.beginPath(); c.arc(p.x + Math.cos(a) * p.r * 0.35 - Math.sin(a) * 3, p.y + Math.sin(a) * p.r * 0.35 + Math.cos(a) * 3, 1.6, 0, TAU); c.arc(p.x + Math.cos(a) * p.r * 0.35 + Math.sin(a) * 3, p.y + Math.sin(a) * p.r * 0.35 - Math.cos(a) * 3, 1.6, 0, TAU); c.fill();
      }
      if (p.dodgeCd > 0) {
        c.save(); c.lineWidth = 3.5; c.strokeStyle = 'rgba(236,232,220,.18)'; c.beginPath(); c.arc(p.x, p.y, p.r + 6, 0, TAU); c.stroke();
        c.strokeStyle = C.accent; c.globalAlpha = 0.85; c.lineCap = 'round'; c.beginPath(); c.arc(p.x, p.y, p.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.dodgeCd / s.dodgeCd)); c.stroke(); c.restore();
      }
      const nowMs = performance.now();
      if (w !== cdW) { cdW = w; cdWas = 0; }
      if (cdWas > 0 && p.dodgeCd <= 0) readyAt = nowMs;
      cdWas = p.dodgeCd;
      const rk = (nowMs - readyAt) / 300;
      if (rk >= 0 && rk < 1) { c.save(); c.globalAlpha = 1 - rk; c.strokeStyle = C.accent; c.lineWidth = 1 + 3 * (1 - rk); c.beginPath(); c.arc(p.x, p.y, p.r + 6 + rk * 10, 0, TAU); c.stroke(); c.restore(); }
    }
    function centerText(c, txt, y, size, col, band, alpha) {
      c.save(); c.globalAlpha = alpha;
      if (band) { c.fillStyle = 'rgba(10,11,17,.6)'; c.fillRect(0, y - size * 0.95, W, size * 1.9); }
      c.font = FONT(size); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = Math.max(4, size / 5); c.strokeStyle = C.out;
      c.strokeText(txt, W / 2, y); c.fillStyle = col; c.fillText(txt, W / 2, y); c.restore();
    }
    function idle(c) {
      const t = performance.now() / 1000, key = A().bg.title;
      if (key) {
        const k = 1.12, w = W * k, h = key.naturalHeight * w / key.naturalWidth;
        c.drawImage(key, W / 2 - w / 2, H * 0.43 - h / 2, w, h);
        const fadeTop = c.createLinearGradient(0, H * 0.43 - h / 2, 0, H * 0.43 - h / 2 + 40); fadeTop.addColorStop(0, 'rgba(18,20,29,1)'); fadeTop.addColorStop(1, 'rgba(18,20,29,0)');
        c.fillStyle = fadeTop; c.fillRect(0, 0, W, H * 0.43 - h / 2 + 40);
        const fadeBot = c.createLinearGradient(0, H * 0.43 + h / 2 - 50, 0, H * 0.43 + h / 2); fadeBot.addColorStop(0, 'rgba(18,20,29,0)'); fadeBot.addColorStop(1, 'rgba(18,20,29,1)');
        c.fillStyle = fadeBot; c.fillRect(0, H * 0.43 + h / 2 - 50, W, H);
        for (let i = 0; i < 14; i++) {
          const sx = (i * 97 + t * 12 * (1 + i % 3)) % (W + 40) - 20, sy = (i * 53 + Math.sin(t + i) * 20) % H;
          if (!spr(c, 'star', sx, sy, 6 + (i % 4) * 3, { alpha: 0.35 + 0.35 * Math.sin(t * 3 + i) })) break;
        }
        return;
      }
      for (let i = 0; i < 7; i++) {
        const a = t * 0.4 + i * 0.9, type = ['chase', 'shoot', 'dash'][i % 3];
        drawEnemy(c, { type, ai: type, x: 240 + Math.cos(a) * 170, y: 250 + Math.sin(a) * 150, r: OS.ENEMIES[type].r, st: 'move', ax: 0, ay: 0, flash: 0 }, t, 240, 250);
      }
      shadow(c, 240, 250, 11);
      c.beginPath(); c.arc(240, 250, 11, 0, TAU); c.fillStyle = C.fg; c.fill(); c.lineWidth = 3; c.strokeStyle = C.out; c.stroke();
    }
    const FX_ALPHA = 0.5;
    function drawFx(c, fx, text) {
      for (const f of fx) {
        if (!!f.t !== text) continue;
        const a = Math.max(0, f.life / f.max); c.save(); c.globalAlpha = a * (text ? 1 : FX_ALPHA);
        if (f.t) { c.font = FONT(f.size || 16); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = C.out; c.strokeText(f.t, f.x, f.y); c.fillStyle = f.col; c.fillText(f.t, f.x, f.y); }
        else if (f.pts) {
          c.strokeStyle = f.col; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath();
          f.pts.forEach((q, i) => { if (!i) c.moveTo(q.x, q.y); else { const pq = f.pts[i - 1], mx = (pq.x + q.x) / 2 + rnd(-8, 8), my = (pq.y + q.y) / 2 + rnd(-8, 8); c.lineTo(mx, my); c.lineTo(q.x, q.y); } });
          c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
        }
        else if (f.img) {
          const k = 1 - a; spr(c, f.img, f.x, f.y, f.size * (f.grow ? 0.6 + k * 0.7 : 1), { alpha: Math.min(1, a * 1.6) * FX_ALPHA, rot: f.rot || 0, ay: 0.5 });
        }
        else if (f.ring) { c.strokeStyle = f.col; c.lineWidth = f.lw || 4; c.beginPath(); c.arc(f.x, f.y, f.ring * (1.15 - a * 0.5), 0, TAU); c.stroke(); }
        else { c.fillStyle = f.col; c.beginPath(); c.arc(f.x, f.y, f.size * (0.5 + a * 0.5), 0, TAU); c.fill(); }
        c.restore();
      }
    }
    function draw(v) {
      const c = ctx, G = v.G;
      c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = C.floorEdge; c.fillRect(0, 0, cv.width, cv.height);
      let ox = 0, oy = 0; if (v.shakeT > 0) { ox = rnd(-4, 4) * v.shakeT * 4; oy = rnd(-4, 4) * v.shakeT * 4; }
      c.setTransform(S, 0, 0, S, ox * S, oy * S);
      floor(c);
      const w = G.w, run = G.run;
      if (!w || v.uiState === 'title') { idle(c); return; }
      const p = w.p, t = w.t, s = run.s;
      const many = w.pb.length > 40 ? 0.32 : w.pb.length > 20 ? 0.45 : 0.6;
      c.save(); c.lineCap = 'round';
      for (const b of w.pb) {
        const sp = Math.hypot(b.vx, b.vy) || 1, len = Math.min(16, b.r * 2.6), ux = b.vx / sp, uy = b.vy / sp;
        if (b.hurts) {
          c.globalAlpha = 1; c.strokeStyle = C.out; c.lineWidth = b.r * 2 + 3;
          c.beginPath(); c.moveTo(b.x - ux * len, b.y - uy * len); c.lineTo(b.x, b.y); c.stroke();
          c.strokeStyle = C.danger; c.lineWidth = b.r * 2;
          c.beginPath(); c.moveTo(b.x - ux * len, b.y - uy * len); c.lineTo(b.x, b.y); c.stroke();
          if (s.bounceSelfR) { c.strokeStyle = 'rgba(232,101,79,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(b.x, b.y, b.r + s.bounceSelfR, 0, TAU); c.stroke(); }
        } else {
          c.globalAlpha = many; c.strokeStyle = C.accent; c.lineWidth = Math.max(2.5, b.r * 1.5);
          c.beginPath(); c.moveTo(b.x - ux * len, b.y - uy * len); c.lineTo(b.x, b.y); c.stroke();
        }
      }
      c.restore();
      for (const mn of w.mines) {
        const on = mn.t >= 0.3, blink = on && Math.floor(t * 4 + mn.x) % 2 === 0;
        c.beginPath(); c.arc(mn.x, mn.y, 6, 0, TAU); c.fillStyle = '#3a3f55'; c.fill(); c.lineWidth = 2; c.strokeStyle = C.out; c.stroke();
        c.beginPath(); c.arc(mn.x, mn.y, 2.4, 0, TAU); c.fillStyle = on ? (blink ? C.danger : '#8a3a30') : C.muted; c.fill();
      }
      drawFx(c, v.fx, false);
      for (const e of w.en) { drawEnemy(c, e, t, p.x, p.y); if (e.slowed && e.ai !== 'boss') { c.strokeStyle = 'rgba(127,179,232,.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(e.x, e.y, e.r + 3, 0, TAU); c.stroke(); } }
      if (w.boss && !w.boss.dead) bossHp(c, w.boss);
      if (!w.over) drawPlayer(c, p, s, t, v.trail, w);
      const pulse = 1.9 + Math.sin(t * 10) * 0.25;
      for (const b of w.eb) {
        c.fillStyle = 'rgba(212,83,126,.28)'; c.beginPath(); c.arc(b.x, b.y, b.r * pulse, 0, TAU); c.fill();
        c.beginPath(); c.arc(b.x, b.y, b.r + 1, 0, TAU); c.fillStyle = C.rival; c.fill(); c.lineWidth = 3; c.strokeStyle = C.out; c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.42, 0, TAU); c.fill();
      }
      drawFx(c, v.fx, true);
      c.setTransform(S, 0, 0, S, 0, 0);
      const low = run.hp === 1 && !w.over ? 0.25 + Math.sin(performance.now() / 200) * 0.12 : 0;
      const red = Math.max(low, v.hurtFlash || 0);
      if (red > 0) {
        const g = c.createRadialGradient(W / 2, H / 2, W * 0.32, W / 2, H / 2, W * 0.72);
        g.addColorStop(0, 'rgba(232,101,79,0)'); g.addColorStop(1, `rgba(232,101,79,${red})`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
      for (const bm of w.bombs || []) {
        const k = 1 - bm.t / bm.max;
        c.save(); c.globalAlpha = 0.85; c.strokeStyle = C.danger; c.lineWidth = 4; c.setLineDash([7, 5]);
        c.beginPath(); c.arc(bm.x, bm.y, 30, 0, TAU); c.stroke(); c.setLineDash([]);
        c.globalAlpha = 0.3 + k * 0.4; c.fillStyle = C.danger; c.beginPath(); c.arc(bm.x, bm.y, 30 * k, 0, TAU); c.fill();
        c.globalAlpha = 1; c.fillStyle = C.danger; c.beginPath(); c.arc(bm.x, bm.y, 4, 0, TAU); c.fill(); c.restore();
      }
      for (const g of w.gifts || []) { const blink = !g.dash && g.t < 0.5 && Math.sin(t * 30) > 0; spr(c, 'gift', g.x, g.y, g.r * 2.6, { rot: g.dash ? g.rot : Math.sin(g.rot) * 0.4, flash: blink ? 0.1 : 0 }); }
      for (const s2 of w.warn) drawWarn(c, s2, t);
      if (v.bot) { c.font = FONT(12); c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillStyle = C.muted; c.fillText(v.bot, 12, H - 8); }
      if (v.banner) {
        const b = v.banner, a = Math.min(1, b.life / 0.35), pop = 1 + Math.max(0, b.life - b.max + 0.15) * 2;
        c.save(); c.translate(W / 2, H * 0.42); c.scale(pop, pop); c.translate(-W / 2, -H * 0.42); centerText(c, b.txt, H * 0.42, b.size || 22, b.col, true, a); c.restore();
      }
    }
    return { draw, resize, get canvas() { return cv; }, setScale(px) { cv.width = cv.height = px; S = px / W; } };
  };
})(globalThis.OS = globalThis.OS || {});
