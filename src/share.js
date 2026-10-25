(function (OS) {
  'use strict';
  const C = {
    bg1: '#22263a', bg2: '#12141d', dot: '#2a2e42', line: '#33374d', panel: '#1f2232',
    fg: '#ece8dc', muted: '#a09dae', accent: '#f2c14e', rival: '#d4537e', danger: '#e8654f', out: '#0e1018'
  };
  const DISP = 'DotGothic16,"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic",sans-serif';
  const BODY = '"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic",sans-serif';
  OS.drawRival = function (c, mood) {
    const OUT = C.out, FG = C.fg;
    const wob = mood === 'shock' ? 1.5 : 0;
    c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(30 + Math.cos(a) * 26, 32 + Math.sin(a) * 26); } c.closePath();
    c.fillStyle = '#4b1528'; c.fill(); c.lineWidth = 3; c.strokeStyle = C.rival; c.stroke();
    c.beginPath(); c.moveTo(12, 12); c.lineTo(20, 2 - wob); c.lineTo(24, 14); c.moveTo(48, 12); c.lineTo(40, 2 - wob); c.lineTo(36, 14); c.fillStyle = C.rival; c.fill();
    if (mood === 'shock') { c.fillStyle = 'rgba(175,169,236,.7)'; c.fillRect(13, 17, 3, 7); c.fillRect(44, 17, 3, 7); }
    if (mood === 'happy') {
      c.strokeStyle = FG; c.lineWidth = 2.5; c.beginPath(); c.moveTo(15, 31); c.quadraticCurveTo(21, 24, 27, 31); c.moveTo(33, 31); c.quadraticCurveTo(39, 24, 45, 31); c.stroke();
    } else {
      const eh = mood === 'smug' ? 3 : mood === 'think' ? 4.5 : mood === 'angry' ? 3.5 : 6.5;
      c.fillStyle = FG; c.beginPath(); c.ellipse(21, 30, 6, eh, 0, 0, 7); c.ellipse(39, 30, 6, eh, 0, 0, 7); c.fill();
      const lx = mood === 'think' ? 3 : 1, ly = mood === 'think' ? -1.5 : 1, pr = mood === 'shock' ? 1.8 : 2.6;
      c.fillStyle = OUT; c.beginPath(); c.arc(21 + lx, 30 + ly, pr, 0, 7); c.arc(39 + lx, 30 + ly, pr, 0, 7); c.fill();
    }
    if (mood === 'angry') { c.strokeStyle = C.rival; c.lineWidth = 3; c.beginPath(); c.moveTo(13, 20); c.lineTo(26, 25); c.moveTo(47, 20); c.lineTo(34, 25); c.stroke(); }
    c.strokeStyle = FG; c.lineWidth = 2.5; c.beginPath();
    if (mood === 'shock') c.ellipse(30, 45, 3.5, 4.5, 0, 0, 7);
    else if (mood === 'think') { c.moveTo(24, 45); c.lineTo(35, 43); }
    else if (mood === 'angry') { c.moveTo(22, 46); c.quadraticCurveTo(30, 40, 38, 46); }
    else if (mood === 'happy') { c.moveTo(21, 41); c.quadraticCurveTo(30, 50, 39, 41); }
    else { c.moveTo(22, 42); c.quadraticCurveTo(30, 48, 38, 40); }
    c.stroke();
  };
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function wrap(c, text, maxW) {
    const lines = []; let cur = '';
    const NO_HEAD = '。、」』）！？…ー';
    for (const ch of text) { if (c.measureText(cur + ch).width > maxW && cur && !NO_HEAD.includes(ch)) { lines.push(cur); cur = ch; } else cur += ch; }
    if (cur) lines.push(cur);
    return lines;
  }
  function icon(c, k, x, y, size, col) {
    const U = OS.UPGRADES[k]; if (!U || !U.icon || typeof Path2D === 'undefined') return;
    c.save(); c.translate(x, y); c.scale(size / 24, size / 24);
    c.strokeStyle = col; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(U.icon)); c.restore();
  }
  const T = 'ツンデレ小悪魔メフィーの黙って強くなりなさいよっ！';
  OS.makeShareCard = async function (info) {
    const W = 1200, H = 630;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    try { await Promise.all([document.fonts.load(`40px ${DISP}`, 'ツンデレ小悪魔メフィーの黙って強くなりなさいよっ！合格'), document.fonts.load(`28px ${BODY}`, 'あの強化')]); } catch (e) {}
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = C.dot; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) c.fillRect(x - 1.5, y - 1.5, 3, 3);
    c.lineWidth = 6; c.strokeStyle = info.win ? C.accent : C.line; roundRect(c, 12, 12, W - 24, H - 24, 18); c.stroke();
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    const logo = OS.ART && OS.ART.img.logo;
    if (logo) {
      const lw = 860, lh = lw * logo.naturalHeight / logo.naturalWidth;
      c.save(); c.globalAlpha = 0.1; c.drawImage(logo, (W - lw) / 2, (H - lh) / 2, lw, lh); c.restore();
      if (info.tier) { c.fillStyle = C.muted; c.font = `26px ${DISP}`; c.fillText(`本気度 ${info.tier}`, 60, 68); }
    }
    else { c.fillStyle = C.muted; c.font = `28px ${DISP}`; c.fillText(info.tier ? `${T}　本気度 ${info.tier}` : T, 60, 82); }
    const head = info.head || (info.endless ? `エンドレス フェーズ${info.round}まで` : info.win ? `${info.rounds}フェーズ 合格！` : info.gaveUp ? `フェーズ ${info.round} まで` : `フェーズ ${info.round} で倒れた`);
    let hs = 64; c.font = `${hs}px ${DISP}`;
    while (hs > 32 && c.measureText(head).width > 560) { hs -= 2; c.font = `${hs}px ${DISP}`; }
    c.fillStyle = info.win ? C.accent : C.fg; c.fillText(head, 60, 132);
    const pw = 52, gap = 8;
    for (let i = 0; i < (info.endless ? 0 : info.rounds); i++) {
      const done = i < info.round - (info.win ? 0 : 1), ko = !info.win && i === info.round - 1;
      c.fillStyle = done ? C.accent : ko ? C.danger : C.line; roundRect(c, 60 + i * (pw + gap), 152, pw, 12, 4); c.fill();
    }
    const face = OS.ART && OS.ART.img['rival_' + info.mood];
    if (face) c.drawImage(face, 640, 30, 180, 180 * face.naturalHeight / face.naturalWidth);
    else { c.save(); c.translate(690, 52); c.scale(2.2, 2.2); OS.drawRival(c, info.mood); c.restore(); }
    c.font = `26px ${BODY}`;
    const lines = wrap(c, info.quote, 300).slice(0, 4);
    const bx = 830, by = 60, bw = 330, bh = Math.max(100, 30 + lines.length * 36);
    c.fillStyle = C.panel; roundRect(c, bx, by, bw, bh, 14); c.fill(); c.lineWidth = 3; c.strokeStyle = C.rival; c.stroke();
    c.beginPath(); c.moveTo(bx, by + 44); c.lineTo(bx - 16, by + 54); c.lineTo(bx, by + 64); c.closePath(); c.fillStyle = C.rival; c.fill();
    c.fillStyle = C.fg; lines.forEach((l, i) => c.fillText(l, bx + 16, by + 46 + i * 36));
    c.fillStyle = C.muted; c.font = `24px ${DISP}`; c.fillText('押し付けられた順', 60, 212);
    let x = 60, y = 228; const chipH = 50;
    c.font = `24px ${BODY}`;
    for (const s of info.seq) {
      const name = OS.UPGRADES[s.up].name, w = 64 + c.measureText(name).width + 22;
      if (x + w > W - 60) { x = 60; y += chipH + 12; }
      if (y > 300) break;
      c.fillStyle = C.panel; roundRect(c, x, y, w, chipH, 8); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = s.combo ? C.accent : C.line; c.stroke();
      c.fillStyle = C.muted; c.font = `18px ${DISP}`; c.fillText(String(s.round), x + 12, y + 32);
      icon(c, s.up, x + 30, y + 13, 24, C.accent);
      c.fillStyle = C.fg; c.font = `24px ${BODY}`; c.fillText(name, x + 62, y + 34);
      x += w + 10;
    }
    const sy = 384;
    c.fillStyle = C.muted; c.font = `24px ${DISP}`; c.fillText('倒した数', 60, sy);
    c.fillStyle = C.fg; c.font = `72px ${DISP}`; c.fillText(String(info.kills), 60, sy + 74);
    const cy0 = sy;
    c.fillStyle = C.muted; c.font = `24px ${DISP}`; c.fillText('うっかりコンボ', 330, cy0);
    c.font = `20px ${DISP}`;
    const tagW = c.measureText(`#黙って強くなりなさいよ　${info.date}`).width;
    if (info.combos.length) {
      c.font = `24px ${DISP}`;
      const rowY = [cy0 + 12, cy0 + 58, cy0 + 104, cy0 + 150], rowEnd = [W - 60, W - 60, W - 60, W - 60 - tagW - 24], chipH = 38, last = rowY.length - 1;
      let row = 0, cx = 330, shown = 0;
      for (const name of info.combos) {
        const w = c.measureText(name).width + 32, rest = info.combos.length - shown - 1;
        const room = rowEnd[row] - (rest > 0 && row === last ? 80 : 0);
        if (cx + w > room) { if (row === last) break; row++; cx = 330; }
        roundRect(c, cx, rowY[row], w, chipH, 20); c.fillStyle = 'rgba(242,193,78,.14)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = C.accent; c.stroke();
        c.fillStyle = C.accent; c.fillText(name, cx + 16, rowY[row] + 28);
        cx += w + 10; shown++;
      }
      if (shown < info.combos.length) { c.fillStyle = C.muted; c.fillText(`+${info.combos.length - shown}`, cx + 4, rowY[last] + 28); }
    } else { c.fillStyle = C.muted; c.font = `28px ${BODY}`; c.fillText('なし', 330, cy0 + 46); }
    c.textAlign = 'right'; c.fillStyle = C.muted; c.font = `20px ${DISP}`;
    c.fillText(`#黙って強くなりなさいよ　${info.date}`, W - 60, H - 40);
    return cv;
  };
})(globalThis.OS = globalThis.OS || {});
