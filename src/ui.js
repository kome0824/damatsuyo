(function (OS) {
  'use strict';
  const W = 480, H = 480;
  const cv = document.getElementById('cv'), ov = document.getElementById('ov');
  const R = OS.makeRenderer(cv);
  const Sfx = OS.Sfx;
  const DEV_OK = !OS.PUBLIC || /[?&#]dev\b/.test(location.href);
  const IME_NOTE = '日本語入力がオンだと、動きがおかしくなることがある。そのときは英語入力に切り替えて。';
  const MEPHY_NOTE = 'このフェーズはメフィーが出る。時間切れはない。倒すまで続く。';
  function load(k, d) { try { const v = localStorage.getItem(k); if (v) return JSON.parse(v); } catch (e) {} return d; }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const CFG_KEY = 'os2_cfg2';
  try { localStorage.removeItem('os2_cfg'); } catch (e) {}
  let cfg = OS.loadConfig(load(CFG_KEY, null));
  const REC0 = { combos: [], runs: 0, best: 0, bestRound: 0, wins: 0, seen: [], tierCleared: -1, endlessBest: { round: 0, kills: 0 }, ach: [], bossKills: 0, totalKills: 0, enemyKills: {}, bossBy: {}, met: [], mephyKills: 0, mephy6: 0 };
  let rec = Object.assign({}, REC0, load('os2_rec', {}));
  const arr = v => Array.isArray(v) ? v.slice() : [], obj = v => Object.assign({}, v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  rec.ach = arr(rec.ach); rec.combos = arr(rec.combos); rec.seen = arr(rec.seen); rec.met = arr(rec.met);
  rec.enemyKills = obj(rec.enemyKills); rec.bossBy = obj(rec.bossBy);
  rec.endlessBest = Object.assign({ round: 0, kills: 0 }, obj(rec.endlessBest));
  for (const k of Object.keys(REC0)) if (typeof REC0[k] === 'number' && !Number.isFinite(rec[k])) rec[k] = REC0[k];
  let ui = Object.assign({ auto: 'off', sound: true }, load('os2_ui', {}));
  if (ui.tier != null && !Number.isFinite(ui.tier)) ui.tier = 0;
  function saveCfg() {
    const d = OS.diffConfig(cfg);
    if (Object.keys(d).length) store(CFG_KEY, d); else { try { localStorage.removeItem(CFG_KEY); } catch (e) {} }
    if (typeof showChanges === 'function') showChanges();
  }
  Sfx.on = ui.sound;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const comboOf = id => OS.COMBOS.find(c => c.id === id);
  const achOf = id => OS.ACHIEVEMENTS.find(a => a.id === id);
  let runAch = [], milestoneNow = null, achQueue = [];
  function checkAch(ev, extra) {
    if (!rec.ach) rec.ach = [];
    const ctx = Object.assign({ rec, run: ev === 'load' ? null : G && G.run, win: false, tier: G && G.cfg ? G.cfg.tier || 0 : 0, ev, multi: 0 }, extra);
    const got = OS.ACHIEVEMENTS.filter(a => !rec.ach.includes(a.id) && (() => { try { return a.test(ctx); } catch (e) { return false; } })());
    if (!got.length) return;
    for (const a of got) { rec.ach.push(a.id); if (ev !== 'load') runAch.push(a.id); }
    store('os2_rec', rec);
    if (ev === 'load') return;
    if (ev !== 'end') achQueue.push(`実績「${got.map(a => a.name).join('」「')}」`);
    Sfx.play('gain');
  }
  const buffOf = id => OS.ENEMY_BUFFS.find(b => b.id === id) || OS.DEBUFFS.find(b => b.id === id) || (id === 'heal' ? OS.HEAL_OPTION : null);
  const upOf = k => OS.UPGRADES[k] || OS.EXTRAS[k];
  const ico = k => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${upOf(k).icon}"/></svg>`;
  const touch = matchMedia('(pointer:coarse)').matches;
  let fx = [], trail = [], shakeT = 0, hitStop = 0, banner = null, info = null, toast = null, hint = null, hurtFlash = 0, killPulse = 0, grazeCd = 0, vetoPulse = 0;
  const rivalHud = { mood: 'smug', moodT: 0, txt: '', life: 0, cd: 0 };
  function rivalSay(mood, lines, force) {
    rivalHud.mood = mood; rivalHud.moodT = 1.4;
    if (!lines || (!force && rivalHud.cd > 0)) return;
    rivalHud.txt = Array.isArray(lines) ? lines[Math.floor(Math.random() * lines.length)] : lines;
    rivalHud.life = 1.6; rivalHud.cd = 3.5;
  }
  let killTimes = [], multiShown = 0;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function burst(x, y, col, n, sp) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), s = rnd(60, sp || 220); fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.25, .55), max: .55, col, size: rnd(2, 4.5) }); } }
  function txt(t, x, y, col, size) { fx.push({ t, x, y, vx: 0, vy: -46, life: .75, max: .75, col, size }); }
  function ring(x, y, r, col, life, lw) { fx.push({ ring: r, x, y, vx: 0, vy: 0, life: life || .3, max: life || .3, col, lw }); }
  function setBanner(t, life, col, size) { banner = { txt: t, life: life || 1.2, max: life || 1.2, col: col || '#f2c14e', size }; }
  let ffwd = false;
  function onEvent(type, d) {
    if (ffwd) return;
    if (type === 'hurt') { rivalSay('angry', G.run && G.run.hp === 1 ? OS.LINES.inLow : OS.LINES.inHurt, G.run && G.run.hp === 1); shakeT = 0.28; hitStop = 0.07; hurtFlash = 0.45; txt('-1', d.x, d.y - 18, '#e8654f', 18); burst(d.x, d.y, '#e8654f', 12); Sfx.play('hurt'); }
    else if (type === 'dead') { burst(d.x, d.y, '#ece8dc', 30, 300); ring(d.x, d.y, 60, '#ece8dc', .5); fx.push({ img: 'hero1', x: d.x, y: d.y, vx: rnd(-40, 40), vy: -150, size: 34, life: 0.9, max: 0.9, spin: 9, rot: 0, keep: true }); }
    else if (type === 'kill') {
      rec.enemyKills[d.type] = (rec.enemyKills[d.type] || 0) + 1;
      burst(d.x, d.y, OS.ENEMIES[d.type].color, 10); ring(d.x, d.y, 16, OS.ENEMIES[d.type].color, .22, 2); killPulse = 1; Sfx.play('kill');
      if (d.sucked && G.w) { const p = G.w.p; for (let i = 0; i < 8; i++) fx.push({ x: d.x + rnd(-10, 10), y: d.y + rnd(-10, 10), vx: (p.x - d.x) * 6 + rnd(-30, 30), vy: (p.y - d.y) * 6 + rnd(-30, 30), life: rnd(.15, .3), max: .3, col: '#9b6bd8', size: rnd(2, 4) }); }
      if (fx.length < 260) fx.push({ img: 'star', x: d.x, y: d.y, vx: 0, vy: 0, size: 14, life: .3, max: .3, grow: true, rot: rnd(0, 1.5) });
      const now = G.w ? G.w.t : 0; killTimes.push(now); killTimes = killTimes.filter(t => now - t < 0.6);
      if (killTimes.length < 5) multiShown = 0;
      else if ((killTimes.length >= 10 && multiShown < 10) || (killTimes.length >= 5 && multiShown < 5)) {
        multiShown = killTimes.length >= 10 ? 10 : 5; checkAch('multi', { multi: multiShown });
        const p = G.w.p; txt(`まとめて${multiShown}体！`, p.x, p.y - 30, '#f2c14e', multiShown >= 10 ? 22 : 18); Sfx.play('gain');
        if (multiShown >= 10) rivalSay('shock', OS.LINES.inMulti, true);
      }
    }
    else if (type === 'hit') { Sfx.play('hit'); }
    else if (type === 'shot') { Sfx.play('shot'); }
    else if (type === 'dodge') { Sfx.play('dodge'); }
    else if (type === 'graze') { if (grazeCd <= 0) { txt('ひらり', d.x, d.y - 22, '#afa9ec', 14); grazeCd = 0.4; rivalSay('think', OS.LINES.inGraze); } Sfx.play('tick'); }
    else if (type === 'heal') { fx.push({ img: 'heart', x: d.x, y: d.y - 20, vx: 0, vy: -60, size: 16, life: .8, max: .8 }); txt('+1', d.x + 14, d.y - 18, '#5dcaa5', 18); ring(d.x, d.y, 22, '#5dcaa5', .35, 2); Sfx.play('heal'); }
    else if (type === 'drain') { txt('-1', d.x, d.y - 18, '#d4537e'); Sfx.play('drain'); }
    else if (type === 'mine' || type === 'bomb' || type === 'blast') fx.push({ img: 'boom', x: d.x, y: d.y, vx: 0, vy: 0, size: d.r * 1.7, life: .42, max: .42, grow: true, rot: rnd(-0.4, 0.4) });
    if (type === 'mine') { ring(d.x, d.y, d.r, '#e8654f', .35, 4); burst(d.x, d.y, '#e8654f', 12, 240); shakeT = Math.max(shakeT, 0.1); Sfx.play('blast'); }
    else if (type === 'burst') { ring(d.x, d.y, d.r, '#f2c14e', .2, 2); Sfx.play('pop'); }
    else if (type === 'bolt') { fx.push({ pts: d.pts, x: 0, y: 0, vx: 0, vy: 0, life: 0.22, max: 0.22, col: '#f2e36b' }); Sfx.play('bolt'); }
    else if (type === 'crit') { fx.push({ img: 'star', x: d.x, y: d.y, vx: 0, vy: 0, size: 34, life: .4, max: .4, grow: true }); txt(d.line, d.x, d.y - 16, '#f2c14e', 16); Sfx.play('crit'); }
    else if (type === 'block') { burst(d.x, d.y, '#e9e1c4', 4, 120); Sfx.play('block'); }
    else if (type === 'bomb') { ring(d.x, d.y, d.r, '#e8654f', .4, 5); burst(d.x, d.y, '#e8a04f', 16, 260); shakeT = Math.max(shakeT, 0.15); Sfx.play('blast'); }
    else if (type === 'call') { ring(d.x, d.y, 50, '#afa9ec', .4, 3); Sfx.play('call'); }
    else if (type === 'thorns') { ring(d.x, d.y, 40, '#f2c14e', .3, 3); Sfx.play('thorns'); }
    else if (type === 'blast') { ring(d.x, d.y, d.r, '#f2c14e', .35, 5); burst(d.x, d.y, '#f2c14e', 14, 260); shakeT = Math.max(shakeT, 0.12); Sfx.play('blast'); }
    else if (type === 'vetoGain') { vetoPulse = 1; toast = { txt: `突き返しが1回ふえた（${d.veto}回）`, life: 2.2 }; rivalSay('angry', d.line, true); Sfx.play('gain'); }
    else if (type === 'slam' || type === 'bossBomb') { shakeT = Math.max(shakeT, 0.15); ring(d.x, d.y, 34, '#e8654f', .3, 3); burst(d.x, d.y, '#e8654f', 10, 220); Sfx.play('blast'); }
    else if (type === 'lob') { Sfx.play('warn'); }
    else if (type === 'boss') { if (!rec.met.includes(d.kind)) { rec.met.push(d.kind); store('os2_rec', rec); } setBanner(d.mephy ? (d.hon ? '本気のメフィーが来た！' : 'メフィーが来た！') : `強敵　${d.name}`, d.mephy ? 2.6 : 1.9, '#d4537e', 26); toast = { txt: `${OS.RIVAL_NAME}「${d.line}」`, life: d.mephy ? 5 : 3 }; shakeT = 0.3; Sfx.play('boss'); }
    else if (type === 'mephySkill') { rivalSay(d.step === 3 ? 'angry' : 'smug', d.line, true); setBanner(d.line, 1.4, '#d4537e', 20); Sfx.play('call'); }
    else if (type === 'mephyRage') { setBanner('メフィーが怒った！', 1.4, '#e8654f', 24); rivalSay('angry', d.line, true); shakeT = 0.25; Sfx.play('boss'); }
    else if (type === 'giftPop') { burst(d.x, d.y, '#d4537e', 8, 160); Sfx.play('blast'); }
    else if (type === 'milestone') { milestoneNow = d; Sfx.play('gain'); }
    else if (type === 'bossDown') { rec.bossKills = (rec.bossKills || 0) + 1; rec.bossBy[d.kind] = (rec.bossBy[d.kind] || 0) + 1; if (d.mephy) { rec.mephyKills = (rec.mephyKills || 0) + 1; if (d.tier6) rec.mephy6 = (rec.mephy6 || 0) + 1; fx.push({ img: 'mephy3', x: d.x, y: d.y, vx: 0, vy: -20, size: 110, life: 2.4, max: 2.4 }); } store('os2_rec', rec); checkAch('boss'); rivalSay('shock', d.line, true); for (let i = 0; i < 5; i++) fx.push({ img: 'boom', x: d.x + rnd(-40, 40), y: d.y + rnd(-40, 40), vx: 0, vy: 0, size: rnd(50, 90), life: 0.4 + i * 0.12, max: 0.4 + i * 0.12, grow: true, rot: rnd(-1, 1) }); burst(d.x, d.y, '#d4537e', 40, 320); burst(d.x, d.y, '#f2c14e', 30, 320); ring(d.x, d.y, 90, '#f2c14e', .6, 6); shakeT = 0.45; hitStop = 0.12; const gift = [d.heal ? `体力+${d.heal}` : '', d.veto ? `突き返し+${d.veto}` : ''].filter(Boolean).join('・'); setBanner(`${d.name || '強敵'}を倒した！`, d.mephy ? 2.6 : 1.9, '#f2c14e', 26); if (gift) toast = { txt: `ごほうび：${gift}`, life: 2.4 }; if (d.veto) vetoPulse = 1; Sfx.play('bossDown'); }
    else if (type === 'roundClear') { for (const e of d.enemies) burst(e.x, e.y, '#a09dae', 6); if (!d.byBoss) setBanner(d.bossLeft ? 'フェーズ終了　強敵は帰っていった' : 'フェーズ終了', 0.9);   Sfx.play('clear'); }
    else if (type === 'round') {
      setBanner(`フェーズ ${d.round} / ${G.run.endless && d.round > G.run.rounds ? '∞' : G.run.rounds}`, 1.2, '#f2c14e', 26); Sfx.play('round');
      startMusic(); rivalHud.mood = 'smug'; rivalHud.txt = ''; lastLeft = 99; heartT = 0; killTimes = [];
      if (d.mephy) toast = { txt: MEPHY_NOTE, life: 3.2 };
      else if (d.boss) toast = { txt: 'このフェーズは強敵が出る。倒すと早く終わる', life: 2.6 };
      if (d.round === 1 && rec.runs <= 3) hint = { txt: touch ? `左の${ui.ctrl === 'dpad' ? '方向キー' : 'スティック'}で移動・「回避」で避ける。攻撃は自動。` : 'WASD／矢印で移動・Space か左クリックで回避。攻撃は自動。', life: 6 };
    }
  }
  const keys = new Map(); let dodgePress = false, lastDown = '', imeWarned = false, suspectT = 0, zkWarned = false;
  const raw = new Map(), upAt = new Map(), noUp = new Map(); let orphanAt = -1e9, lastKeyAt = 0;
  const isZenkaku = e => e.key === 'Zenkaku' || e.key === 'Hankaku' || e.key === 'HankakuZenkaku' || e.keyCode === 243 || e.keyCode === 244;
  function zkWarn() {
    if (!zkWarned) { zkWarned = true; toast = { txt: IME_NOTE, life: 5 }; }
  } const stick = { x: 0, y: 0 };
  let repCode = '', repTs = 0;
  const DIRS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
  const keyLog = []; let keyText = '', logVer = 0;
  const pushLog = o => { o.t = performance.now(); o.st = uiState; keyLog.push(o); if (keyLog.length > 60) keyLog.shift(); logVer++; };
  const logKey = (type, e) => {
    const l = keyLog[keyLog.length - 1];
    if (e.repeat && l && !l.note && l.rep && l.code === e.code && l.type === type) { l.n = (l.n || 1) + 1; l.t = performance.now(); logVer++; return; }
    pushLog({ type, code: e.code, key: e.key, rep: !!e.repeat, kc: e.keyCode });
  };
  const logNote = (type, code) => pushLog({ type, code: code || '', note: true });
  let sideOn = /[?&#]dev\b/.test(location.href);
  const side = document.createElement('aside'); side.className = 'keyside'; side.hidden = true;
  side.innerHTML = `<h3>キーの記録</h3><p class="ks-held"></p><div class="ks-btns"><button class="btn small" type="button" tabindex="-1" data-k="copy">記録をコピー</button><button class="btn small" type="button" tabindex="-1" data-k="clear">消す</button></div><ol class="ks-log"></ol>`;
  document.body.appendChild(side);
  const ksHeld = side.querySelector('.ks-held'), ksLog = side.querySelector('.ks-log');
  const fmtSide = k => `${(k.t / 1000).toFixed(3)}　${k.type}　${k.code || (k.note ? '' : '（なし）')}${k.note ? '' : `　${k.key || ''}${k.rep ? (k.n > 1 ? `　くり返し×${k.n}` : '　くり返し') : ''}　kc${k.kc}`}　[${k.st}]`;
  const heldTxt = () => `押していると見ている：${[...keys.keys()].join('・') || 'なし'}　／　届いた合図のまま：${[...raw.keys()].join('・') || 'なし'}`;
  function placeSide() {
    const L = document.querySelector('.wrap').getBoundingClientRect().left;
    const on = sideOn && matchMedia('(hover: hover) and (pointer: fine)').matches && L >= 230;
    side.hidden = !on; if (on) side.style.width = Math.min(340, L - 16) + 'px';
  }
  addEventListener('resize', placeSide); requestAnimationFrame(placeSide);
  let sideVer = -1, sideTick = 0;
  setInterval(() => {
    if (++sideTick % 4 === 0) placeSide();
    if (side.hidden) return;
    ksHeld.textContent = heldTxt();
    if (sideVer === logVer) return; sideVer = logVer;
    ksLog.innerHTML = keyLog.slice().reverse().map(k => `<li${k.note ? ' class="note"' : ''}>${esc(fmtSide(k))}</li>`).join('');
  }, 120);
  side.addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    if (b.dataset.k === 'copy') {
      const text = `キーの記録　${new Date().toLocaleString()}\n${navigator.userAgent}\n${heldTxt()}\n` + keyLog.map(fmtSide).join('\n');
      const done = ok => { b.textContent = ok ? 'コピーしました' : 'コピーできませんでした'; setTimeout(() => { b.textContent = '記録をコピー'; }, 1500); };
      try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (_) { done(false); }
    } else { keyLog.length = 0; logVer++; }
    b.blur();
  });
  const GK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyK', 'KeyX', 'ShiftLeft', 'ShiftRight']);
  const KEY_CODE = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', k: 'KeyK', x: 'KeyX', ' ': 'Space', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
  const codeOf = e => e.code || KEY_CODE[e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key] || '';
  const isTextField = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|reset|color|file)$/.test(el.type)));
  const spaceBlocked = () => uiState === 'pick' || uiState === 'enemyPick' || uiState === 'over';
  const firstTouch = () => { Sfx.unlock(); if (onTitle()) Sfx.music('title'); };
  addEventListener('pointerdown', firstTouch, true);
  addEventListener('keydown', e => {
    logKey('押す', e); lastKeyAt = performance.now();
    if (e.code && !e.repeat) {
      raw.set(e.code, e.timeStamp);
      if (DIRS.includes(e.code) && e.timeStamp - orphanAt <= 5) { noUp.set(e.code, performance.now()); logNote('離すが届かないキー', e.code); }
      else noUp.delete(e.code);
    } else if (e.repeat && noUp.has(e.code)) noUp.set(e.code, performance.now());
    if (e.repeat && e.code && e.code === repCode && e.timeStamp - repTs > 350) {
      for (const k of DIRS) if (k !== e.code && keys.delete(k)) logNote('くり返しが止まったので消す', k);
    }
    repCode = e.repeat ? e.code : ''; repTs = e.timeStamp;
    firstTouch();
    if (isTextField(e.target)) return;
    if (e.code === 'Space' && spaceBlocked()) e.preventDefault();
    if (!askEl.hidden) { if (e.code === 'Escape') closeAsk(); return; }
    if (uiState === 'ending' || uiState === 'mephyTalk') {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) endingNext(); }
      else if (e.code === 'Escape') { if (uiState === 'mephyTalk') talkSkip(); else if (endTalk) endingSkip(); }
      return;
    }
    if (uiState === 'paused') {
      if (['Space', 'Enter', 'Escape', 'KeyP'].includes(e.code)) { e.preventDefault(); resume(); }
      return;
    }
    if (uiState === 'overtime') {
      if (e.key === '1') overtimeAnswer(true); else if (e.key === '2') overtimeAnswer(false);
      return;
    }
    if (uiState === 'pick' || uiState === 'enemyPick') {
      if (['1', '2', '3'].includes(e.key)) { const b = ov.querySelectorAll('button[data-i]')[+e.key - 1]; if (b && !b.disabled) b.click(); }
      if (e.code === 'Enter' && uiState === 'pick') { const pb = document.getElementById('pb'); if (pb && !pb.hidden) { e.preventDefault(); acceptPick(); } }
      return;
    }
    if ((uiState === 'zukan' || uiState === 'howto' || uiState === 'ach' || uiState === 'settings' || uiState === 'endDemo') && e.code === 'Escape') { showTitle(); return; }
    if (uiState !== 'play') return;
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pause(); return; }
    if (GK.has(e.code)) {
      e.preventDefault();
      const a = document.activeElement;
      if (a && a !== document.body && !isTextField(a)) a.blur();
    }
    if (isZenkaku(e)) { zkWarn(); return; }
    const c = codeOf(e);
    if (!c) { if (e.repeat && keys.has(lastDown)) keys.set(lastDown, performance.now()); return; }
    keys.set(c, performance.now()); lastDown = c;
    const OPP = { KeyA: ['KeyD', 'ArrowRight'], ArrowLeft: ['KeyD', 'ArrowRight'], KeyD: ['KeyA', 'ArrowLeft'], ArrowRight: ['KeyA', 'ArrowLeft'], KeyW: ['KeyS', 'ArrowDown'], ArrowUp: ['KeyS', 'ArrowDown'], KeyS: ['KeyW', 'ArrowUp'], ArrowDown: ['KeyW', 'ArrowUp'] };
    if (!e.repeat && OPP[c]) for (const k of OPP[c]) if ((noUp.has(k) || !raw.has(k)) && keys.delete(k)) logNote('逆を押したので消す', k);
    if (!imeWarned && (e.key === 'Process' || e.keyCode === 229)) { imeWarned = true; toast = { txt: IME_NOTE, life: 5 }; }
    if (!e.repeat && (c === 'Space' || c === 'KeyK' || c === 'KeyX' || c === 'ShiftLeft' || c === 'ShiftRight')) dodgePress = true;
  });
  addEventListener('keyup', e => {
    logKey('離す', e); repCode = ''; lastKeyAt = performance.now();
    if (isZenkaku(e)) zkWarn();
    const orphan = !!e.code && (!raw.has(e.code) || isZenkaku(e));
    if (orphan) {
      orphanAt = e.timeStamp;
      const tx = upAt.get(e.code); upAt.delete(e.code);
      if (tx !== undefined) for (const [k, t] of raw) if (k !== e.code && DIRS.includes(k) && t - tx >= 0 && t - tx <= 5 && !noUp.has(k)) { noUp.set(k, performance.now()); logNote('取り違えかもしれない離す', k); }
    }
    if (e.code) { raw.delete(e.code); noUp.delete(e.code); if (!orphan) upAt.set(e.code, e.timeStamp); }
    keys.delete(e.code); keys.delete(codeOf(e));
    const PAIR = { KeyW: 'ArrowUp', ArrowUp: 'KeyW', KeyA: 'ArrowLeft', ArrowLeft: 'KeyA', KeyS: 'ArrowDown', ArrowDown: 'KeyS', KeyD: 'ArrowRight', ArrowRight: 'KeyD' };
    if (PAIR[codeOf(e)]) keys.delete(PAIR[codeOf(e)]);
    if (!GK.has(codeOf(e)) && (e.key === 'Process' || e.keyCode === 229 || !codeOf(e))) {
      for (const k of DIRS) if (k !== lastDown && keys.delete(k)) logNote('分からない離すで消す', k);
      suspectT = performance.now();
    }
    if (e.code === 'Space' && spaceBlocked() && !isTextField(e.target)) e.preventDefault();
  });
  addEventListener('pointerdown', () => Sfx.unlock(), true);
  addEventListener('blur', () => { logNote('画面から外れた'); keys.clear(); raw.clear(); noUp.clear(); dodgePress = false; stickReset(); if (uiState === 'play' && !bot) pause(); });
  addEventListener('focus', () => { logNote('画面に戻った'); keys.clear(); raw.clear(); noUp.clear(); dodgePress = false; });
  document.addEventListener('visibilitychange', () => { keys.clear(); dodgePress = false; stickReset(); if (document.hidden && uiState === 'play' && !bot) pause(); rollHold(document.hidden); });
  document.querySelector('.stage').addEventListener('pointerdown', e => {
    const a = document.activeElement;
    if (a && a !== document.body && !ov.contains(a)) a.blur();
    if (e.pointerType === 'mouse' && e.button === 0 && uiState === 'play' && ov.hidden) { dodgePress = true; e.preventDefault(); }
  });
  document.addEventListener('contextmenu', e => { if (!e.target.closest('.share-img, textarea, input')) e.preventDefault(); });
  const stickEl = document.getElementById('stick'), knob = document.getElementById('knob'); let sid = null;
  const arEls = [...stickEl.querySelectorAll('.ar')], lightAr = deg => arEls.forEach(el => el.classList.toggle('on', +el.dataset.a === deg));
  function mv(e) {
    const r = stickEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = r.width / 2 - 20, L = Math.hypot(dx, dy);
    if (ui.ctrl === 'dpad') {
      if (L < 12) { stick.x = stick.y = 0; knob.style.transform = ''; stickEl.classList.remove('on'); lightAr(-1); return; }
      const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), a = k * (Math.PI / 4);
      stick.x = Math.cos(a); stick.y = Math.sin(a); knob.style.transform = `translate(${stick.x * m}px,${stick.y * m}px)`; stickEl.classList.add('on'); lightAr(((k * 45 + 90) % 360 + 360) % 360); return;
    }
    if (L > m) { dx *= m / L; dy *= m / L; } stick.x = dx / m; stick.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  stickEl.addEventListener('pointerdown', e => { sid = e.pointerId; try { stickEl.setPointerCapture(sid); } catch (_) {} mv(e); e.preventDefault(); });
  stickEl.addEventListener('pointermove', e => { if (e.pointerId === sid) mv(e); });
  function stickReset() { sid = null; stick.x = stick.y = 0; knob.style.transform = ''; stickEl.classList.remove('on'); lightAr(-1); }
  const es = e => { if (e.pointerId === sid) stickReset(); };
  const syncCtrl = () => { stickEl.classList.toggle('dpad', ui.ctrl === 'dpad'); stickEl.classList.remove('on'); knob.style.transform = ''; lightAr(-1); };
  syncCtrl();
  stickEl.addEventListener('pointerup', es); stickEl.addEventListener('pointercancel', es);
  document.getElementById('bDodge').addEventListener('pointerdown', e => { dodgePress = true; e.preventDefault(); });
  document.getElementById('pad').addEventListener('contextmenu', e => e.preventDefault());
  const padEl0 = document.getElementById('pad'), padActs = document.createElement('div');
  padActs.className = 'pad-acts'; padEl0.appendChild(padActs);
  const sideActs = document.getElementById('sideActs');
  [padActs, sideActs].forEach(el => el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b); }));
  const portrait = matchMedia('(pointer: coarse) and (orientation: portrait)'), landscape = matchMedia('(pointer: coarse) and (orientation: landscape)');
  let padFrom = null;
  function placeActs() {
    if (!padFrom || !padFrom.parent.isConnected) return;
    const { a, parent, next, sel } = padFrom;
    const to = portrait.matches ? padActs : landscape.matches && sel === '.title-acts' ? sideActs : null;
    if (to) { if (a.parentNode !== to) { to.innerHTML = ''; to.appendChild(a); } }
    else if (a.parentNode !== parent) parent.insertBefore(a, next && next.parentNode === parent ? next : null);
    if (to !== padActs) padActs.innerHTML = '';
    if (to !== sideActs) sideActs.innerHTML = '';
    padEl0.classList.toggle('acts-on', to === padActs); sideActs.hidden = to !== sideActs;
    fitStage();
  }
  function movePadActs(sel) {
    const a = ov.querySelector(sel || '.acts');
    if (!a || !matchMedia('(pointer: coarse)').matches) return;
    padFrom = { a, parent: a.parentNode, next: a.nextSibling, sel };
    placeActs();
  }
  function clearPadActs() {
    padFrom = null; if (!padEl0.classList.contains('acts-on') && sideActs.hidden) return;
    padActs.innerHTML = ''; sideActs.innerHTML = ''; sideActs.hidden = true; padEl0.classList.remove('acts-on'); fitStage();
  }
  if (portrait.addEventListener) portrait.addEventListener('change', placeActs); else if (portrait.addListener) portrait.addListener(placeActs);
  function humanInput() {
    let mx = 0, my = 0;
    const now = performance.now();
    for (const [k, t] of noUp) if (k === lastDown ? now - t > 1000 : now - lastKeyAt > 1500) { noUp.delete(k); raw.delete(k); if (keys.delete(k)) logNote('離すが来ないので離したことにする', k); }
    if (keys.has(lastDown)) {
      const t = keys.get(lastDown), stale = suspectT > t ? now - suspectT > 600 : now - t > 1500;
      if (stale) for (const k of DIRS) if (keys.delete(k)) logNote('見切り（最後のキー）', k);
    }
    const t = (a, b) => Math.max(keys.get(a) || 0, keys.get(b) || 0);
    const L = t('ArrowLeft', 'KeyA'), R = t('ArrowRight', 'KeyD'), U = t('ArrowUp', 'KeyW'), D = t('ArrowDown', 'KeyS');
    if (L || R) mx = R > L ? 1 : -1;
    if (U || D) my = D > U ? 1 : -1;
    mx += stick.x; my += stick.y;
    const d = dodgePress; dodgePress = false;
    return { mx, my, dodge: d };
  }
  const bPause = document.getElementById('bPause'), bFull = document.getElementById('bFull');
  const DESK = !matchMedia('(pointer: coarse)').matches;
  const FULL_OK = DESK && !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  if (DESK) {
    document.body.classList.add('desk');
    const hb = document.querySelector('.head-btns'), hudEl = document.getElementById('hud');
    hb.classList.add('hud-btns'); hudEl.insertBefore(hb, hudEl.querySelector('.hud-bars'));
    document.getElementById('bTitle').hidden = true;
  } else {
    const hb = document.querySelector('.head-btns');
    hb.classList.add('pad-btns'); document.querySelector('.pad-r').prepend(hb);
    document.getElementById('bTitle').hidden = true;
  }
  function toggleFull() {
    if (!FULL_OK) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => { info = { txt: '全画面にできませんでした（ブラウザか、この画面の決まりで止められています）', life: 4 }; });
  }
  document.addEventListener('fullscreenchange', () => { syncHead(); fitStage(); placeSide(); });
  Sfx.musicOn = ui.music !== false;
  const soundBtns = () => `<div class="row center snd"><button class="btn small" data-act="music" type="button"></button><button class="btn small" data-act="sound" type="button"></button>${matchMedia('(pointer: coarse)').matches ? '<button class="btn small" data-act="ctrl" type="button"></button>' : ''}</div>`;
  function syncHead() {
    if (DESK) { bPause.hidden = false; bPause.style.visibility = uiState === 'play' ? '' : 'hidden'; } else bPause.hidden = uiState !== 'play';
    bFull.hidden = !FULL_OK; bFull.textContent = document.fullscreenElement ? '全画面をやめる' : '全画面';
    const lab = (b, name, v) => { b.textContent = b.closest('.settings') ? v : `${name} ${v}`; };
    document.querySelectorAll('[data-act=full]').forEach(b => { b.textContent = document.fullscreenElement ? '全画面をやめる' : b.closest('.settings') ? '全画面にする' : '全画面'; });
    document.querySelectorAll('[data-act=sound]').forEach(b => { lab(b, '音', ui.sound ? 'あり' : 'なし'); b.setAttribute('aria-pressed', ui.sound ? 'true' : 'false'); });
    document.querySelectorAll('[data-act=ctrl]').forEach(b => { lab(b, '操作', ui.ctrl === 'dpad' ? '方向キー' : 'スティック'); });
    document.querySelectorAll('[data-act=music]').forEach(b => { lab(b, '曲', ui.music !== false ? 'あり' : 'なし'); b.setAttribute('aria-pressed', ui.music !== false ? 'true' : 'false'); b.disabled = !ui.sound; });
  }
  function toggleSound(which) {
    if (which === 'sound') { ui.sound = !ui.sound; Sfx.on = ui.sound; if (ui.sound) Sfx.play('pick'); }
    else { ui.music = !(ui.music !== false); Sfx.musicOn = ui.music; }
    store('os2_ui', ui); syncHead();
    if (onTitle()) Sfx.music('title'); else if (uiState === 'play') startMusic();
  }
  bPause.addEventListener('click', () => pause());
  bFull.addEventListener('click', () => { toggleFull(); bFull.blur(); });
  const bTitle = document.getElementById('bTitle'), askEl = document.getElementById('ask');
  bTitle.addEventListener('click', () => {
    Sfx.unlock();
    if (uiState === 'play') pause();
    else if (uiState === 'paused') act('giveup');
    else if (uiState === 'pick' || uiState === 'enemyPick') openAsk();
    else showTitle();
  });
  function openAsk() {
    askEl.innerHTML = `<div class="card"><h2>ここで終わる？</h2><p class="muted">ここまでの結果を見ます。</p>
      <div class="btns"><button class="btn primary" data-act="askNo" type="button">つづける</button><button class="btn" data-act="giveup" type="button">ここで終わる</button></div></div>`;
    askEl.hidden = false;
  }
  function closeAsk() { askEl.hidden = true; askEl.innerHTML = ''; }
  askEl.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b); });
  function startMusic() {
    if (!G.run || !G.w) return;
    const r = G.run.round, boss = G.w.bossT >= 0 || G.w.boss;
    if (boss && G.isMephyRound(r)) { Sfx.music('mephy'); return; }
    if (G.run.endless && r > G.run.rounds && !boss) { Sfx.music('endless'); return; }
    Sfx.music(boss ? 'boss' : 'normal', r >= 6 ? 3 : r >= 4 ? 2 : 1);
  }
  let lastLeft = 99, heartT = 0;
  function setState(s) { clearPadActs(); uiState = s; document.body.classList.toggle('in-ending', s === 'ending' || s === 'mephyTalk'); syncHead(); if (onTitle()) Sfx.music('title'); Sfx.duck(s === 'paused');   keys.clear(); dodgePress = false;   document.body.classList.toggle('inrun', !onTitle()); document.getElementById('hud').classList.toggle('off', onTitle()); document.getElementById('owned').classList.toggle('off', onTitle()); fitStage(); }
  let G = OS.createGame(cfg, { emit: onEvent }), uiState = 'title', bot = null, autoT = 0;
  let devInvOn = DEV_OK && !!load('os2_dev_inv', false);
  const maxTier = () => Math.min(rec.tierCleared + 1, OS.TIERS.length);
  const curTier = () => Math.max(0, Math.min(ui.tier || 0, maxTier()));
  let gcRuns = 0;
  function gcEvent(path, title) {
    if (bot || DEV_OK) return;
    try { if (localStorage.getItem('skipgc') === 't') return; } catch (e) {}
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title, event: true }); } catch (e) {}
  }
  function newRun() {
    endDemo = null;
    cfg = OS.applyTier(OS.loadConfig(load(CFG_KEY, null)), curTier());
    cfg.locked = OS.lockedUpgrades(rec);
    cfg.unfound = OS.COMBOS.filter(c => !rec.combos.includes(c.id)).map(c => c.id);
    G = OS.createGame(cfg, { emit: onEvent }); G.devInv = devInvOn;
    bot = ui.auto !== 'off' ? OS.makeBot(ui.auto) : null;
    fx = []; trail = []; banner = null; toast = null; hint = null; hurtFlash = 0; achQueue = [];
    rec.runs++; runAch = []; milestoneNow = null; store('os2_rec', rec); Sfx.musicRewind(); checkAch('start');
    G.newRun(); setState('play'); hideOv(); updOwned();
    gcRuns++; gcEvent(gcRuns === 1 ? 'damatsuyo-start' : 'damatsuyo-retry', gcRuns === 1 ? 'ダマツヨ：遊び始めた' : 'ダマツヨ：もう一回遊んだ');
  }
  function pause() {
    if (uiState !== 'play' || !G.w || G.w.over) return;
    const held = [...keys.keys()].filter(k => k !== 'KeyP' && k !== 'Escape'), now = performance.now();
    const fmt = k => `${((now - k.t) / 1000).toFixed(2)}秒前　${k.type}　${k.code || (k.note ? '' : '（なし）')}${k.note ? '' : `　${k.key || ''}${k.rep ? (k.n > 1 ? `　くり返し×${k.n}` : '　くり返し') : ''}　kc${k.kc}`}　[${k.st}]`;
    keyText = `キーの記録　${new Date().toLocaleString()}\n${navigator.userAgent}\n止めたときに押していると見ていたキー：${held.join('・') || 'なし'}\n` + keyLog.map(fmt).join('\n');
    const log = keyLog.map(k => `<li${k.note ? ' class="note"' : ''}>${esc(fmt(k))}</li>`).join('');
    setState('paused'); keys.clear(); dodgePress = false; stickReset();
    showOv(`<p class="eyebrow">フェーズ ${G.run.round} / ${G.run.endless && G.run.round > G.run.rounds ? '∞' : G.run.rounds}</p>
      <h2>一時停止</h2>
      <p class="muted">止めといてあげた。……早く戻ってきなさいよね。</p>
      <div class="btns"><button class="btn primary" data-act="resume" type="button">つづける</button><button class="btn" data-act="giveup" type="button">ここで終わる</button></div>
      ${soundBtns()}
      ${DEV_OK ? `<details class="keylog"><summary>キーの記録（押しっぱなしの不具合を調べる用）</summary><p>止めたときに押していると見ていたキー：${held.length ? esc(held.join('・')) : 'なし'}</p><ol>${log}</ol><button class="btn small" data-act="copyKeys" type="button">記録をコピー</button></details>` : ''}`); syncHead();
  }
  function resume() {
    if (uiState !== 'paused') return;
    setState('play'); hideOv(); keys.clear(); last = performance.now(); startMusic();
    try { window.focus(); } catch (e) {}
  }
  const wrapEl = document.querySelector('.wrap'), stageEl = document.querySelector('.stage');
  let padStickH = 0;
  function fitStage() {
    if (!wrapEl || !stageEl) return;
    const padEl = document.getElementById('pad');
    if (padEl && getComputedStyle(padEl).display !== 'none') { if (!padEl.classList.contains('acts-on') || !padStickH) padStickH = padEl.offsetHeight; } else padStickH = 0;
    document.documentElement.style.setProperty('--padh', padStickH + 'px');
    const cs = getComputedStyle(wrapEl), gap = parseFloat(cs.rowGap) || 0;
    const parts = ['header', '#hud', '#hMsg', '#owned', '#pad'].map(q => wrapEl.querySelector(q)).filter(el => el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).position !== 'fixed');
    const used = parts.reduce((s, el) => s + el.offsetHeight, 0) + gap * parts.length + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 4;
    const side = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    wrapEl.style.maxWidth = Math.round(Math.max(260, Math.min(1000, window.innerHeight - used)) + side) + 'px';
    stageEl.style.setProperty('--ui', Math.max(1, Math.min(1.25, stageEl.clientWidth / 680)).toFixed(3));
    if (G && G.run) updOwned();
  }
  addEventListener('resize', fitStage);
  function showOv(html, focus, cls) { ov.classList.toggle('title-ov', cls === 'title-card'); ov.innerHTML = `<div class="card ${cls || ''}">${html}</div>`; ov.hidden = false; ov.scrollTop = 0; const fe = document.activeElement; if (fe && fe !== document.body) try { fe.blur(); } catch (e) {} }
  function hideOv() { ov.hidden = true; ov.innerHTML = ''; }
  const hearts = (h, m) => `<span class="hearts" aria-label="体力 ${h} / ${m}">${'♥'.repeat(Math.max(0, h))}<i>${'♥'.repeat(Math.max(0, m - h))}</i></span>`;
  const faceSrc = mood => OS.ART.src('rival_' + mood);
  function rivalFace(id, mood, quiet) {
    const el = document.getElementById(id); if (!el) return;
    if (el.tagName === 'IMG') {
      if (el.dataset.mood !== mood || !el.getAttribute('src')) { el.dataset.mood = mood; el.src = faceSrc(mood); el.classList.remove('pop'); if (!quiet) { void el.offsetWidth; el.classList.add('pop'); } }
      return;
    }
    const c = el.getContext('2d'), sc = el.width / 60;
    c.setTransform(sc, 0, 0, sc, 0, 0); c.clearRect(0, 0, 60, 60);
    OS.drawRival(c, mood);
  }
  function sayHtml(text) {
    const s = esc(text || ''), cut = [];
    for (let i = 0; i < s.length - 1; i++) if (s[i] === '。' && !'」』）'.includes(s[i + 1])) cut.push(i + 1);
    if (!cut.length) return s;
    const at = cut.length === 1 ? cut[0] : cut.reduce((b, c) => Math.abs(c - s.length / 2) < Math.abs(b - s.length / 2) ? c : b);
    return s.slice(0, at) + '<br class="sb">' + s.slice(at);
  }
  const rivalBox = (mood, line, id) => `<div class="rival"><img class="rv pop" id="${id || 'rv'}" data-mood="${mood}" src="${faceSrc(mood)}" alt="${OS.RIVAL_NAME}"><div class="bubble" id="bub">${sayHtml(line)}</div></div>`;
  function paintFaces() { ov.querySelectorAll('canvas[data-mood]').forEach(el => rivalFace(el.id, el.dataset.mood)); }
  const adjNames = () => Object.keys(cfg.adj).filter(k => cfg.adj[k]).join('・') || 'なし';
  const onTitle = () => uiState === 'title' || uiState === 'zukan' || uiState === 'howto' || uiState === 'ach' || uiState === 'settings' || uiState === 'endDemo';
  function showTitle() {
    setState('title'); updOwned();
    showOv(`<div class="title-top"><img class="logo" src="${OS.ART.src('logo')}" alt="ツンデレ小悪魔メフィーの黙って強くなりなさいよっ！" onerror="this.outerHTML='<h2 class=title>ツンデレ小悪魔メフィーの黙って強くなりなさいよっ！</h2>'"></div>
      <div class="title-bottom">
      ${rivalBox('smug', rec.runs ? G.line(OS.LINES.title) : OS.LINES.title[0].replace('{rival}', OS.RIVAL_NAME))}
      <div class="acts title-acts"><div class="btns one"><button class="btn primary" data-act="start" type="button">はじめる</button></div>
      <div class="row center"><button class="btn small" data-act="howto" type="button">遊び方</button><button class="btn small" data-act="zukan" type="button">図鑑</button><button class="btn small" data-act="ach" type="button">実績</button><button class="btn small" data-act="settings" type="button">設定</button></div>
      <div id="tierBox">${tierPicker()}</div></div>
      <div class="recline">${rec.bestRound ? `<span>最高 <b>${rec.bestRound >= cfg.rounds ? '合格' : `フェーズ${rec.bestRound}`}</b></span>` : ''}${rec.wins ? `<span>合格 <b>${rec.wins}</b>回</span>` : ''}${rec.tierCleared >= 0 ? `<span>本気度 <b>${rec.tierCleared}</b> まで合格</span>` : ''}${rec.endlessBest.round ? `<span>エンドレス <b>フェーズ${rec.endlessBest.round}</b></span>` : ''}<span>図鑑 <b>${rec.combos.length + OS.ZUKAN_ENEMIES.filter(zukanKnown).length} / ${OS.COMBOS.length + OS.ZUKAN_ENEMIES.length}</b></span></div>
      <p class="credit">${OS.CREDITS.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</p>
      </div>`, null, 'title-card');
    paintFaces();
    movePadActs('.title-acts');
  }
  function tierPicker() {
    const t = curTier(), mx = maxTier();
    if (mx === 0) return '';
    const all = OS.TIERS.slice(0, t).map((x, i) => `${i + 1}. ${x.label}`).join(' ／ ');
    const rules = t ? `<li title="${all}"><b>${t}</b>${OS.TIERS[t - 1].label}${t > 1 ? `<small>＋本気度${t - 1}までのルール</small>` : ''}</li>` : '<li class="muted">いつものルール</li>';
    return `<div class="tier"><button class="btn small" data-act="tierDown" type="button" aria-label="本気度を下げる"${t <= 0 ? ' disabled' : ''}>◀</button>
      <span class="tier-name">本気度 <b>${t}</b><small> / ${OS.TIERS.length}</small></span>
      <button class="btn small" data-act="tierUp" type="button" aria-label="本気度を上げる"${t >= mx ? ' disabled' : ''}>▶</button></div>
      <ul class="tier-rules">${rules}</ul>`;
  }
  function showHowto() {
    setState('howto');
    showOv(`<h2>遊び方</h2>
      ${rivalBox('smug', 'しかたないから教えてあげる。一回しか言わないわよ。', 'rvHow')}
      <ul class="rules"><li>攻撃は勝手にやってあげる。あんたは<b>動いて、よける</b>だけでいいの。</li><li>フェーズが終わるたびに、あたしが強化を<b>押し付けて</b>あげる。どれも強いわよ。……ちょっと癖があるけど。</li><li>気に入らなかったら<b>突き返し</b>てもいいわ。はじめは1回だけ。敵を倒すと貯まるけど、突き返すたびに敵を速くしてやるんだから。</li><li>組み合わせによっては<b>うっかりコンボ</b>が起きちゃうの。べ、別にわざとじゃないんだからねっ。</li>
      ${cfg.adj[1] ? '<li>そのあと敵も強くしとくから。どれがましか、あんたが選びなさい。</li>' : ''}${cfg.adj[3] ? '<li>5フェーズ目と10フェーズ目には、<b>強敵</b>が出るわ。倒せばそのフェーズはすぐ終わるし、体力と突き返しが1つずつ戻るわよ。</li>' : ''}<li>合格したら、あたしの<b>本気度</b>を上げてあげる。本気度4からは、強敵が毎回変わるわよ。</li><li>合格したら<b>エンドレス</b>で続けてもいいわよ。${cfg.adj[3] ? '5フェーズごとに強敵が出るわ。時間内に倒せなかったら、延長戦にするか選ばせてあげる。' : ''}強化を全部あげちゃったら、あとはおまけね。</li><li>エンドレスでは、突き返しは強敵を倒したときだけ増えるわ。おまけになったら、敵の強化のほうを突き返してもいいわよ。……しかたないから。</li></ul>
      <p class="eyebrow">操作</p>
      <ul class="rules keys"><li><b>移動</b>　WASD／矢印（スマホは左のスティック。「設定」で方向キーにもできる）</li><li><b>回避</b>　Space／左クリック（Shift・K・X でもよい。スマホは「回避」）。キーボードによっては同時に押せるキーが2つまでなので、斜めに動きながら回避するなら左クリックがおすすめ</li><li><b>選ぶ</b>　受け取るは Enter、敵の強化は 1〜3（クリックでも選べる）</li><li><b>一時停止</b>　Esc・P／上の帯の「一時停止」（スマホは「回避」の上の「一時停止」）</li></ul>
      <div class="btns one stick-bottom"><button class="btn primary" data-act="title" type="button">もどる</button></div>`); syncHead();
    movePadActs('.stick-bottom');
  }
  function showSettings() {
    setState('settings');
    const row = (lab, btn) => `<li><span>${lab}</span>${btn}</li>`;
    showOv(`<h2>設定</h2>
      <ul class="settings">${row('音', '<button class="btn small" data-act="sound" type="button"></button>')}${row('曲<small>音が「なし」だと鳴らない</small>', '<button class="btn small" data-act="music" type="button"></button>')}${touch ? row('操作', '<button class="btn small" data-act="ctrl" type="button"></button>') : ''}${FULL_OK ? row('画面', '<button class="btn small" data-act="full" type="button"></button>') : ''}</ul>
      <div class="btns one stick-bottom"><button class="btn primary" data-act="title" type="button">もどる</button></div>`); syncHead();
    movePadActs('.stick-bottom');
  }
  function showAch() {
    setState('ach');
    const cats = [...new Set(OS.ACHIEVEMENTS.map(a => a.cat))];
    const list = cats.map(cat => `<p class="eyebrow">${cat}</p><ul class="achs">${OS.ACHIEVEMENTS.filter(a => a.cat === cat).map(a => { const got = rec.ach.includes(a.id); return `<li class="${got ? 'got' : ''}"><span class="am">${got ? '★' : '☆'}</span><div><b>${got || !a.secret ? a.name : '？？？'}</b><span class="muted">${got || !a.secret ? a.desc : '？？？'}</span></div></li>`; }).join('')}</ul>`).join('');
    showOv(`<p class="eyebrow">実績　${OS.ACHIEVEMENTS.filter(a => rec.ach.includes(a.id)).length} / ${OS.ACHIEVEMENTS.length}</p>
      <h2>あんたの記録</h2>
      ${list}
      <div class="btns one stick-bottom"><button class="btn primary" data-act="title" type="button">もどる</button></div>`);
    movePadActs('.stick-bottom');
  }
  const zukanTabs = on => `<div class="ztabs"><button class="chip${on === 'combo' ? ' on' : ''}" type="button" data-act="zukan">コンボ</button><button class="chip${on === 'enemy' ? ' on' : ''}" type="button" data-act="zukanEnemy">敵</button></div>`;
  const zukanKnown = z => z.k ? (rec.enemyKills[z.k] || 0) > 0 : rec.met.includes(z.boss);
  function showZukanEnemy() {
    setState('zukan');
    const known = zukanKnown;
    const n = OS.ZUKAN_ENEMIES.filter(known).length;
    const rows = OS.ZUKAN_ENEMIES.map(z => {
      const name = z.k ? OS.ENEMIES[z.k].name : OS.BOSS_NAMES[z.boss], kills = z.k ? rec.enemyKills[z.k] || 0 : rec.bossBy[z.boss] || 0;
      const tag = z.k ? '' : z.boss === 'mephy' ? (known(z) ? '<small class="ztag">メフィー</small>' : '') : '<small class="ztag">強敵</small>';
      const extra = z.boss === 'mephy' && rec.mephy6 ? `　本気 ${rec.mephy6}` : '';
      return known(z)
        ? `<li class="got"><div class="zc-ico zc-img${z.k === 'mini' ? ' small' : ''}"><img src="art/sprites/${z.art}.png" alt=""></div><div><b>${name}${tag}</b><span class="muted">倒した ${kills}${extra}</span><span>${z.desc}</span></div></li>`
        : `<li>${z.boss === 'mephy' ? '<div class="zc-ico zc-img unknown q">？</div>' : `<div class="zc-ico zc-img unknown"><img src="art/sprites/${z.art}.png" alt=""></div>`}<div><b>？？？${tag}</b><span class="muted">まだ会っていない</span></div></li>`;
    }).join('');
    showOv(`<p class="eyebrow">敵の図鑑　${n} / ${OS.ZUKAN_ENEMIES.length}</p>
      <h2>メフィーの召使いたち</h2>
      ${zukanTabs('enemy')}
      <ul class="zukan">${rows}</ul>
      <div class="btns one stick-bottom"><button class="btn primary" data-act="title" type="button">もどる</button></div>`);
    movePadActs('.stick-bottom');
  }
  function showZukan() {
    setState('zukan');
    const rows = OS.COMBOS.map(c => {
      const got = rec.combos.includes(c.id);
      return got
        ? `<li class="got"><div class="zc-ico">${ico(c.a)}${ico(c.b)}</div><div><b>${c.name}</b><span class="muted">${OS.UPGRADES[c.a].name} × ${OS.UPGRADES[c.b].name}</span><span>${c.desc}</span></div></li>`
        : `<li><div class="zc-ico unknown">？</div><div><b>？？？</b><span class="muted">？ × ？</span><span class="muted">まだ見つけていない</span></div></li>`;
    }).join('');
    const locked = OS.lockedUpgrades(rec);
    const seen = Object.keys(OS.UPGRADES).filter(k => !locked.includes(k)).map(k => rec.seen.includes(k) ? `<button class="chip" type="button" data-act="upInfo" data-k="${k}">${ico(k)}${OS.UPGRADES[k].name}</button>` : `<span class="chip dim">${ico(k)}？</span>`).join('');
    const lockList = OS.UNLOCKS.filter(u => !u.ok(rec)).map(u => `<li><span class="chip dim">？ ×${u.keys.length}</span>${u.label}と、押し付けの候補に入る。</li>`).join('');
    showOv(`<p class="eyebrow">コンボ図鑑　${rec.combos.length} / ${OS.COMBOS.length}</p>
      <h2>メフィーのうっかり記録</h2>
      ${zukanTabs('combo')}
      <ul class="zukan">${rows}</ul>
      <p class="eyebrow">出会った強化</p>
      <div class="chips">${seen}</div>
      <p class="upinfo muted" id="upInfo">${rec.seen.length ? '強化を押すと、説明が出る。' : ''}</p>
      ${lockList ? `<ul class="locks">${lockList}</ul>` : ''}
      <div class="btns one stick-bottom"><button class="btn primary" data-act="title" type="button">もどる</button></div>`);
    movePadActs('.stick-bottom');
  }
  ov.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b); else if ((uiState === 'ending' || uiState === 'mephyTalk') && (endTalk || endWait)) endingNext(); });
  function act(a, b) {
    Sfx.unlock();
    if (a === 'start' || a === 'retry') { Sfx.play('pick'); newRun(); }
    else if (a === 'title') showTitle();
    else if (a === 'zukan') showZukan();
    else if (a === 'zukanEnemy') showZukanEnemy();
    else if (a === 'endSkip') endingSkip();
    else if (a === 'preSkip') talkSkip();
    else if ((a === 'endContinue' || a === 'endResult') && endDemo) { endingLeave(); showTitle(); }
    else if (a === 'endContinue') { endingLeave(); Sfx.music('endless'); showPick(); }
    else if (a === 'endResult') { endingLeave(); const run = G.run; run.diedTo = 'メフィーに勝った'; G.phase = 'lose'; showEnd(false); }
    else if (a === 'ach') showAch();
    else if (a === 'howto') showHowto();
    else if (a === 'settings') showSettings();
    else if (a === 'enemyVeto') vetoEnemy();
    else if (a === 'otYes' || a === 'otNo') overtimeAnswer(a === 'otYes');
    else if (a === 'endDemo') { closeAsk(); showEndDemo(); }
    else if (a === 'endDemoPlay') playEndDemo(+b.dataset.i);
    else if (a === 'copyKeys') { const done = ok => { b.textContent = ok ? 'コピーしました' : 'コピーできませんでした'; }; try { navigator.clipboard.writeText(keyText).then(() => done(true), () => done(false)); } catch (e) { done(false); } }
    else if (a === 'full') toggleFull();
    else if (a === 'upInfo') { const U = OS.UPGRADES[b.dataset.k], el = document.getElementById('upInfo'); ov.querySelectorAll('.chip.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); el.classList.remove('muted'); el.innerHTML = `<b>${ico(b.dataset.k)}${U.name}</b><span class="plus">＋ ${U.plus}</span><span class="minus">－ ${U.minus}</span>`; Sfx.play('tick'); }
    else if (a === 'sound' || a === 'music') toggleSound(a);
    else if (a === 'ctrl') { ui.ctrl = ui.ctrl === 'dpad' ? 'stick' : 'dpad'; store('os2_ui', ui); syncCtrl(); syncHead(); Sfx.play('tick'); }
    else if (a === 'askNo') closeAsk();
    else if (a === 'devEnding' || a === 'devMephy') { closeAsk(); $(a === 'devEnding' ? 'dEnding' : 'dMephy').click(); }
    else if (a === 'devPanel') { closeAsk(); openDev(); }
    else if (a === 'devFrom') { closeAsk(); devFfwd(+b.dataset.n); }
    else if (a === 'devInv') { setDevInv(!devInvOn); b.textContent = `無敵：${devInvOn ? 'オン' : 'オフ'}`; }
    else if (a === 'devFfwdPick') { setFfwdPick(ffwdPick === 'easy' ? 'random' : 'easy'); b.textContent = `早送りの敵の強化：${ffwdPickName()}`; }
    else if (a === 'resume') resume();
    else if (a === 'giveup') {
      closeAsk();
      const run = G.run;
      if (run && G.phase !== 'idle' && G.phase !== 'lose' && G.phase !== 'win') { run.gaveUp = true; run.diedTo = '途中で終わりにした'; G.phase = 'lose'; showEnd(false); }
      else { G.phase = 'idle'; showTitle(); updOwned(); }
    }
    else if (a === 'accept') acceptPick();
    else if (a === 'veto') vetoPick();
    else if (a === 'enemy') chooseEnemy(+b.dataset.i);
    else if (a === 'share') showShare();
    else if (a === 'tierUp' || a === 'tierDown') { ui.tier = Math.max(0, Math.min(maxTier(), curTier() + (a === 'tierUp' ? 1 : -1))); store('os2_ui', ui); Sfx.play('tick'); const tb = document.getElementById('tierBox'); if (tb) tb.innerHTML = tierPicker(); else showTitle(); }
    else if (a === 'endless') { if (G.continueEndless()) { runAch = [];   Sfx.play('pick'); Sfx.music('endless'); showPick(); } }
    else if (a === 'xpost') xPost();
    else if (a === 'backResult') renderResult(G.phase === 'win');
  }
  let pick = null, rouletteTimer = null;
  function knownCombos(k) {
    return OS.COMBOS.filter(c => rec.combos.includes(c.id) && !G.run.combos.includes(c.id) && ((c.a === k && G.run.ups.includes(c.b)) || (c.b === k && G.run.ups.includes(c.a))));
  }
  function pickCard(k, i) {
    const U = upOf(k), kcs = U.extra ? [] : knownCombos(k);
    return `<div class="pick flip" style="--d:${i * 130}ms" data-k="${k}"><img class="cbg" src="${OS.ART.src('gift')}" alt=""><span class="num">${i + 1}</span><span class="pname">${ico(k)}<b>${U.name}</b></span><span class="plus">＋ ${U.plus}</span>${U.minus ? `<span class="minus">− ${U.minus}</span>` : '<span class="kc">おまけ</span>'}${kcs.map(c => `<span class="kc">★ ${c.name}</span>`).join('')}<span class="aim"></span></div>`;
  }
  function milestoneHtml() {
    const m = milestoneNow; if (!m) return '';
    const got = [m.up ? '足の速さ・連射アップ' : '', m.heal ? `体力+${m.heal}` : ''].filter(Boolean).join('・');
    return `<p class="unlock milestone">フェーズ${m.round} 突破！${got ? `　ごほうび：${got}` : ''}</p>`;
  }
  function showPick() {
    setState('pick');
    pick = G.preparePick();
    updLog();
    checkAch('round');
    if (!pick.choice) { G.accept(); showEnemyPick([]); return; }
    const run = G.run, h = pick.hab;
    for (const k of pick.cands) if (OS.UPGRADES[k] && !rec.seen.includes(k)) rec.seen.push(k);
    store('os2_rec', rec);
    const reads = h.list.length ? h.list.map(x => `<span class="read">${OS.HABITS[x].label}</span>`).join('') : '<span class="read none">特になし</span>';
    showOv(`<p class="eyebrow">フェーズ ${run.round} 終了　${hearts(run.hp, run.maxHp)}</p>
      ${milestoneHtml()}
      ${rivalBox(milestoneNow ? 'happy' : 'think', milestoneNow ? milestoneNow.line : G.line(OS.LINES.thinking))}
      ${pick.extra ? '' : `<p class="reads">読まれた癖　${reads}</p>`}
      <div class="acts"><div class="picks" id="pk">${pick.cands.map(pickCard).join('')}</div>
      <div class="btns" id="pb" hidden><button class="btn primary" data-act="accept" type="button">受け取る</button><button class="btn veto" data-act="veto" type="button">突き返す<small>残り${run.veto}</small></button></div></div>`, '#none');
    milestoneNow = null;
    paintFaces();
    const dealMs = matchMedia('(prefers-reduced-motion: reduce)').matches || bot ? 0 : pick.cands.length * 130 + 380;
    if (dealMs) Sfx.play('deal');
    setTimeout(() => { if (uiState === 'pick') roulette(pick.choice, revealPick); }, dealMs);
  }
  function roulette(target, done) {
    const pk = document.getElementById('pk'); if (!pk) return;
    const cards = [...pk.querySelectorAll('.pick')], ti = cards.findIndex(el => el.dataset.k === target);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || bot;
    const steps = reduce ? 1 : 8;
    let n = 0, idx = 0;
    clearTimeout(rouletteTimer);
    (function hop() {
      if (uiState !== 'pick') return;
      cards.forEach((el, j) => el.classList.toggle('hover', j === idx));
      if (n >= steps - 1 && idx === ti) { cards.forEach(el => el.classList.remove('hover')); done(); return; }
      Sfx.play('tick');
      n++; idx = (idx + 1) % cards.length;
      const delay = reduce ? 60 : 55 + Math.pow(n / steps, 2) * 190;
      rouletteTimer = setTimeout(hop, delay);
    })();
  }
  function markChosen() {
    const pk = document.getElementById('pk'); if (!pk) return;
    pk.querySelectorAll('.pick').forEach(el => {
      const on = el.dataset.k === pick.choice; el.classList.toggle('chosen', on);
      const aim = el.querySelector('.aim'); aim.textContent = on && pick.why ? `狙い：${OS.HABITS[pick.why].label}` : '';
    });
  }
  function openGift(ch) {
    if (!ch) return;
    ch.classList.add('opened'); const bg = ch.querySelector('.cbg'); if (bg) bg.src = OS.ART.src('gift_open');
    const g = document.createElement('img'); g.className = 'giftpop'; g.src = OS.ART.src('gift_open'); g.alt = ''; ch.appendChild(g); setTimeout(() => g.remove(), 800);
  }
  function closeGift(ch) {
    if (!ch) return;
    ch.classList.remove('opened'); const bg = ch.querySelector('.cbg'); if (bg) bg.src = OS.ART.src('gift');
  }
  function revealPick() {
    if (uiState !== 'pick') return;
    const pk = document.getElementById('pk'); if (!pk) return;
    pk.classList.add('decided'); markChosen(); Sfx.play('reveal');
    openGift(pk.querySelector('.pick.chosen'));
    document.getElementById('bub').innerHTML = sayHtml(pick.line); rivalFace('rv', 'smug'); updLog();
    const pb = document.getElementById('pb'); pb.hidden = false;
    if (G.run.veto <= 0 || pick.cands.length < 2 || pick.extra) { pb.classList.add('one'); const v = pb.querySelector('.veto'); if (v) v.remove(); }
    movePadActs('#pb');
    ov.scrollTop = ov.scrollHeight;
    if (bot) autoT = 0.9;
  }
  function vetoPick() {
    if (uiState !== 'pick' || !G.veto()) return;
    Sfx.play('veto');
    const pk0 = document.getElementById('pk');
    if (pk0) pk0.querySelectorAll('.pick.opened').forEach(closeGift);
    markChosen();
    if (pk0) openGift(pk0.querySelector('.pick.chosen'));
    document.getElementById('bub').innerHTML = sayHtml(pick.line);
    rivalFace('rv', 'angry'); setTimeout(() => { if (uiState === 'pick') rivalFace('rv', 'smug'); }, 900);
    const pb = document.getElementById('pb'); pb.classList.add('one'); const v = pb.querySelector('.veto'); if (v) v.remove();
    const pk = document.getElementById('pk'); if (pk) { pk.classList.remove('shake'); void pk.offsetWidth; pk.classList.add('shake'); }
  }
  function acceptPick() {
    if (uiState !== 'pick') return;
    clearTimeout(rouletteTimer);
    const newC = G.accept();
    if (newC.length) { newC.forEach(c => { if (!rec.combos.includes(c.id)) rec.combos.push(c.id); }); store('os2_rec', rec); Sfx.play('combo'); }
    else Sfx.play('pick');
    updOwned(); showEnemyPick(newC); checkAch('accept');
  }
  function showEnemyPick(newC) {
    setState('enemyPick');
    const opts = G.prepareEnemyPick();
    const cb = newC.map(c => `<div class="combo"><img class="cut-rival" src="${faceSrc('shock')}" alt=""><span class="combo-kicker">メフィーのうっかり！</span><b>${c.name}</b><span class="combo-pair">${ico(c.a)} ${OS.UPGRADES[c.a].name} × ${ico(c.b)} ${OS.UPGRADES[c.b].name}</span><span>${c.desc}</span></div>`).join('');
    const buff = !!cfg.adj[1];
    const vetoBtn = G.run.extraPhase && G.run.veto > 0 && buff ? `<div class="btns one"><button class="btn veto" data-act="enemyVeto" type="button">突き返す（敵を強くしない）<small>残り${G.run.veto}</small></button></div>` : '';
    const ms = milestoneHtml(); milestoneNow = null;
    showOv(`${cb}${ms}
      ${buff ? `<p class="eyebrow">次のフェーズ（${G.run.round + 1}）に向けて、敵の強化を選ぶ</p>` : ''}
      ${rivalBox(newC.length ? 'shock' : 'smug', newC.length ? G.line(OS.LINES.combo) : G.enemyLine)}
      <div class="acts"><div class="picks">${opts.map((d, i) => `<button class="pick deal ${d.id === 'heal' ? 'heal' : buff ? 'bad' : ''}" style="--d:${i * 90}ms" type="button" data-act="enemy" data-i="${i}"><span class="num">${i + 1}</span><b>${d.name}</b><span class="${buff && d.id !== 'heal' ? 'minus' : 'plus'}">${d.desc}</span></button>`).join('')}</div>${vetoBtn}</div>`, '.pick', newC.length ? 'has-combo' : '');
    paintFaces();
    const fe = document.activeElement; if (fe && ov.contains(fe)) fe.blur();
    if (newC.length) { shakeT = 0.3; burst(240, 200, '#f2c14e', 30, 300); }
    if (bot) autoT = 0.8;
  }
  function showOvertimeAsk() {
    const b = G.w.boss, left = b ? Math.max(1, Math.round(b.hp / b.max * 100)) : 0, sec = G.cfg.endless.overtime;
    setState('overtime'); keys.clear();
    showOv(`<p class="eyebrow">時間切れ　強敵の体力は、まだ ${left}%</p><h2>延長戦にする？</h2>
      ${rivalBox('smug', 'まだ追いかけるつもり？　……いいわよ、付き合ってあげる。')}
      <p class="muted">延長すると、あと${sec}秒。そのあいだも敵は出てくるわ。<br>倒せたら、体力と突き返しを1つずつ返してあげる。</p>
      <div class="acts"><div class="btns"><button class="btn primary" data-act="otYes" type="button">延長する（${sec}秒）${touch ? '' : '<small>1</small>'}</button><button class="btn" data-act="otNo" type="button">帰らせる${touch ? '' : '<small>2</small>'}</button></div></div>`);
    paintFaces(); movePadActs('.acts');
  }
  function overtimeAnswer(yes) {
    if (uiState !== 'overtime') return;
    G.overtime(yes); Sfx.play('pick');
    setState('play'); hideOv(); trail = [];
    if (yes) setBanner(`延長戦！　あと${G.cfg.endless.overtime}秒`, 1.2, '#f2c14e', 24);
  }
  function vetoEnemy() {
    if (uiState !== 'enemyPick' || !G.vetoEnemy()) return;
    Sfx.play('veto');
    setState('play'); hideOv(); updOwned(); trail = [];
    rivalSay('angry', ['ちぇっ。……今回だけは、見逃してあげる。', 'なによ、あたしの召使いを強くさせないつもり？'], true);
  }
  function chooseEnemy(i) {
    if (uiState !== 'enemyPick') return;
    const extra = G.chooseEnemy(i);
    if (G.phase !== 'play') return;
    Sfx.play('pick');
    setState('play'); hideOv(); updOwned(); trail = [];
    if (extra) toast = { txt: `おまかせで「${extra.name}」が入った`, life: 2.6 };
  }
  let lastWord = '';
  function endWhere(win) {
    const run = G.run, r = run.round;
    if (run.endless) return run.diedTo === 'メフィーに勝った' ? `エンドレス フェーズ ${r} 突破` : run.gaveUp ? `エンドレス フェーズ ${r} まで` : `エンドレス フェーズ ${r} で倒れた`;
    return win ? `${run.rounds}フェーズ 合格` : run.gaveUp ? `フェーズ ${r} まで` : `フェーズ ${r} で倒れた`;
  }
  const endBang = win => (win && !G.run.endless) || G.run.diedTo === 'メフィーに勝った' ? '！' : '';
  function outcome(win) {
    const run = G.run, t = G.cfg.tier || 0, tierTxt = t ? `本気度${t}　` : '';
    if (run.endless) {
      const lostMephy = G.isMephyRound(run.round) && run.mephyDownRound !== run.round && !run.gaveUp;
      const fellAfter = run.mephyDown && !run.gaveUp && run.diedTo !== 'メフィーに勝った' && run.round !== run.mephyDownRound;
      const h2 = lostMephy ? 'メフィーに負けた' : fellAfter ? 'メフィーに勝ったあと、力尽きた' : run.mephyDown ? 'メフィーに勝った！' : run.gaveUp ? 'エンドレス ここまで' : 'エンドレスで力尽きた';
      return { cls: 'win', eyebrow: tierTxt + endWhere(win), h2, short: tierTxt + endWhere(win) + endBang(win) };
    }
    if (win) return { cls: 'win', eyebrow: tierTxt + endWhere(win), h2: 'ちょっとは強くなったじゃない', short: tierTxt + endWhere(win) + endBang(win) };
    if (run.gaveUp) return { cls: 'lose', eyebrow: tierTxt + endWhere(win), h2: 'ここでおしまい', short: tierTxt + endWhere(win) };
    return { cls: 'lose', eyebrow: tierTxt + endWhere(win), h2: 'もう一回、がんばりなさいよ', short: tierTxt + endWhere(win) };
  }
  function resultText(win) {
    const run = G.run, t = G.cfg.tier || 0;
    const where = endWhere(win) + endBang(win);
    return `『ツンデレ小悪魔メフィーの黙って強くなりなさいよっ！』\n${t ? `本気度${t}　` : ''}${where}（倒した数 ${run.kills}）\n#黙って強くなりなさいよ${OS.PUB_URL ? '\n' + OS.PUB_URL : ''}`;
  }
  const xUrl = win => 'https://x.com/intent/post?text=' + encodeURIComponent(resultText(win));
  const ENDING_LEN = 180.9;
  const ENDING_TALK = hon => [
    ...(hon ? [['shock', '……本気、だったのに。'], ['angry', 'な、なによその顔！ 今日はたまたま調子が悪かっただけなんだからっ。']]
      : [['shock', 'う、うそ……あたしが、負けた……？'], ['angry', 'ちょ、ちょっと油断しただけよ！ 手加減してたんだからっ。']]),
    ['think', '……でも。あたしが押し付けた強化、ぜんぶ使いこなしてたわね。'],
    ['think', 'うっかりも、癖も、ちゃんと自分のものにして。'],
    ['happy', '……ふ、ふん。ちょっとは強くなったじゃない。'],
    ['smug', '勘違いしないでよね。あんたが負けたら、つまんないってだけなんだから。']
  ];
  const ENDING_CAST = [
    { art: 'chase1', name: () => OS.ENEMIES.chase.name, line: '一番の下っ端。……いつも真っ先に飛び出していくのよね。' },
    { art: 'chase1', name: () => OS.ENEMIES.mini.name, line: 'プルーが分かれた子。ちっちゃいけど、根性はあるわ。', mini: true },
    { art: 'shoot1', name: () => OS.ENEMIES.shoot.name, line: '遠くから狙うのが得意。……ほんとは人見知りなだけかも。' },
    { art: 'dash1', name: () => OS.ENEMIES.dash.name, line: '光ったら止まれないの。ほんとに止まれないの。' },
    { art: 'bomber1', name: () => OS.ENEMIES.bomber.name, line: '……爆発したあと、毎回ちょっと泣いてるのよ。' },
    { art: 'guard1', name: () => OS.ENEMIES.guard.name, line: '正面からは絶対に負けない、頑固者。' },
    { art: 'boss1', name: () => OS.BOSS_NAMES[''], line: '屋敷いちばんの力持ち。重いものは、だいたいこの子が運ぶの。', boss: true },
    { art: 'summon1', name: () => OS.BOSS_NAMES.summon, line: 'プルーたちのお世話係。呼べばすぐ来てくれるわ。', boss: true },
    { art: 'rush1', name: () => OS.BOSS_NAMES.charge, line: 'まっすぐしか走れないけど、そこがいいところ。', boss: true },
    { art: 'orb1', name: () => OS.BOSS_NAMES.spiral, line: 'ずっとくるくる回ってる。……目が回らないのかしら。', boss: true },
    { art: 'mortar1', name: () => OS.BOSS_NAMES.bomb, line: 'カボチャを育てるのが趣味。……爆弾も育ててるけど。', boss: true }
  ];
  const ENDING_CREDITS = [
    ['制作', 'こめ', 'このゲームを作ったのは、こめ。……あたしを生んでくれた人よ。'],
    ['絵', 'Gemini（Nano Banana）', 'あたしの絵は Gemini。……か、かわいく描いてくれたじゃない。'],
    ['音楽', 'Suno', '曲は Suno。今流れてるこの曲も、ね。'],
    ['プログラム', 'Claude', '動かしてるのは Claude。……ちゃんと動いてるでしょ？']
  ];
  const NEXT_HINT = touch ? 'タップで次へ' : 'クリック・Space で次へ';
  let endTalk = null, endTimers = [], endWait = false;
  const endImg = n => `art/sprites/${n}.png`;
  const carryFrames = (k = 'mephy_gift') => [1, 2, 3].map(n => `<img class="f${n}" src="${endImg(k + n)}" alt="">`).join('');
  const endSay = (mood, line, cls) => `<div class="end-say ${cls || ''}"><img class="rv" src="${faceSrc(mood)}" alt="${OS.RIVAL_NAME}"><div class="bubble">${sayHtml(line)}</div></div>`;
  function endingClear() { endTimers.forEach(p => clearTimeout(p.id)); endTimers = []; rollHold(false); }
  let rollT0 = 0, rollHeldAt = 0;
  const rollNow = () => (rollHeldAt || performance.now()) - rollT0;
  function rollArm(p) { p.id = setTimeout(() => { endTimers = endTimers.filter(x => x !== p); if (uiState === 'ending') p.f(); }, Math.max(0, p.due - rollNow())); }
  function rollHold(on) {
    if (on === !!rollHeldAt || (on && (uiState !== 'ending' || !endTimers.length))) return;
    const el = ov.querySelector('.ending'), now = performance.now();
    if (on) { rollHeldAt = now; endTimers.forEach(p => clearTimeout(p.id)); }
    else { rollT0 += now - rollHeldAt; rollHeldAt = 0; endTimers.forEach(rollArm); }
    if (el) el.classList.toggle('held', on);
    Sfx.hold(on);
  }
  const MEPHY_TALK = hon => hon
    ? [['think', '……来たのね。あんたなら、来ると思ってた。'], ['shock', 'あたしが押し付けた強化、ぜんぶ自分のものにしてるじゃない。'], ['angry', 'でも、今日のあたしは手加減しないから。'], ['smug', '……ここからは本気よ。泣いても知らないんだからっ！']]
    : [['think', '……ふーん。ここまで来ちゃったんだ。'], ['smug', 'あたしの召使いたち、みんな倒してきたってわけね。'], ['angry', 'べ、別に心配なんかしてなかったんだから！ あんたが勝手に強くなっただけでしょ。'], ['smug', 'いいわ。ちょっとだけ遊んであげる。手加減してあげるんだから、感謝しなさいよね。']];
  const MEPHY_TALK_AGAIN = hon6 => [['shock', '……また来たの？'], ['smug', 'しょうがないわね。何度でも相手してあげる。'], ['angry', `でも、今度${hon6 ? 'も' : 'は'}本気よ。泣いても知らないんだからっ！`]];
  function showMephyTalk() {
    const run = G.run, hon = G.mephyHon(run.round), again = G.mephyNth(run.round) >= 2;
    run.preTalkRound = run.round;
    setState('mephyTalk'); Sfx.musicStop(); keys.clear();
    endTalk = { lines: again ? MEPHY_TALK_AGAIN((G.cfg.tier || 0) >= 6) : MEPHY_TALK(hon), i: 0, done: mephyTalkEnd };
    ov.classList.remove('title-ov'); ov.classList.add('ending-ov');
    ov.innerHTML = `<div class="ending talk pre"><img class="end-down" src="${endImg('mephy1')}" alt=""><div class="end-box"></div><p class="end-hint">${NEXT_HINT}</p><button class="btn small end-skip" type="button" data-act="preSkip">飛ばす</button></div>`;
    ov.hidden = false; endingTalkDraw();
  }
  function mephyTalkEnd() { endTalk = null; ov.classList.remove('ending-ov'); hideOv(); setState('play'); startMusic(); toast = { txt: MEPHY_NOTE, life: 3.2 }; }
  const talkSkip = () => (endTalk && endTalk.skip ? endTalk.skip : mephyTalkEnd)();
  const MEPHY_WIN_TALK = hon => hon
    ? [['smug', '本気のあたしに勝とうなんて、百年早いのよ。……でも、また来てもいいわよ。']]
    : [['smug', 'ふふん、まだまだね。……また来なさいよ。待っててあげるから。']];
  function showMephyWinTalk() {
    const hon = G.mephyHon(G.run.round);
    G.run.winTalkRound = G.run.round;
    setState('mephyTalk'); Sfx.musicStop(); keys.clear();
    endTalk = { lines: MEPHY_WIN_TALK(hon), i: 0, done: mephyWinTalkEnd, skip: mephyWinTalkEnd };
    ov.classList.remove('title-ov'); ov.classList.add('ending-ov');
    ov.innerHTML = `<div class="ending talk pre"><img class="end-down" src="${endImg('mephy1')}" alt=""><div class="end-box"></div><p class="end-hint">${NEXT_HINT}</p><button class="btn small end-skip" type="button" data-act="preSkip">飛ばす</button></div>`;
    ov.hidden = false; endingTalkDraw();
  }
  function mephyWinTalkEnd() { endTalk = null; ov.classList.remove('ending-ov'); showEnd(false); }
  function showEnding() {
    const run = G.run, hon = endDemo ? endDemo.tier >= 6 : (G.cfg.tier || 0) >= 6;
    run.endingShown = true; if (!endDemo) { rec.endingSeen = (rec.endingSeen || 0) + 1; store('os2_rec', rec); }
    setState('ending'); endingClear(); Sfx.musicStop();
    endTalk = { lines: ENDING_TALK(hon), i: 0 };
    ['mephy_gift1', 'mephy_gift2', 'mephy_gift3', 'mephy_free1', 'mephy_free2', 'mephy_free3', 'gift', 'gift_open', 'logo', ...ENDING_CAST.map(c => c.art)].forEach(n => { new Image().src = endImg(n); });
    new Image().src = 'art/bg/ending.jpg';
    ov.classList.remove('title-ov'); ov.classList.add('ending-ov');
    ov.innerHTML = `<div class="ending talk${rec.endingSeen > 1 ? ' seen' : ''}"><img class="end-down" src="${endImg('mephy3')}" alt=""><div class="end-box"></div><p class="end-hint">${NEXT_HINT}</p><button class="btn small end-skip" type="button" data-act="endSkip">飛ばす</button></div>`;
    ov.hidden = false; endingTalkDraw();
  }
  let talkAt = 0;
  function endingTalkDraw() {
    talkAt = performance.now();
    const [mood, line] = endTalk.lines[endTalk.i], box = ov.querySelector('.end-box');
    if (box) box.innerHTML = endSay(mood, line, 'big');
  }
  function endingNext() {
    if (uiState === 'ending' && endWait) { endingFinal(); return; }
    if ((uiState !== 'ending' && uiState !== 'mephyTalk') || !endTalk) return;
    if (performance.now() - talkAt < 600) return;
    endTalk.i++; Sfx.play('pick');
    if (endTalk.i < endTalk.lines.length) endingTalkDraw(); else { const done = endTalk.done || endingRoll; endTalk = null; done(); }
  }
  function endingCards(run = G.run, rec = endRec(), tier = endDemo ? endDemo.tier : (G.cfg.tier || 0)) {
    const hn = Object.entries(run.habitN || {}).sort((p, q) => q[1] - p[1]).slice(0, 3);
    const rows = list => `<ul>${list.map(([k, v]) => `<li><span>${k}</span><b>${typeof v === 'number' ? v.toLocaleString('ja-JP') : v}</b></li>`).join('')}</ul>`;
    const total = (rec.totalKills || 0) + run.kills - (run.killsCounted || 0);
    const m = run.mod, pct = k => `×${k < 10 ? k.toFixed(1) : Math.round(k)}`;
    const xs = Object.entries(run.extras || {}).filter(([k, n]) => n > 0 && OS.EXTRAS[k]);
    const xv = (k, n) => k === 'x_hp' ? `+${Math.min(n, 5)}` : pct((k === 'x_dodge' ? 0.9 : 1.1) ** Math.min(n, 5));
    return [
      { title: 'あんたの癖', body: hn.length ? rows(hn.map(([h, n]) => [OS.HABITS[h].label, `${n}回`])) : '<p class="none">特になし</p>',
        line: hn.length ? 'あんたの癖、ぜーんぶ見てたんだから。' : 'あんた、ほんとに癖がないのね。……ちょっとだけ、すごいかも。' },
      { title: `今回の記録<em>本気度${tier}</em>`, body: rows([['倒した数', run.kills], ['突き返した回数', run.vetoUsed || 0]]) + (xs.length
          ? `<p class="sub">おまけ</p><ul class="two">${xs.map(([k, n]) => `<li><span>${k === 'x_dodge' ? '回避の間隔' : OS.EXTRAS[k].name}</span><b>${xv(k, n)}</b></li>`).join('')}</ul>`
          : '<p class="sub">おまけ　なし</p>'),
        line: 'ほら、今回のあんた。……けっこう、やるじゃない。' },
      { title: '敵の強さ', body: rows([['速さ', pct(m.eSpd)], ['数', pct(m.eNum)], ['体力', pct(m.eHp)], ['弾の速さ', pct(m.eBul)], ['ピカの連射', pct(m.shootRate)]]),
        line: 'あたしの召使いたち、こんなに強くしてあげたのに……。' },
      { title: '今までの記録', body: rows([['挑戦', `${rec.runs}回`], ['合格', `${rec.wins}回`], ['倒した数の合計', total], ['エンディング', `${rec.endingSeen || 1}回目`]]),
        line: '何回も来てくれたのね。……べ、別に数えてたわけじゃないわよ。' }
    ];
  }
  const END_DEMOS = [
    { name: 'A：癖なし・記録少なめ・おまけなし（本気度0）', tier: 0,
      run: { habitN: {}, kills: 812, combos: 2, vetoUsed: 0, extraN: 0, extras: {}, mod: { eSpd: 1.1, eNum: 1.2, eHp: 1.44, eBul: 1, shootRate: 1 } },
      rec: { runs: 3, wins: 1, totalKills: 2100, endingSeen: 1 } },
    { name: 'B：癖1つ・ふつう（本気度2）', tier: 2,
      run: { habitN: { still: 12 }, kills: 3480, combos: 6, vetoUsed: 4, extraN: 9, extras: { x_rate: 3, x_dmg: 2, x_speed: 1, x_hp: 3 }, mod: { eSpd: 1.46, eNum: 3.6, eHp: 9.2, eBul: 1.73, shootRate: 1.95 } },
      rec: { runs: 27, wins: 9, totalKills: 48210, endingSeen: 2 } },
    { name: 'C：癖3つ・全部多め・おまけ全部（本気度6）', tier: 6,
      run: { habitN: { far: 31, dodge: 22, moving: 9 }, kills: 12873, combos: 15, vetoUsed: 17, extraN: 35, extras: { x_rate: 5, x_dmg: 5, x_speed: 5, x_dodge: 5, x_size: 5, x_range: 5, x_hp: 5 }, mod: { eSpd: 2.14, eNum: 28.4, eHp: 1240, eBul: 3.6, shootRate: 7.5 } },
      rec: { runs: 412, wins: 133, totalKills: 1234567, endingSeen: 38 } }
  ];
  let endDemo = null;
  const endRec = () => endDemo ? Object.assign({}, rec, endDemo.rec) : rec;
  const demoRun = d => Object.assign({ killsCounted: 0 }, d.run, { combos: OS.COMBOS.slice(0, d.run.combos).map(c => c.id) });
  function showEndDemo() {
    setState('endDemo');
    const card = c => `<div class="demo-card"><div class="gc-card info"><small>${c.title}</small>${c.body}</div>${endSay('happy', c.line)}</div>`;
    showOv(`<h2>エンディングの見本</h2>
      <p class="muted">データの違いで、エンドロールの記録のカードがどう見えるか。「このデータで流す」で、そのままエンディングを流せる（本当の記録は変わらない）。</p>
      ${END_DEMOS.map((d, i) => `<section class="demo"><h3>${d.name}</h3>
        <p class="muted">はじめの会話：${d.tier >= 6 ? '本気度6の会話（……本気、だったのに。）' : 'ふつうの会話（う、うそ……あたしが、負けた……？）'}</p>
        <div class="demo-cards">${endingCards(demoRun(d), Object.assign({}, rec, d.rec), d.tier).map(card).join('')}</div>
        <div class="btns one"><button class="btn" data-act="endDemoPlay" data-i="${i}" type="button">このデータで流す</button></div></section>`).join('')}
      <div class="btns one stick-bottom"><button class="btn primary" data-act="title" type="button">もどる</button></div>`);
    movePadActs('.stick-bottom');
  }
  function playEndDemo(i) {
    const d = END_DEMOS[i];
    newRun(); Object.assign(G.run, demoRun(d), { mod: Object.assign({}, G.run.mod, d.run.mod) });
    G.run.endless = true; G.run.round = 50; G.run.mephyDown = true;
    endDemo = d; showEnding();
  }
  function endingRoll() {
    endingClear(); Sfx.music('ending');
    const k = ENDING_LEN / 180.9, T = s => s * 1000 * k;
    const el = ov.querySelector('.ending'); el.className = 'ending roll' + (rec.endingSeen > 1 ? ' seen' : '');
    el.innerHTML = `<img class="end-bg" src="art/bg/ending.jpg" alt=""><div class="end-shade"></div>
      <div class="end-stage"></div>
      <button class="btn small end-skip" type="button" data-act="endSkip">飛ばす</button>`;
    rollT0 = performance.now(); rollHeldAt = 0;
    const stage = el.querySelector('.end-stage'), at = (s, f) => { const p = { due: T(s), f }; endTimers.push(p); rollArm(p); };
    const scenes = [
      ...ENDING_CREDITS.map(([lab, name, line]) => ({ card: `<small>${lab}</small><strong>${esc(name)}</strong>`, cls: 'credit', line, mood: 'smug' })),
      ...endingCards().map(c => ({ card: `<small>${c.title}</small>${c.body}`, cls: 'info', line: c.line, mood: 'happy', len: 1.6 })),
      ...ENDING_CAST.map((c, i) => ({ c, line: c.line, mood: i % 3 === 2 ? 'happy' : 'smug' }))
    ];
    const OPEN_S = 7, START = OPEN_S + 0.5, THANKS_AT = ENDING_LEN - 9, LINE_S = 4;
    const units = scenes.reduce((n, sc) => n + (sc.len || 1), 0), SCENE_S = (THANKS_AT - START - LINE_S) / units;
    let at0 = START; scenes.forEach(sc => { sc.at = at0; sc.dur = SCENE_S * (sc.len || 1); at0 += sc.dur; });
    stage.innerHTML = `<img class="end-logo-open" src="${endImg('logo')}" alt="${esc(document.title)}" style="--od:${(T(OPEN_S) / 1000).toFixed(2)}s">`;
    at(START, () => el.classList.add('cast'));
    scenes.forEach(sc => at(sc.at, () => {
      el.style.setProperty('--cd', (T(sc.dur) / 1000).toFixed(2) + 's');
      const c = sc.c, inner = c ? `<img class="gc-srv" src="${endImg(c.art)}" alt="">` : `<div class="gc-srv gc-card ${sc.cls}">${sc.card}</div>`;
      stage.innerHTML = `<div class="end-cast${c && c.boss ? ' boss' : ''}${c && c.mini ? ' mini' : ''}${c ? '' : ' card'}">${c ? `<b>${esc(c.name())}</b>` : ''}
        <div class="gc-mephy"><span class="carry-m">${carryFrames()}</span><span class="carry-m m-free">${carryFrames('mephy_free')}</span></div>
        <div class="gc-box"><img class="closed" src="${endImg('gift')}" alt=""><img class="open" src="${endImg('gift_open')}" alt=""></div>${inner}</div>${endSay(sc.mood, sc.line)}`;
    }));
    at(at0, () => {
      const row = list => `<div class="end-row">${list.map(c => `<img class="${c.boss ? 'boss' : c.mini ? 'mini' : ''}" src="${endImg(c.art)}" alt="">`).join('')}</div>`;
      stage.innerHTML = `<div class="end-line">${row(ENDING_CAST.filter(c => !c.boss))}${row(ENDING_CAST.filter(c => c.boss))}</div>${endSay('happy', '……みんな、あたしの自慢の召使いよ。')}`;
    });
    at(THANKS_AT, () => { el.classList.remove('cast'); el.classList.add('thanks'); stage.innerHTML = `<img class="end-logo-mid" src="${endImg('logo')}" alt="${esc(document.title)}">${endSay('happy', '……ここまで付き合ってくれて、ありがと。', 'big')}<p class="end-hint">${NEXT_HINT}</p>`; });
    at(ENDING_LEN, () => { endWait = true; const h = stage.querySelector('.end-hint'); if (h) h.classList.add('show'); });
  }
  function endingSkip() { if (uiState !== 'ending') return; if (endTalk) { endTalk = null; endingRoll(); } else endingFinal(); }
  function endingFinal() {
    if (uiState !== 'ending') return;
    endingClear(); endTalk = null; endWait = false;
    ov.classList.add('ending-ov');
    ov.innerHTML = `<div class="ending final"><img class="end-bg" src="art/bg/ending.jpg" alt=""><div class="end-shade"></div>
      <div class="end-stage">${endSay('happy', '……これからも、見ててあげる。', 'big')}</div>
      <div class="btns end-acts"><button class="btn primary" data-act="endContinue" type="button">エンドレスをつづける</button><button class="btn danger-ish" data-act="endResult" type="button">ここで終わる（結果を見る）</button></div><p class="end-note">「ここで終わる」を選ぶと、この挑戦（エンドレス）はここでおしまい。</p></div>`;
    ov.hidden = false; movePadActs('.end-acts');
  }
  function endingLeave() { endingClear(); endTalk = null; endWait = false; endDemo = null; ov.classList.remove('ending-ov'); }
  function showEnd(win) {
    setState('over');
    const run = G.run;
    const lockedBefore = OS.lockedUpgrades(rec);
    const newBest = run.kills > rec.best;
    rec.best = Math.max(rec.best, run.kills); rec.bestRound = Math.max(rec.bestRound, win || run.endless ? run.rounds : run.round); if (win) rec.wins++;
    unlockedTier = 0;
    const t = G.cfg.tier || 0;
    if (win && t > rec.tierCleared) { rec.tierCleared = t; if (t < OS.TIERS.length) { unlockedTier = t + 1; ui.tier = t + 1; store('os2_ui', ui); } }
    if (run.endless && run.round > rec.endlessBest.round) rec.endlessBest = { round: run.round, kills: run.kills };
    rec.totalKills = (rec.totalKills || 0) + run.kills - (run.killsCounted || 0); run.killsCounted = run.kills;
    checkAch('end', { win });
    gcEvent('damatsuyo-result', 'ダマツヨ：結果画面まで遊んだ'); if (win && !run.endless) gcEvent('damatsuyo-clear', 'ダマツヨ：フェーズ10を乗りきった');
    const lockedAfter = OS.lockedUpgrades(rec);
    newUps = lockedBefore.filter(k => !lockedAfter.includes(k));
    store('os2_rec', rec);
    lastWord = G.line(run.endless ? OS.LINES.endless : win ? OS.LINES.win : OS.LINES.lose);
    if (win || run.endless) { if (Sfx.musicOn) Sfx.music('win'); else Sfx.play('win'); }
    else { Sfx.play('lose'); Sfx.music('lose'); }
    lastNewBest = newBest;
    renderResult(win);
    if (shareCard) URL.revokeObjectURL(shareCard.url);
    shareCard = null; makeCard();
    if (bot) autoT = 2.5;
  }
  let lastNewBest = false, unlockedTier = 0, newUps = [];
  function renderResult(win) {
    setState('over');
    const run = G.run, newBest = lastNewBest;
    const seq = run.log.map(l => `<li class="${l.combos.length ? 'c' : ''}${l.refused ? ' r' : ''}" title="フェーズ${l.round}${l.refused ? `（${OS.UPGRADES[l.refused].name}は突き返した）` : ''}"><span class="n">${l.round}</span>${ico(l.up)}<span>${OS.UPGRADES[l.up].name}</span></li>`).join('') || '<li class="muted">なし</li>';
    const cs = run.combos.map(id => `<span class="chip c">${comboOf(id).name}</span>`).join('') || '<span class="muted">なし</span>';
    const modCount = new Map();
    for (const id of run.takenBuffs) modCount.set(id, (modCount.get(id) || 0) + 1);
    const enemyMods = [...modCount].map(([id, n]) => buffOf(id).name + (n > 1 ? ` ×${n}` : ''));
    const prog = Array.from({ length: run.rounds }, (_, i) => `<i class="${win || run.endless || i < run.round - 1 ? 'ok' : i === run.round - 1 ? 'ko' : ''}"></i>`).join('');
    const oc = outcome(win);
    showOv(`<div class="result ${oc.cls}">
        <p class="eyebrow">${oc.eyebrow}</p>
        <h2>${oc.h2}</h2>
        ${unlockedTier ? `<p class="unlock">本気度 ${unlockedTier} が選べるようになった：${OS.TIERS[unlockedTier - 1].label}</p>` : ''}
        ${runAch.length ? `<p class="unlock new-ach">新しい実績：${runAch.map(id => `★ ${achOf(id).name}`).join('　')}</p>` : ''}
        ${newUps.length ? `<p class="unlock new-ups">新しい強化が押し付けられるようになった：${newUps.map(k => `${ico(k)}${OS.UPGRADES[k].name}`).join('　')}</p>` : ''}
        <div class="prog" aria-hidden="true">${prog}</div>
        ${rivalBox(win || run.endless ? 'happy' : 'angry', lastWord)}
        <p class="eyebrow">押し付けられた順</p>
        <ol class="seq">${seq}</ol>
        <dl class="stats"><dt>倒した数</dt><dd><b class="big">${run.kills}</b>${newBest ? '<span class="new">最高記録</span>' : `（最高 ${rec.best}）`}</dd>
        <dt>うっかりコンボ</dt><dd>${cs}</dd>
        ${!win && run.diedTo ? `<dt>最後は</dt><dd>${esc(run.diedTo)}</dd>` : ''}
        ${run.extraN ? `<dt>おまけ</dt><dd class="muted">${extrasTxt(run)}</dd>` : ''}
        ${enemyMods.length ? `<dt>敵の強化</dt><dd class="muted">${enemyMods.join('、')}</dd>` : ''}</dl>
      </div>
      <div class="acts"><div class="btns"><button class="btn primary" data-act="retry" type="button">${unlockedTier ? `本気度 ${unlockedTier} で遊ぶ` : 'もう一度'}</button><button class="btn xpost" data-act="xpost" type="button">X に投稿</button></div>
      ${win && G.phase === 'win' ? `<button class="btn veto" data-act="endless" type="button">エンドレスをつづける（フェーズ11から）</button>` : ''}
      <div class="row center"><button class="btn small" data-act="share" type="button">結果の画像</button><button class="btn small ghost" data-act="title" type="button">タイトルへ</button></div></div>`);
    paintFaces();
    movePadActs();
  }
  function shareInfo() {
    const run = G.run, win = G.phase === 'win', d = new Date();
    return { head: endWhere(win) + endBang(win), win: win || !!run.endless, endless: !!run.endless, gaveUp: !!run.gaveUp, tier: G.cfg.tier || 0, round: run.round, rounds: run.rounds, kills: run.kills, quote: lastWord, mood: win || run.endless ? 'happy' : 'angry',
      seq: run.log.map(l => ({ round: l.round, up: l.up, combo: l.combos.length > 0 })),
      combos: run.combos.map(id => comboOf(id).name),
      date: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` };
  }
  const PHONE = matchMedia('(pointer: coarse)').matches;
  let shareCard = null, cardWait = null;
  function makeCard() {
    if (shareCard) return Promise.resolve(shareCard);
    if (cardWait) return cardWait;
    const d = new Date(), fname = `damatte_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.png`;
    cardWait = (async () => {
      try {
        const cvs = await OS.makeShareCard(shareInfo());
        const blob = await new Promise(r => cvs.toBlob(r, 'image/png'));
        if (!blob) return null;
        shareCard = { blob, fname, url: URL.createObjectURL(blob), file: new File([blob], fname, { type: 'image/png' }) };
        return shareCard;
      } catch (e) { console.error(e); return null; } finally { cardWait = null; }
    })();
    return cardWait;
  }
  async function xPost() {
    gcEvent('damatsuyo-xpost', 'ダマツヨ：Xに投稿を押した');
    const c = shareCard || await makeCard();
    if (PHONE && c) {
      try { if (navigator.canShare && navigator.canShare({ files: [c.file] })) { await navigator.share({ files: [c.file], text: resultText(G.phase === 'win') }); return; } }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    showShare();
  }
  const NOTE_SAVE = PHONE ? '画像を長押しして保存かコピーをしてから、「X を開く」で投稿に添付するか貼り付けてください。'
    : '「画像をコピーして X を開く」を押して、X の投稿欄に貼り付け（Ctrl+V／⌘V）てください。画像は右クリックで保存もできます。';
  async function showShare() {
    clearPadActs();
    if (!shareCard) showOv(`<p class="eyebrow">結果の画像</p><p class="muted">作っているところ…</p>`);
    const c = shareCard || await makeCard();
    if (uiState !== 'over') return;
    if (!c) { showOv(`<p class="eyebrow">結果の画像</p><p>画像を作れませんでした。</p><button class="btn primary" data-act="backResult" type="button">結果にもどる</button>`); return; }
    showOv(`<p class="eyebrow">結果の画像</p>
      <img class="share-img" src="${c.url}" alt="結果の画像">
      <p class="muted share-note" id="shareNote">${NOTE_SAVE}</p>
      <div class="acts">
      <div class="btns"><a class="btn primary xpost" id="toX" href="${xUrl(G.phase === 'win')}" target="_blank" rel="noopener">${PHONE ? 'X を開く' : '画像をコピーして X を開く'}</a><a class="btn" href="${c.url}" download="${c.fname}">画像を保存</a></div>
      <button class="btn small ghost" data-act="backResult" type="button">結果にもどる</button></div>`);
    movePadActs('.acts');
    const note = document.getElementById('shareNote');
    document.getElementById('toX').addEventListener('click', () => {
      if (PHONE) return;
      const ng = () => { note.textContent = '画像をコピーできませんでした。画像を右クリックで保存して、投稿に添付してください。'; };
      try { navigator.clipboard.write([new ClipboardItem({ 'image/png': c.blob })]).then(() => { note.textContent = '画像をコピーしました。X の投稿欄に貼り付けてください。'; }, ng); } catch (e) { ng(); }
    });
  }
  function updOwned() {
    const el = document.getElementById('owned'), run = G.run;
    el.classList.toggle('off', onTitle());
    el.classList.toggle('empty', !run || !run.ups.length);
    if (!run || !run.ups.length || onTitle()) { el.innerHTML = ''; return; }
    el.innerHTML = '<span class="lab">押し付けられた強化</span>' + run.ups.map(k => `<button class="chip" type="button" data-up="${k}" title="${OS.UPGRADES[k].plus}／${OS.UPGRADES[k].minus}">${ico(k)}<span class="nm">${OS.UPGRADES[k].name}</span></button>`).join('') + (run.combos.length > 4 ? `<button class="chip c" type="button" data-combos="1" title="${run.combos.map(id => comboOf(id).name).join('・')}">★<span class="nm"> うっかり</span> ${run.combos.length}</button>`
        : run.combos.map(id => `<button class="chip c" type="button" data-combo="${id}" title="${comboOf(id).desc}">★<span class="nm"> ${comboOf(id).name}</span></button>`).join(''))
      + (run.extraN ? `<button class="chip c" type="button" data-extra="1" title="${extrasTxt(run)}">＋<span class="nm">おまけ</span> ${run.extraN}</button>` : '');
    const h0 = el.offsetHeight;
    el.classList.remove('compact', 'tight', 'rows', 'scroll');
    const over = () => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    if (over()) el.classList.add('compact');
    if (over()) el.classList.add('tight');
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) el.classList.add(touch ? 'scroll' : 'rows');
    if (el.offsetHeight !== h0 && !fitting) { fitting = true; fitStage(); fitting = false; }
  }
  let fitting = false;
  const extrasTxt = run => Object.entries(run.extras || {}).map(([k, n]) => OS.EXTRAS[k].name + (n > 1 ? ` ×${n}` : '')).join('、');
  document.getElementById('owned').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const U = b.dataset.up && OS.UPGRADES[b.dataset.up], C = b.dataset.combo && comboOf(b.dataset.combo);
    info = U ? { txt: `${U.name}：＋${U.plus}　－${U.minus}`, life: 4 } : C ? { txt: `★ ${C.name}：${C.desc}`, life: 4 } : b.dataset.extra && G.run ? { txt: `おまけ：${extrasTxt(G.run)}`, life: 5 } : b.dataset.combos && G.run ? { txt: `★ ${G.run.combos.map(id => comboOf(id).name).join('・')}`, life: 5 } : null;
    b.blur(); Sfx.play('tick');
  });
  function autoStep(dt) {
    if (!bot || autoT <= 0) return;
    autoT -= dt; if (autoT > 0) return;
    if (uiState === 'pick') acceptPick();
    else if (uiState === 'enemyPick') chooseEnemy(Math.floor(Math.random() * G.enemyOpts.length));
    else if (uiState === 'over') newRun();
  }
  const hud = { el: document.getElementById('hud'), hearts: document.getElementById('hHearts'), veto: document.getElementById('hVeto'), gauge: document.getElementById('hGauge'),
    vetoRow: document.querySelector('.hud-veto'), timer: document.getElementById('hTimer'), round: document.getElementById('hRound'), kills: document.getElementById('hKills'),
    say: document.getElementById('hSay'), tbar: document.getElementById('hTbar'),
    msg: document.getElementById('hMsg'), last: {} };
  function setIf(key, val, fn) { if (hud.last[key] !== val) { hud.last[key] = val; fn(val); } }
  function updateHud() {
    const show = !onTitle() && G.run && G.w;
    setIf('show', !!show, v => hud.el.classList.toggle('off', !v));
    const message = info && info.life > 0 ? info.txt : uiState === 'play' ? (toast && toast.life > 0 ? toast.txt : hint && hint.life > 0 ? hint.txt : '') : '';
    setIf('msg', message, v => { if (v) hud.msg.textContent = v; hud.msg.classList.toggle('on', !!v); });
    if (!show) return;
    const run = G.run, w = G.w;
    setIf('hearts', `${run.hp}/${run.maxHp}`, () => {
      const many = !(run.maxHp <= 10 && run.hp <= run.maxHp);
      hud.hearts.classList.toggle('num-mode', many);
      hud.hearts.innerHTML = !many ? '<b>♥</b>'.repeat(Math.max(0, run.hp)) + '<i>♥</i>'.repeat(Math.max(0, run.maxHp - run.hp)) : `<b>♥</b> <span class="num">${run.hp} / ${run.maxHp}</span>`;
      hud.hearts.classList.toggle('low', run.hp === 1);
      hud.hearts.setAttribute('aria-label', `体力 ${run.hp} / ${run.maxHp}`);
    });
    setIf('veto', run.veto, v => { hud.veto.innerHTML = '◆'.repeat(v) + `<i>${'◆'.repeat(Math.max(0, 3 - v))}</i>`; });
    const gk = run.vetoNeed ? Math.min(1, run.vetoGauge / run.vetoNeed) : 0;
    setIf('gauge', Math.round(gk * 100), v => { hud.gauge.style.width = v + '%'; hud.gauge.classList.toggle('full', v >= 100); });
    setIf('vpulse', vetoPulse > 0, v => hud.vetoRow.classList.toggle('pulse', v));
    setIf('vgauge', !!(run.endless && run.round > run.rounds), v => hud.vetoRow.classList.toggle('nogauge', v));
    const left = Math.max(0, Math.ceil(w.len - w.t));
    setIf('timer', left, v => { hud.timer.textContent = v === Infinity ? '∞' : v; hud.timer.classList.toggle('warn', v <= 5 && w.end < 0); });
    setIf('tbar', Math.round(Math.max(0, 1 - w.t / w.len) * 200), v => { hud.tbar.style.width = (v / 2) + '%'; hud.tbar.classList.toggle('warn', left <= 5); });
    const tier = G.cfg.tier ? `本気度${G.cfg.tier}　` : '';
    setIf('round', (tier ? `<small class="hud-tier">${tier.trim()}</small>` : '') + `<span class="hud-ph">フェーズ </span>${run.round}<small> / ${run.endless ? '∞' : run.rounds}</small>`, v => { hud.round.innerHTML = v; hud.round.classList.toggle('endless', !!run.endless); });
    setIf('kills', run.kills, v => { hud.kills.textContent = `倒した ${v}`; hud.kills.classList.remove('pop'); void hud.kills.offsetWidth; hud.kills.classList.add('pop'); });
    setIf('mood', rivalHud.mood, v => rivalFace('hFace', v));
    const say = rivalHud.life > 0 ? rivalHud.txt : '';
    setIf('say', say, v => { if (v) hud.say.textContent = v; hud.say.classList.toggle('on', !!v); hud.el.classList.toggle('saying', !!v); });
  }
  let last = performance.now(), faceT = 3;
  const dodgeBtn = document.getElementById('bDodge');
  let dodgeWait = false, cdShown = -1;
  function updDodgeBtn() {
    if (!dodgeBtn || !G.w) return;
    const cd = G.dodgeCdNow(), left = cd > 0 ? Math.max(0, Math.min(1, G.w.p.dodgeCd / cd)) : 0, r = Math.round(left * 100) / 100;
    if (r !== cdShown) { dodgeBtn.style.setProperty('--cd', r); cdShown = r; }
    const wait = left > 0;
    if (wait !== dodgeWait) {
      dodgeBtn.classList.toggle('wait', wait);
      if (!wait) { dodgeBtn.classList.remove('ready'); void dodgeBtn.offsetWidth; dodgeBtn.classList.add('ready'); }
      dodgeWait = wait;
    }
  }
  function frame(now) { tick(now); requestAnimationFrame(frame); }
  function view() {
    return { G, uiState: onTitle() ? 'title' : uiState, fx, trail, banner, toast, hint: uiState === 'play' ? hint : null, shakeT, hurtFlash, killPulse, vetoPulse, rival: uiState === 'play' ? rivalHud : null,
      bot: bot ? `自動操作：${ui.auto === 'wander' ? '動き回るだけ' : '敵と弾をよける'}` : '' };
  }
  function tick(now) {
    let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 0; dt = Math.min(dt, 1 / 30);
    if (shakeT > 0) shakeT = calm ? 0 : Math.max(0, shakeT - dt);
    grazeCd -= dt; vetoPulse = Math.max(0, vetoPulse - dt * 1.2);
    rivalHud.life -= dt; rivalHud.cd -= dt; rivalHud.moodT -= dt; if (rivalHud.moodT <= 0) rivalHud.mood = 'smug';
    if (uiState === 'play' && G.w && !G.w.over && G.w.end < 0) {
      const left = Math.ceil(G.w.len - G.w.t);
      if (left !== lastLeft) { if (left <= 3 && left >= 1) Sfx.play('count'); lastLeft = left; }
      if (G.run.hp === 1) { heartT -= dt; if (heartT <= 0) { Sfx.play('heart'); heartT = 0.9; } }
    }
    if (uiState === 'title') { faceT -= dt; if (faceT <= 0) { const el = document.getElementById('rv'), now = el && el.dataset.mood; const next = now === 'smug' ? ['happy', 'think', 'shock'][Math.floor(Math.random() * 3)] : 'smug'; rivalFace('rv', next, true); faceT = next === 'smug' ? 2.5 + Math.random() * 2 : 1.2 + Math.random() * 0.6; } }
    hurtFlash = Math.max(0, hurtFlash - dt * 1.4); killPulse = Math.max(0, killPulse - dt * 6);
    for (const f of fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.spin) { f.rot += f.spin * dt; f.vy += 320 * dt; } else { f.vx *= 0.92; if (!f.t) f.vy *= 0.92; } }
    fx = fx.filter(f => f.life > 0);
    if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
    if (toast) { toast.life -= dt; if (toast.life <= 0) toast = null; }
    if (!toast && achQueue.length && uiState === 'play') toast = { txt: achQueue.shift(), life: 3 };
    if (info) { info.life -= dt; if (info.life <= 0 || onTitle()) info = null; }
    if (hint && uiState === 'play') { hint.life -= dt; if (hint.life <= 0) hint = null; }
    if (uiState === 'play' && G.w && G.run && G.isMephyRound(G.run.round) && G.run.preTalkRound !== G.run.round && G.w.bossT >= 0 && !bot) showMephyTalk();
    if (uiState === 'play' && G.w) {
      if (hitStop > 0) hitStop -= dt;
      else {
        const inp = bot ? bot(G, dt) : humanInput();
        G.update(dt, inp);
        const p = G.w.p;
        if (p.dodge > 0) trail.push({ x: p.x, y: p.y, l: .18 });
      }
      updDodgeBtn();
      trail.forEach(t => t.l -= dt); trail = trail.filter(t => t.l > 0);
      if (G.phase === 'roundEnd') { if (G.run.mephyDown && !G.run.endingShown) showEnding(); else showPick(); }
      else if (G.phase === 'win') showEnd(true);
      else if (G.phase === 'overtimeAsk') { if (bot) G.overtime(false); else showOvertimeAsk(); }
      else if (G.phase === 'lose') { const run = G.run; if (G.isMephyRound(run.round) && run.mephyDownRound !== run.round && run.winTalkRound !== run.round && !run.gaveUp && !bot) showMephyWinTalk(); else showEnd(false); }
    }
    autoStep(dt);
    try { R.draw(view()); } catch (e) { console.error(e); }
    try { updateHud(); } catch (e) { console.error(e); }
  }
  OS.debug = { ending: () => { if (G && G.run) { G.run.mephyDown = true; showEnding(); } }, get G() { return G; }, get uiState() { return uiState; }, get toast() { return toast; }, get achQueue() { return achQueue.slice(); }, get keys() { return [...keys.keys()]; }, get stick() { return Object.assign({}, stick); }, input: () => humanInput(), run(sec) { for (let i = 0; i < sec * 60; i++) tick(last + 1000 / 60); },
    snapshot(px) { R.setScale(px || 960); R.draw(view()); const u = cv.toDataURL('image/png'); R.resize(); return u; } };
  document.addEventListener('visibilitychange', () => { last = performance.now(); keys.clear(); if (document.hidden && !bot) pause(); });
  const $ = id => document.getElementById(id);
  const ADJ_LABEL = {
    1: '弱体化を「敵の強化をどれにするか」に置き換える（回復は3フェーズに1回）',
    2: '敵の増え方を強くする（湧きの縮み方・体力の伸び）',
    3: '5フェーズ目と10フェーズ目に強敵',
    4: '癖の「損」を重く（跳弾の当たり判定・加速のすべり など）',
    5: '後半ほどメフィーが本気（6フェーズ目から乱数をほぼ消す）',
    6: '被弾後の無敵を短く（0.9秒 → 0.6秒）'
  };
  $('dAdj').innerHTML = Object.keys(ADJ_LABEL).map(n => `<label class="chk"><input type="checkbox" data-adj="${n}"><span><b>${n}</b>${ADJ_LABEL[n]}</span></label>`).join('');
  const sliders = [
    ['dLen', 'oLen', () => cfg.roundLen, v => { cfg.roundLen = v; }, v => v + '秒'],
    ['dHp', 'oHp', () => cfg.player.hp, v => { cfg.player.hp = v; }, v => v],
    ['dMul', 'oMul', () => cfg.spawnNew.mul, v => { cfg.spawnNew.mul = v; }, v => '×' + v.toFixed(2)],
    ['dGrow', 'oGrow', () => cfg.spawnNew.hpGrowth, v => { cfg.spawnNew.hpGrowth = v; }, v => '×' + v.toFixed(2)]
  ];
  function sync() {
    document.querySelectorAll('[data-adj]').forEach(el => { el.checked = !!cfg.adj[el.dataset.adj]; });
    for (const [i, o, get, , f] of sliders) { $(i).value = get(); $(o).textContent = f(get()); }
    $('dRead').checked = cfg.rival.read !== false;
    $('dShort').checked = !!cfg.shortStart;
    $('dAuto').value = ui.auto;
    $('dJson').value = JSON.stringify(cfg, null, 2);
    $('dMul').disabled = $('dGrow').disabled = !cfg.adj[2];
  }
  const refreshTitle = () => { if (uiState === 'title') showTitle(); };
  $('dAdj').addEventListener('change', e => { const n = e.target.dataset.adj; if (!n) return; cfg.adj[n] = e.target.checked; saveCfg(); sync(); refreshTitle(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { const on = b.dataset.preset; for (let i = 1; i <= 6; i++) cfg.adj[i] = on.includes(String(i)); saveCfg(); sync(); refreshTitle(); }));
  for (const [i, , , set] of sliders) $(i).addEventListener('input', () => { set(+$(i).value); saveCfg(); sync(); refreshTitle(); });
  $('dRead').addEventListener('change', () => { cfg.rival.read = $('dRead').checked; saveCfg(); });
  $('dShort').addEventListener('change', () => { cfg.shortStart = $('dShort').checked; saveCfg(); sync(); refreshTitle(); });
  $('dAuto').addEventListener('change', () => {
    ui.auto = $('dAuto').value; store('os2_ui', ui);
    bot = ui.auto !== 'off' ? OS.makeBot(ui.auto) : null;
    if (bot && (uiState === 'pick' || uiState === 'enemyPick' || uiState === 'over')) autoT = 0.6;
  });
  $('dSkip').addEventListener('click', () => G.skipRound());
  $('dJsonApply').addEventListener('click', () => {
    try { cfg = OS.loadConfig(JSON.parse($('dJson').value)); saveCfg(); sync(); $('dJsonMsg').textContent = '反映しました（次の挑戦から）'; refreshTitle(); }
    catch (e) { $('dJsonMsg').textContent = '書き方が正しくありません：' + e.message; }
  });
  function resetAll() {
    cfg = OS.loadConfig(null); saveCfg();
    ui.auto = 'off'; store('os2_ui', ui); bot = null;
    sync(); refreshTitle();
  }
  const armed = {};
  function twoPress(btnId, msgEl, label, done) {
    $(btnId).addEventListener('click', () => {
      if (!(Date.now() - (armed[btnId] || 0) < 3000)) { armed[btnId] = Date.now(); msgEl.textContent = 'もう一度押すと初期値に戻します'; return; }
      armed[btnId] = 0; resetAll(); msgEl.textContent = '初期値に戻しました（次の挑戦から）';
      if (done) done();
    });
  }
  twoPress('dAllReset', $('dAllMsg'));
  twoPress('dJsonReset', $('dJsonMsg'));
  function showChanges() {
    const list = OS.listChanges(OS.diffConfig(cfg));
    const el = $('dChanges'); if (!el) return;
    el.innerHTML = list.length
      ? `初期値から変えている設定（${list.length}個）：` + list.slice(0, 12).map(c => `<code>${esc(c.key)}</code> ${esc(JSON.stringify(c.now))}<span class="muted">（初期値 ${esc(JSON.stringify(c.def))}）</span>`).join('、') + (list.length > 12 ? ' ほか' : '')
      : 'いまは全部初期値のまま';
  }
  let arm = 0;
  $('dReset').addEventListener('click', () => {
    const b = $('dReset');
    if (Date.now() - arm > 3000) { arm = Date.now(); b.textContent = 'もう一度押すと消去'; return; }
    rec = Object.assign({}, REC0, { combos: [], seen: [], ach: [] }); store('os2_rec', rec); arm = 0; b.textContent = '消去しました';
    setTimeout(() => { b.textContent = '図鑑と記録を消す'; }, 1500); refreshTitle();
  });
  $('dTierAll').addEventListener('click', () => { rec.tierCleared = Math.max(rec.tierCleared, OS.TIERS.length - 1); store('os2_rec', rec); $('dTierAll').textContent = 'すべて選べるようにしました'; refreshTitle(); });
  function updLog() {
    const run = G.run;
    if (!run || !run.lastHabit) { $('dLog').textContent = '直前のフェーズの癖：まだ記録なし'; return; }
    const h = run.lastHabit;
    $('dLog').innerHTML = `直前のフェーズの癖：回避 ${h.dodges}回・敵との平均距離 ${h.ad}・動いていた割合 ${h.mr}%<br>判定：${h.list.map(x => OS.HABITS[x].label).join('、') || '特になし'}${run.lastWhy ? `<br>相手の言い分：${esc(run.lastWhy)}` : ''}`;
  }
  let simBusy = false;
  $('dSim').addEventListener('click', () => {
    if (simBusy) return; simBusy = true;
    const N = +$('dSimN').value, simCfg = OS.loadConfig(JSON.parse(JSON.stringify(cfg)));
    const kinds = ['wander', 'evade'], res = { wander: [], evade: [] };
    let k = 0, i = 0;
    const out = $('dSimOut'), btn = $('dSim'); btn.disabled = true;
    (function step() {
      const t0 = performance.now();
      while (performance.now() - t0 < 30 && k < kinds.length) {
        res[kinds[k]].push(OS.simulateRun(simCfg, kinds[k], 1000 + i));
        if (++i >= N) { i = 0; k++; }
      }
      if (k < kinds.length) { out.textContent = `試しています… ${k * N + i} / ${N * 2}`; setTimeout(step, 0); return; }
      simBusy = false; btn.disabled = false;
      out.innerHTML = simTable(res, N, simCfg);
    })();
  });
  function simTable(res, N, c) {
    const name = { wander: '動くだけ', evade: 'よける' };
    const rows = Object.keys(res).map(kind => {
      const rs = res[kind], dist = Array(11).fill(0);
      rs.forEach(r => dist[r.win ? 10 : r.round - 1]++);
      const wins = dist[10], max = Math.max(...dist, 1);
      const sorted = rs.map(r => r.win ? 11 : r.round).sort((a, b) => a - b), med = sorted[Math.floor(N / 2)];
      const cells = dist.map((n, j) => `<td title="${j === 10 ? '完走' : `フェーズ${j + 1}で倒れた`}：${n}">${n ? `<span class="bar${j === 10 ? ' win' : ''}" style="width:${Math.max(2, n / max * 22)}px"></span>` : ''}<br>${n || ''}</td>`).join('');
      return `<tr><td>${name[kind]}</td>${cells}<td>${Math.round(wins / N * 100)}%</td><td>${med > 10 ? '完走' : med}</td></tr>`;
    }).join('');
    return `調整案 ${Object.keys(c.adj).filter(k => c.adj[k]).join('・') || 'なし'}、各${N}回。数字は「そのフェーズで倒れた回数」。
      <div style="overflow-x:auto"><table><tr><th></th>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<th>${n}</th>`).join('')}<th>完走</th><th>完走率</th><th>中央</th></tr>${rows}</table></div>
      <span>「動くだけ」＝動き回るだけ、「よける」＝敵と弾をよける。目安：「動くだけ」は完走0%、「よける」は5〜7フェーズ目あたりで倒れることが多い。</span>`;
  }
  if (/[?&#]dev\b/.test(location.href)) document.getElementById('dev').hidden = false;
  let devSeq = '';
  addEventListener('keydown', e => {
    if (!DEV_OK || !onTitle() || e.repeat || isTextField(e.target)) return;
    devSeq = (devSeq + (e.code === 'KeyD' ? 'd' : e.code === 'KeyE' ? 'e' : e.code === 'KeyV' ? 'v' : '-')).slice(-3);
    if (devSeq === 'dev') openDev();
  });
  function openDev() { const d = document.getElementById('dev'); d.hidden = false; d.open = true; sideOn = true; placeSide(); toast = null; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  let logoTaps = [];
  ov.addEventListener('click', e => {
    if (!DEV_OK || uiState !== 'title' || !e.target.closest('.title-top .logo, .title-top h2')) return;
    const now = performance.now(); logoTaps = logoTaps.filter(t => now - t < 2000).concat(now);
    if (logoTaps.length < 5) return;
    logoTaps = [];
    askEl.innerHTML = `<div class="card"><h2>開発用</h2><div class="btns col">
      <button class="btn" data-act="devEnding" type="button">エンディングを見る</button>
      <button class="btn" data-act="endDemo" type="button">エンディングの見本</button>
      <button class="btn" data-act="devMephy" type="button">フェーズ50（メフィー戦）へ飛ぶ</button>
      <div class="row center">${[10, 20, 30, 40].map(n => `<button class="btn small" data-act="devFrom" data-n="${n}" type="button">${n}から</button>`).join('')}</div>
      <button class="btn small" data-act="devFfwdPick" type="button">早送りの敵の強化：${ffwdPickName()}</button>
      <button class="btn small" data-act="devInv" type="button">無敵：${devInvOn ? 'オン' : 'オフ'}</button>
      ${landscape.matches ? '' : '<button class="btn" data-act="devPanel" type="button">開発用の画面を開く</button>'}
      <button class="btn primary" data-act="askNo" type="button">とじる</button></div></div>`;
    askEl.hidden = false;
  });
  function devStartIfNeeded() { if (!G || !G.run || G.phase === 'idle' || G.phase === 'lose' || G.phase === 'win' || uiState === 'title' || onTitle()) newRun(); }
  const EASY_ORDER = ['long', 'gunny', 'heal', 'sharp', 'split', 'rapid', 'bfast', 'many', 'tough', 'fast'];
  let ffwdPick = load('os2_dev_ffwd', 'random');
  const ffwdPickName = () => ffwdPick === 'easy' ? '損の小さいもの' : 'ランダム';
  function ffwdChoose(opts) {
    if (ffwdPick !== 'easy') return Math.floor(Math.random() * opts.length);
    const rank = o => { const i = EASY_ORDER.indexOf(o.id); return i < 0 ? 99 : i; };
    let best = 0; opts.forEach((o, i) => { if (rank(o) < rank(opts[best])) best = i; });
    return best;
  }
  function setDevInv(v) { devInvOn = !!v; G.devInv = devInvOn; store('os2_dev_inv', devInvOn); document.body.classList.toggle('dev-inv', devInvOn); const cb = document.getElementById('dInv'); if (cb) cb.checked = devInvOn; }
  function setFfwdPick(v) { ffwdPick = v; store('os2_dev_ffwd', v); const sel = document.getElementById('dFfwdPick'); if (sel) sel.value = v; }
  function devFfwd(start) {
    newRun();
    const run = G.run, to = start - 1;
    ffwd = true;
    try {
      for (let n = 0; n < 20000 && !(run.round === to && G.phase === 'play'); n++) {
        if (G.phase === 'play') { G.w.p.inv = 9; G.skipRound(); G.update(0.05, { mx: 0, my: 0, dodge: false }); }
        else if (G.phase === 'win') G.continueEndless();
        else if (G.phase === 'overtimeAsk') G.overtime(false);
        else if (G.phase === 'roundEnd') { G.preparePick(); G.accept(); G.prepareEnemyPick(); G.chooseEnemy(ffwdChoose(G.enemyOpts)); }
        else break;
      }
    } finally { ffwd = false; }
    fx.length = 0; updOwned(); startMusic();
    info = { txt: `フェーズ${run.round}まで早送りした（敵の強化は${ffwdPickName()}。押し付けられた強化 ${run.ups.length}・おまけ ${run.extraN}）`, life: 5 };
    G.skipRound();
  }
  $('dMephy').addEventListener('click', () => devFfwd(G.cfg.boss.mephy ? G.cfg.boss.mephy.at : 50));
  document.querySelectorAll('[data-from]').forEach(b => b.addEventListener('click', () => devFfwd(+b.dataset.from)));
  setDevInv(devInvOn);
  if ($('dInv')) $('dInv').addEventListener('change', e => setDevInv(e.target.checked));
  if ($('dFfwdPick')) { $('dFfwdPick').value = ffwdPick; $('dFfwdPick').addEventListener('change', e => setFfwdPick(e.target.value)); }
  $('dEndDemo').addEventListener('click', () => showEndDemo());
  $('dEnding').addEventListener('click', () => { devStartIfNeeded(); G.run.endless = true; G.run.round = 50; G.run.mephyDown = true; showEnding(); });
  sync(); showChanges(); updLog(); syncHead(); checkAch('load'); showTitle();
  requestAnimationFrame(frame);
})(globalThis.OS = globalThis.OS || {});
